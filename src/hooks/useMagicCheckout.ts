"use client";

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, functions, db } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, collection, runTransaction, Timestamp, increment } from 'firebase/firestore';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useNotification } from '@/contexts/NotificationContext';
import { tracker } from '@/lib/analytics/tracker';

const loadScript = (src: string): Promise<boolean> =>
    new Promise((resolve) => {
        if (typeof window === 'undefined') {
            resolve(false);
            return;
        }
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });

export interface MagicCheckoutOptions {
    items?: CartItem[];
    total?: number;
    isCod?: boolean;
    notes?: Record<string, string>;
}

export function useMagicCheckout() {
    const router = useRouter();
    const { cartItems, cartTotal, clearCart } = useCart();
    const { showNotification } = useNotification();
    const [isLoading, setIsLoading] = useState(false);

    const openMagicCheckout = useCallback(async (options?: MagicCheckoutOptions) => {
        const targetItems = options?.items || cartItems;

        if (!targetItems || targetItems.length === 0) {
            showNotification('Your cart is empty. Add items to checkout.', 'warning', {
                title: 'Cart Empty',
            });
            router.push('/shop');
            return;
        }

        setIsLoading(true);

        try {
            // 1. Ensure Razorpay Magic Checkout script is loaded
            const loaded =
                (await loadScript('https://checkout.razorpay.com/v1/magic-checkout.js')) ||
                (await loadScript('https://checkout.razorpay.com/v1/checkout.js'));

            if (!loaded) {
                showNotification('Payment gateway failed to load. Please check your connection.', 'error', {
                    title: 'Network Error',
                });
                setIsLoading(false);
                return;
            }

            // 2. Format items for backend and Razorpay
            const formattedItems = targetItems.map((item) => {
                let realProductId = item.productId || item.id;
                if (realProductId.includes('_v_')) {
                    realProductId = realProductId.split('_v_')[0];
                } else if (item.category === 'Combos' && realProductId.includes('_')) {
                    realProductId = realProductId.split('_')[0];
                }

                return {
                    productId: realProductId,
                    cartItemId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    baseWeight: item.baseWeight ?? 100,
                    category: item.category || 'Snacks',
                    imageURL: item.imageURL || '/Logo Munch Tokri.png',
                    variant: item.variant || undefined,
                    grams: (item as any).grams || (item as any).variantGrams || undefined,
                };
            });

            // Calculate subtotal if not provided
            const calculatedTotal =
                options?.total !== undefined
                    ? options.total
                    : Math.round(
                          targetItems.reduce(
                              (sum, it) => sum + (it.price / (it.baseWeight || 100)) * it.quantity,
                              0
                          ) * 100
                      ) / 100;

            const currentUser = auth.currentUser;
            const currentUserId = currentUser?.uid || null;

            const isCodRequested = Boolean(options?.isCod);
            const advanceAmount = isCodRequested ? Math.max(1, Math.round(calculatedTotal * 0.20 * 100) / 100) : calculatedTotal;
            const codBalance = isCodRequested ? Math.max(0, Math.round((calculatedTotal - advanceAmount) * 100) / 100) : 0;
            const payableAmount = advanceAmount;

            tracker.track('checkout_start', {
                source: isCodRequested ? 'magic_checkout_cod' : 'magic_checkout',
                cartTotal: calculatedTotal,
                payableAmount,
                isCod: isCodRequested,
                itemCount: formattedItems.length,
            });

            // For COD, pass ONLY the 20% advance payment item so backend Razorpay order
            // calculates line items and total amount strictly as the 20% advance
            const itemsForPayOrder = isCodRequested
                ? [
                      {
                          id: 'cod_advance_20',
                          productId: 'cod_advance_20',
                          name: '20% Advance Payment for COD Order',
                          price: advanceAmount,
                          quantity: 1,
                          baseWeight: 1,
                          category: 'Combos',
                          variant: `Balance ₹${codBalance.toFixed(2)} on Delivery`,
                          imageURL: 'https://munchtokri.com/logo.png',
                      },
                  ]
                : formattedItems;

            // 3. Create Razorpay Order from backend with mandatory line_items and line_items_total
            const createPayOrder = httpsCallable(functions, 'createPayOrder');
            const res = (await createPayOrder({
                amount: payableAmount,
                isCod: isCodRequested,
                totalOrderAmount: calculatedTotal,
                codBalance: codBalance,
                advancePaid: advanceAmount,
                items: itemsForPayOrder,
                userId: currentUserId,
                notes: {
                    source: 'magic_checkout',
                    isCod: isCodRequested ? 'true' : 'false',
                    advancePaid: String(advanceAmount),
                    codBalance: String(codBalance),
                    totalOrderAmount: String(calculatedTotal),
                    ...(options?.notes || {}),
                },
            })) as {
                data: {
                    success: boolean;
                    order?: { id: string; amount: number; currency: string };
                    message?: string;
                };
            };

            const orderData = res.data;
            if (!orderData?.success || !orderData.order?.id) {
                showNotification(
                    orderData?.message ?? 'Could not initialize Magic Checkout. Please try again.',
                    'error',
                    { title: 'Checkout Error' }
                );
                setIsLoading(false);
                return;
            }

            const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
            if (!razorpayKey) {
                showNotification('Payment configuration missing. Please contact support.', 'error', {
                    title: 'Configuration Error',
                });
                setIsLoading(false);
                return;
            }

            // 4. Configure Razorpay Magic Checkout modal
            // Details captured dynamically from Magic Checkout address and contact events
            const capturedMagicDetails = {
                fullName: currentUser?.displayName || '',
                mobile: currentUser?.phoneNumber || '',
                email: currentUser?.email || '',
                address: '',
                city: '',
                state: '',
                pincode: '',
            };

            let selectedPaymentMethod: 'online' | 'cod' = 'online';

            const lineItemsCart = formattedItems.map((item, idx) => {
                const isCombo = item.category === 'Combos' || item.baseWeight === 1;
                const qty = Number(item.quantity) || 1;
                const price = Number(item.price) || 0;
                const baseWeight = Number(item.baseWeight) || 100;
                let itemTotalPaise = 0;
                let displayQty = 1;
                if (isCombo) {
                    displayQty = Math.max(1, Math.round(qty));
                    itemTotalPaise = Math.round(price * 100) * displayQty;
                } else {
                    const totalRupees = (price / baseWeight) * qty;
                    itemTotalPaise = Math.round(totalRupees * 100);
                    displayQty = 1;
                }
                const unitPricePaise = displayQty > 0 ? Math.round(itemTotalPaise / displayQty) : itemTotalPaise;
                return {
                    sku: String(item.productId || `item_${idx + 1}`),
                    name: item.name,
                    description: item.variant || `${item.quantity} units`,
                    price: unitPricePaise,
                    offer_price: unitPricePaise,
                    quantity: displayQty,
                    type: 'physical',
                    image_url: item.imageURL || 'https://munchtokri.com/logo.png',
                };
            });

            const rzpOptions: any = {
                key: razorpayKey,
                amount: orderData.order.amount,
                currency: orderData.order.currency,
                name: 'Munch Tokri',
                description: isCodRequested
                    ? `20% Advance Payment for COD (Balance ₹${codBalance.toFixed(2)} on delivery)`
                    : 'Authentic Karnataka Snacks & Sweets',
                order_id: orderData.order.id,
                one_click_checkout: true,
                show_address: true,
                cart: {
                    line_items: isCodRequested ? [{
                        sku: 'cod_advance_20',
                        name: '20% Advance Payment for COD Order',
                        description: `Total Order: ₹${calculatedTotal.toFixed(2)} | Balance ₹${codBalance.toFixed(2)} payable on delivery`,
                        price: orderData.order.amount,
                        offer_price: orderData.order.amount,
                        quantity: 1,
                        type: 'physical',
                        image_url: 'https://munchtokri.com/logo.png',
                    }] : lineItemsCart,
                    line_items_total: orderData.order.amount,
                },
                notes: {
                    source: 'magic_checkout',
                    isCod: isCodRequested ? 'true' : 'false',
                    advancePaid: String(advanceAmount),
                    codBalance: String(codBalance),
                    totalOrderAmount: String(calculatedTotal),
                    ...(options?.notes || {}),
                },
                prefill: {
                    name: currentUser?.displayName || '',
                    email: currentUser?.email || '',
                    contact: currentUser?.phoneNumber || '',
                },
                theme: {
                    color: '#ef4444',
                },
                handler: async (response: {
                    razorpay_order_id: string;
                    razorpay_payment_id?: string;
                    razorpay_signature?: string;
                    method?: string;
                    status?: string;
                    payment_method?: string;
                }) => {
                    try {
                        const responseMethod = String(
                            response.method ||
                            response.payment_method ||
                            (response.razorpay_payment_id?.includes('cod') ? 'cod' : '')
                        ).toLowerCase();

                        const isCodOrder =
                            isCodRequested ||
                            selectedPaymentMethod === 'cod' ||
                            responseMethod === 'cod' ||
                            responseMethod.includes('cash') ||
                            !response.razorpay_payment_id;

                        const effectivePaymentId =
                            response.razorpay_payment_id || `cod_${response.razorpay_order_id}`;
                        const effectiveMethod = isCodOrder ? 'cod' : 'online';

                        showNotification(
                            isCodOrder ? 'Placing your Cash on Delivery order...' : 'Confirming your order...',
                            'info',
                            { title: isCodOrder ? 'Placing COD Order' : 'Completing Order' }
                        );

                        let savedOrderNumber = '';
                        let isOrderConfirmed = false;

                        // 1. Primary: Verify & save order to Firestore via backend callable with captured customer details
                        try {
                            const verifyAndSaveMagicOrder = httpsCallable(functions, 'verifyAndSaveMagicOrder');
                            const saveRes = (await verifyAndSaveMagicOrder({
                                razorpayOrderId: response.razorpay_order_id,
                                razorpayPaymentId: effectivePaymentId,
                                razorpaySignature: response.razorpay_signature || '',
                                paymentMethod: effectiveMethod,
                                isCod: isCodOrder,
                                items: formattedItems,
                                userId: currentUserId,
                                shippingDetails: capturedMagicDetails,
                            })) as {
                                data: {
                                    success: boolean;
                                    orderNumber: string;
                                    orderId: string;
                                    isExisting?: boolean;
                                };
                            };

                            if (saveRes?.data?.success && saveRes.data.orderNumber) {
                                savedOrderNumber = saveRes.data.orderNumber;
                                isOrderConfirmed = true;
                                console.log('Order verified and saved by backend function:', savedOrderNumber);
                            }
                        } catch (backendErr: any) {
                            console.warn('Backend order verification callable error, applying direct client persistence:', backendErr);
                        }

                        // 2. Fallback: Save directly to Firestore if backend function is not yet reachable or errored
                        if (!isOrderConfirmed) {
                            console.log('Running client-side order persistence fallback with captured details...');
                            const counterRef = doc(db, 'metadata', 'counters');
                            await runTransaction(db, async (transaction) => {
                                const counterDoc = await transaction.get(counterRef);
                                const currentCount = counterDoc.exists()
                                    ? (counterDoc.data()?.orderCount as number) || 10000
                                    : 10000;
                                const nextCount = currentCount + 1;
                                savedOrderNumber = `MT-${nextCount}`;

                                transaction.set(counterRef, { orderCount: nextCount }, { merge: true });

                                const newOrderRef = doc(collection(db, 'orders'));
                                const orderTotalStr = `₹${calculatedTotal.toFixed(2)}`;

                                const resolvedName =
                                    (capturedMagicDetails.fullName && capturedMagicDetails.fullName !== 'Customer')
                                        ? capturedMagicDetails.fullName
                                        : currentUser?.displayName || 'Customer';
                                const resolvedEmail =
                                    (capturedMagicDetails.email && capturedMagicDetails.email !== 'customer@munchtokri.com')
                                        ? capturedMagicDetails.email
                                        : currentUser?.email || 'customer@munchtokri.com';
                                const resolvedMobile =
                                    capturedMagicDetails.mobile || currentUser?.phoneNumber || 'N/A';
                                const resolvedAddress =
                                    capturedMagicDetails.address || 'Razorpay Magic Checkout Delivery';
                                const resolvedCity =
                                    capturedMagicDetails.city || 'Bengaluru';
                                const resolvedState =
                                    capturedMagicDetails.state || 'Karnataka';
                                const resolvedPincode =
                                    capturedMagicDetails.pincode || '560001';

                                const orderData: any = {
                                    orderNumber: savedOrderNumber,
                                    customerName: resolvedName,
                                    customerEmail: resolvedEmail,
                                    status: 'Processing',
                                    amount: orderTotalStr,
                                    date: Timestamp.now(),
                                    items: formattedItems,
                                    shippingDetails: {
                                        mobile: resolvedMobile,
                                        address: resolvedAddress,
                                        city: resolvedCity,
                                        state: resolvedState,
                                        pincode: resolvedPincode,
                                    },
                                    method: {
                                        payment: isCodOrder ? 'Cash on Delivery (20% Advance Paid)' : 'Razorpay Magic Checkout',
                                        delivery: 'Standard Delivery',
                                    },
                                    paymentDetails: {
                                        razorpayOrderId: response.razorpay_order_id,
                                        razorpayPaymentId: effectivePaymentId,
                                        razorpaySignature: response.razorpay_signature || '',
                                        method: isCodOrder ? 'cod' : effectiveMethod,
                                        isCod: isCodOrder,
                                        advancePaid: isCodOrder ? advanceAmount : calculatedTotal,
                                        codBalance: isCodOrder ? codBalance : 0,
                                        isMagicCheckout: true,
                                    },
                                };

                                if (currentUserId) {
                                    orderData.userId = currentUserId;
                                }

                                transaction.set(newOrderRef, orderData);

                                // Increment sales counts
                                for (const item of formattedItems) {
                                    const isCombo = item.category === 'Combos';
                                    const isProduct = !isCombo && item.category !== 'Custom Mix';
                                    if (isProduct || isCombo) {
                                        const colName = isCombo ? 'combos' : 'products';
                                        let targetId = item.productId || item.cartItemId || '';
                                        if (targetId.includes('_v_')) targetId = targetId.split('_v_')[0];
                                        else if (isCombo && targetId.includes('_')) targetId = targetId.split('_')[0];
                                        if (targetId) {
                                            const itemRef = doc(db, colName, targetId);
                                            transaction.set(itemRef, {
                                                salesCount: increment(item.quantity || 1)
                                            }, { merge: true });
                                        }
                                    }
                                }
                            });
                            isOrderConfirmed = true;
                            console.log('Order saved directly to Firestore via client fallback:', savedOrderNumber);
                        }

                        tracker.track('purchase_complete', {
                            orderNumber: savedOrderNumber,
                            amount: calculatedTotal,
                            isMagicCheckout: true,
                            itemCount: formattedItems.length,
                        });

                        clearCart();
                        setIsLoading(false);
                        router.push(`/checkout/success?orderNumber=${savedOrderNumber}`);
                    } catch (saveErr: any) {
                        console.error('Magic Checkout Order Save Error:', saveErr);
                        setIsLoading(false);
                        showNotification(
                            `Payment completed (ID: ${response.razorpay_payment_id}), but order confirmation encountered an issue. Our team is processing it. Contact support if needed.`,
                            'warning',
                            { title: 'Order Confirmation Notice' }
                        );
                    }
                },
                modal: {
                    ondismiss: () => {
                        setIsLoading(false);
                        tracker.track('payment_cancel', {
                            amount: calculatedTotal,
                            reason: 'User closed Magic Checkout popup',
                        });
                    },
                },
            };

            const RazorpayClass = (window as any).Razorpay;
            if (!RazorpayClass) {
                showNotification('Razorpay SDK unavailable. Please refresh and try again.', 'error');
                setIsLoading(false);
                return;
            }

            const rzpInstance = new RazorpayClass(rzpOptions);

            // Listen to Magic Checkout analytics and address selection events to capture real customer delivery details
            rzpInstance.on('mx-analytics', (data: any) => {
                try {
                    if (!data) return;
                    console.log('Magic Checkout mx-analytics event:', data?.event, data);

                    // 0. Detect Payment Method
                    const methodCand = String(
                        data.payment_method ||
                        data.method ||
                        data.type ||
                        data.payment_type ||
                        ''
                    ).toLowerCase();

                    if (
                        methodCand === 'cod' ||
                        methodCand.includes('cash') ||
                        data.event === 'cod_selected' ||
                        data.event === 'cod_eligible' ||
                        (data.event === 'payment_method_selected' && methodCand.includes('cod'))
                    ) {
                        selectedPaymentMethod = 'cod';
                        console.log('Customer selected Cash on Delivery (COD) in Magic Checkout');
                    } else if (methodCand && methodCand !== 'cod' && methodCand !== 'cash') {
                        selectedPaymentMethod = 'online';
                    }

                    // 1. Extract customer full name
                    const fName = data.first_name || data.address?.first_name || '';
                    const lName = data.last_name || data.address?.last_name || '';
                    const combined = [fName, lName].filter(Boolean).join(' ');
                    const nameCand = data.name || data.customer_name || data.address?.name || combined;
                    if (nameCand && typeof nameCand === 'string' && nameCand.trim() && nameCand.trim().toLowerCase() !== 'customer') {
                        capturedMagicDetails.fullName = nameCand.trim();
                    }

                    // 2. Extract mobile number
                    const phoneCand = data.phone || data.contact || data.customer_contact || data.address?.contact || data.address?.phone || '';
                    if (phoneCand && typeof phoneCand === 'string' && phoneCand.trim()) {
                        capturedMagicDetails.mobile = phoneCand.trim();
                    }

                    // 3. Extract email address
                    const emailCand = data.email || data.customer_email || data.address?.email || '';
                    if (emailCand && typeof emailCand === 'string' && emailCand.trim()) {
                        capturedMagicDetails.email = emailCand.trim();
                    }

                    // 4. Extract delivery street address
                    const addrObj = data.address || data.shipping_address || data.delivery_address || {};
                    const l1 = addrObj.line1 || data.line1 || '';
                    const l2 = addrObj.line2 || data.line2 || '';
                    const landmark = addrObj.landmark || data.landmark || '';
                    const streetCand = [l1, l2, landmark].filter(Boolean).join(', ') || addrObj.address || data.address_line || '';
                    if (streetCand && typeof streetCand === 'string' && streetCand.trim()) {
                        capturedMagicDetails.address = streetCand.trim();
                    }

                    // 5. Extract city
                    const cityCand = addrObj.city || data.city || '';
                    if (cityCand && typeof cityCand === 'string' && cityCand.trim()) {
                        capturedMagicDetails.city = cityCand.trim();
                    }

                    // 6. Extract state
                    const stateCand = addrObj.state || addrObj.state_code || data.state || data.state_code || '';
                    if (stateCand && typeof stateCand === 'string' && stateCand.trim()) {
                        capturedMagicDetails.state = stateCand.trim();
                    }

                    // 7. Extract pincode
                    const pinCand = addrObj.zipcode || addrObj.pincode || addrObj.postal_code || data.zipcode || data.pincode || data.postal_code || '';
                    if (pinCand && (typeof pinCand === 'string' || typeof pinCand === 'number') && String(pinCand).trim()) {
                        capturedMagicDetails.pincode = String(pinCand).trim();
                    }
                } catch (e) {
                    console.warn('Error extracting mx-analytics event data:', e);
                }
            });

            rzpInstance.on('payment.failed', (failRes: any) => {
                const failReason = failRes?.error?.description || 'Payment was not successful.';
                tracker.track('payment_failure', {
                    amount: calculatedTotal,
                    errorReason: failReason,
                    errorCode: failRes?.error?.code,
                });
                showNotification(failReason, 'error', { title: 'Payment Failed' });
                setIsLoading(false);
            });

            rzpInstance.open();
        } catch (err: any) {
            console.error('Failed to open Magic Checkout:', err);
            showNotification(err?.message || 'Failed to start checkout. Please try again.', 'error', {
                title: 'Checkout Error',
            });
            setIsLoading(false);
        }
    }, [cartItems, cartTotal, clearCart, router, showNotification]);

    return {
        openMagicCheckout,
        isLoading,
    };
}
