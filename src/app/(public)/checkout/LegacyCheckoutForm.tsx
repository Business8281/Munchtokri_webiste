"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useOrders, useMembership, useCustomer, updateCustomerProfile } from '@/hooks/useFirestore';
import { useCart } from '@/contexts/CartContext';
import {
    Trash2, Plus, Minus, Zap, ShoppingBag, Truck, IndianRupee,
    Star, Coins, ShieldCheck, Loader2, Sparkles, ArrowRight,
    Pencil
} from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';
import {
    SHIPPING_FREE_THRESHOLD,
    SHIPPING_RATE,
    TAX_RATE,
    getShippingCost,
    getTax,
    getOrderTotal,
} from '@/lib/constants';
import { tracker } from '@/lib/analytics/tracker';
import styles from './checkout.module.css';

const loadScript = (src: string): Promise<boolean> =>
    new Promise((resolve) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });

export default function LegacyCheckoutForm() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [userId, setUserId] = useState<string | null>(null);
    const { addOrder } = useOrders();
    const { cartItems, cartTotal, clearCart, removeFromCart, updateQuantity } = useCart();
    const { showNotification } = useNotification();

    // Promo code state
    const [promoCode, setPromoCode] = useState('');
    const [promoError, setPromoError] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
    const [discount, setDiscount] = useState(0);

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        mobile: '',
        pincode: '',
        address: '',
        city: '',
        state: 'Karnataka',
        paymentMethod: 'UPI / QR',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const stepRef = React.useRef(step);
    const isOrderPlacedRef = React.useRef(false);

    useEffect(() => {
        stepRef.current = step;
    }, [step]);

    useEffect(() => {
        const stepNames = ['Shipping', 'Delivery', 'Payment', 'Review'];
        tracker.track('checkout_start', {
            step: 1,
            stepName: 'Shipping',
            cartTotal,
            itemCount: cartItems.length
        });

        return () => {
            if (!isOrderPlacedRef.current) {
                const s = stepRef.current;
                tracker.track('checkout_abandon', {
                    lastStep: s,
                    stepName: stepNames[s - 1] || 'Unknown',
                    cartTotal,
                    itemCount: cartItems.length,
                    reasonSignal: 'User left checkout flow'
                });
            }
        };
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUserId(currentUser.uid);
                setFormData(prev => ({
                    ...prev,
                    fullName: prev.fullName || currentUser.displayName || '',
                    email: prev.email || currentUser.email || '',
                }));
            }
        });
        return () => unsubscribe();
    }, []);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (formError) setFormError('');
    };

    const validateShippingForm = (): string => {
        if (!formData.fullName.trim()) return 'Full Name is required';
        if (!formData.email.trim()) return 'Email Address is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
            return 'Please enter a valid email address';
        if (!formData.mobile.trim()) return 'Mobile Number is required';
        if (formData.mobile.replace(/\D/g, '').length < 10)
            return 'Please enter a valid 10-digit mobile number';
        if (!formData.pincode.trim()) return 'Pincode is required';
        if (!/^\d{6}$/.test(formData.pincode.trim()))
            return 'Please enter a valid 6-digit pincode';
        if (!formData.address.trim()) return 'Street Address is required';
        if (!formData.city.trim()) return 'City is required';
        return '';
    };

    // Membership & Loyalty states
    const { membership, loading: membershipLoading } = useMembership(userId);
    const [membershipConfig, setMembershipConfig] = useState<any>(null);
    const [membershipDiscount, setMembershipDiscount] = useState(0);
    const [membershipDiscountPct, setMembershipDiscountPct] = useState(0);
    const [earnedPoints, setEarnedPoints] = useState(0);
    const { customer: customerData } = useCustomer(userId);
    const [pointsToRedeem, setPointsToRedeem] = useState(0);
    const [redeemDiscount, setRedeemDiscount] = useState(0);
    const [storeSettings, setStoreSettings] = useState<any>(null);

    // Address Book states
    const [useManualAddress, setUseManualAddress] = useState(false);
    const [saveAddressToBook, setSaveAddressToBook] = useState(false);

    // Fetch live config from Firestore settings (Real-time)
    useEffect(() => {
        const unsubMembership = onSnapshot(doc(db, 'settings', 'membership'), (snap) => {
            if (snap.exists()) setMembershipConfig(snap.data());
        });

        const unsubStore = onSnapshot(doc(db, 'settings', 'store'), (snap) => {
            if (snap.exists()) setStoreSettings(snap.data());
        });

        return () => {
            unsubMembership();
            unsubStore();
        };
    }, []);

    // Ensure payment method is valid if COD is disabled
    useEffect(() => {
        if (storeSettings?.enableCOD === false && formData.paymentMethod === 'Cash on Delivery (COD)') {
            setFormData(prev => ({ ...prev, paymentMethod: 'UPI / QR' }));
        }
    }, [storeSettings, formData.paymentMethod]);

    const handleNextStep = () => {
        if (cartItems.length === 0) {
            showNotification('Please add items to your cart.', 'error', { title: 'Empty Cart' });
            router.push('/shop');
            return;
        }
        if (step === 1) {
            const error = validateShippingForm();
            if (error) {
                setFormError(error);
                tracker.track('checkout_step', {
                    step: 1,
                    stepName: 'Shipping',
                    hasValidationError: true,
                    validationError: error
                });
                return;
            }
        }
        if (step < 4) {
            const nextStep = step + 1;
            const stepNames = ['Shipping', 'Delivery', 'Payment', 'Review'];
            tracker.track('checkout_step', {
                step: nextStep,
                stepName: stepNames[nextStep - 1],
                cartTotal: effectiveSubtotal,
                itemCount: cartItems.length,
                paymentMethod: formData.paymentMethod
            });
            setStep(nextStep);
        }
    };

    // ── Wholesale & Tiered Logic ──
    const [effectiveSubtotal, setEffectiveSubtotal] = useState(cartTotal);
    const [isWholesaleActive, setIsWholesaleActive] = useState(false);

    // 1. Calculate REAL Weight (Grams) - Defined here for use in both logic and UI
    const totalGrams = useMemo(() => {
        return cartItems.reduce((acc, item) => {
            const cat = item.category?.toLowerCase();
            const isCombo = cat === 'combos' || cat === 'combo';
            const isCustomMix = cat === 'custom mix' || item.category === 'Custom Mix';

            if (isCombo && !isCustomMix) {
                // Combos use quantity * baseWeight (e.g. 2 Units * 1kg)
                // If baseWeight is 1, it means it's unit-based but weight is not set, 
                // we should try to sum the products if they exist
                let unitWeight = Number((item as any).grams) || Number((item as any).variantGrams) || Number(item.baseWeight) || 0;
                if (unitWeight <= 1 && item.products) {
                    unitWeight = item.products.reduce((s: number, p: any) => s + (p.grams || 0), 0);
                }
                if (unitWeight === 0) unitWeight = 1000; // Default to 1kg if unknown combo weight

                return acc + unitWeight * item.quantity;
            } else {
                // Flexible products and Custom Mix use quantity DIRECTLY as grams
                return acc + Number(item.quantity);
            }
        }, 0);
    }, [cartItems]);

    useEffect(() => {
        // ── Wholesale & Tiered Logic (Member-Only) ──
        const wc = membershipConfig?.wholesale || { thresholdKg: 10, pricePerKg: 350, packagingFeePer250g: 15 };

        const totalKg = totalGrams / 1000;
        const threshold = Number(wc.thresholdKg) || 10;

        // 2. Only trigger if ABOVE threshold AND threshold is valid (> 0) AND user is Member
        if (membership && threshold > 0 && totalKg >= threshold) {
            // Wholesale Math: (Total Weight in KG * Rate) + (Packaging Fee per units)
            const wholesaleRate = Number(wc.pricePerKg) || 350;
            const packagingFeeRate = Number(wc.packagingFeePer250g) || 15;
            const pkgBase = Number(membershipConfig.packagingBaseGrams) || 250;

            const rawPrice = totalKg * wholesaleRate;
            const pkgTotal = (totalGrams / pkgBase) * packagingFeeRate;

            setEffectiveSubtotal(rawPrice + pkgTotal);
            setIsWholesaleActive(true);
        } else {
            // Retail Mode: Normal cart total
            setEffectiveSubtotal(cartTotal);
            setIsWholesaleActive(false);
        }
    }, [cartItems, cartTotal, membershipConfig, membership, totalGrams]);

    // Calculate dynamic tiered membership discount & loyalty points
    useEffect(() => {
        // Reset if not member or config missing
        if (!membership || !membershipConfig) {
            setMembershipDiscount(0);
            setEarnedPoints(0);
            return;
        }

        // 1. Tiered Discounts (Member-only)
        const tiers = membershipConfig.discountTiers || [];
        // Find highest matching tier (sorted by threshold desc)
        const sortedTiers = [...tiers].sort((a, b) => b.threshold - a.threshold);
        // Use effectiveSubtotal for checking threshold
        const matchingTier = sortedTiers.find(t => effectiveSubtotal >= t.threshold);

        let pct = 0;
        if (matchingTier) {
            pct = matchingTier.percentage;
        }

        setMembershipDiscountPct(pct);
        const disc = (effectiveSubtotal * pct) / 100;
        setMembershipDiscount(disc);

        // 2. Loyalty points generation
        const ppr = membershipConfig.loyalty?.pointsPerRupee || 0;
        const baseAmount = membershipConfig.loyalty?.baseSpendingAmount || 1;

        // Only earn points if the subtotal meets the setup base amount
        const earned = effectiveSubtotal >= baseAmount
            ? Math.floor(effectiveSubtotal * ppr)
            : 0;

        setEarnedPoints(earned);

    }, [membership, membershipConfig, effectiveSubtotal]);

    // 3. Reactive Promo Coupon Calculation
    useEffect(() => {
        if (!appliedCoupon) {
            setDiscount(0);
            return;
        }

        // Auto-remove if subtotal drops below minimum required
        if (effectiveSubtotal < (appliedCoupon.minOrderValue || 0)) {
            setAppliedCoupon(null);
            setDiscount(0);
            showNotification(`Coupon removed: Minimum order of ₹${appliedCoupon.minOrderValue} required.`, 'info');
            return;
        }

        const { discountType, discountValue } = appliedCoupon;
        let calculatedDiscount = 0;
        if (discountType === 'percentage') {
            calculatedDiscount = (effectiveSubtotal * discountValue) / 100;
        } else {
            calculatedDiscount = Math.min(discountValue, effectiveSubtotal);
        }
        setDiscount(calculatedDiscount);
    }, [appliedCoupon, effectiveSubtotal]);

    // 4. Reactive Loyalty Point Deduction
    useEffect(() => {
        const valuePerPoint = membershipConfig?.loyalty?.pointsValueInRupees || 5;
        // Cap redemption if subtotal drops
        const rawRedeem = pointsToRedeem * valuePerPoint;
        setRedeemDiscount(Math.min(rawRedeem, effectiveSubtotal - (discount + membershipDiscount)));
    }, [pointsToRedeem, membershipConfig, effectiveSubtotal, discount, membershipDiscount]);

    // ── Consolitdated Math Logic ──
    const shippingCost = useMemo(() => {
        if (storeSettings && storeSettings.enableFlatRateShipping === false) return 0;

        const threshold = storeSettings?.freeShippingThreshold ?? SHIPPING_FREE_THRESHOLD;
        const rate = storeSettings?.shippingRate ?? SHIPPING_RATE;

        return effectiveSubtotal >= threshold ? 0 : rate;
    }, [effectiveSubtotal, storeSettings]);

    const codFee = useMemo(() => {
        if (formData.paymentMethod === 'Cash on Delivery (COD)' && storeSettings?.enableCOD !== false) {
            return storeSettings?.codPrice || 0;
        }
        return 0;
    }, [formData.paymentMethod, storeSettings]);

    const totalAdjustments = Number(discount) + Number(membershipDiscount) + Number(redeemDiscount);
    const discountedValue = Math.max(0, effectiveSubtotal - totalAdjustments);

    // Tax is 5% of the discounted value
    const totalTax = Math.round(discountedValue * TAX_RATE * 100) / 100;
    const cgst = Math.floor((totalTax / 2) * 100) / 100;
    const sgst = Math.round((totalTax - cgst) * 100) / 100;

    // Final Ground Total
    const orderTotal = Math.round((discountedValue + shippingCost + codFee + totalTax) * 100) / 100;
    const orderTotalStr = `₹${orderTotal.toFixed(2)}`;

    const buildOrderItems = useCallback(() =>
        cartItems.map(item => {
            let realProductId = item.productId || item.id;
            if (realProductId.includes('_v_')) {
                realProductId = realProductId.split('_v_')[0];
            } else if (item.category === 'Combos' && realProductId.includes('_')) {
                realProductId = realProductId.split('_')[0];
            }

            const orderItem: Record<string, unknown> = {
                productId: realProductId,
                cartItemId: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                baseWeight: item.baseWeight ?? 100,
                imageURL: item.imageURL ?? null,
            };
            if (item.category) orderItem.category = item.category;
            if (item.products) orderItem.products = item.products;
            if (item.variant) orderItem.variant = item.variant;
            const itemGrams = (item as any).grams || (item as any).variantGrams;
            if (itemGrams) orderItem.grams = itemGrams;
            return orderItem;
        }),
        [cartItems]);

    const buildShippingDetails = useCallback(() => ({
        mobile: formData.mobile,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
    }), [formData]);

    const handleApplyPromo = async () => {
        setPromoError('');
        if (!promoCode.trim()) return;
        try {
            const { httpsCallable } = await import('firebase/functions');
            const { functions } = await import('@/lib/firebase');
            const validateCoupon = httpsCallable(functions, 'validateCoupon');
            const result = await validateCoupon({
                code: promoCode.trim().toUpperCase(),
                subtotal: effectiveSubtotal,
            }) as { data: { valid: boolean; discountType: 'fixed' | 'percentage'; discountValue: number; minOrderValue: number } };

            const { discountType, discountValue, minOrderValue } = result.data;
            setAppliedCoupon({ discountType, discountValue, minOrderValue });

            tracker.track('coupon_apply', {
                code: promoCode.trim().toUpperCase(),
                discountType,
                discountValue,
                minOrderValue
            });

            showNotification(`Coupon applied!`, 'success', {
                title: 'Discount Applied',
            });
        } catch (err: any) {
            const msg = err?.message || 'Invalid coupon code';
            setPromoError(msg);
            setAppliedCoupon(null);
            tracker.track('coupon_error', {
                code: promoCode.trim().toUpperCase(),
                message: msg
            });
            showNotification(msg, 'error', { title: 'Coupon Error' });
        }
    };

    const autoMagicTriggeredRef = React.useRef(false);

    const handlePlaceOrder = async (isMagicDirect = false) => {
        if (isSubmitting) return; // Double-click guard
        if (!isMagicDirect && !userId) {
            showNotification('Please log in to place an order.', 'info', { title: 'Login Required' });
            router.push('/login?redirect=/checkout');
            return;
        }
        if (cartItems.length === 0) {
            showNotification('Please add items to your cart.', 'error', { title: 'Empty Cart' });
            router.push('/shop');
            return;
        }

        tracker.track('payment_initiate', {
            paymentMethod: isMagicDirect ? 'Magic Checkout (1-Click)' : formData.paymentMethod,
            amount: orderTotal
        });

        setIsSubmitting(true); // Set BEFORE any async work

        const shippingDetails = buildShippingDetails();
        const items = buildOrderItems();
        const methodDetails = {
            delivery: shippingCost > 0
                ? `Standard Delivery (₹${shippingCost})`
                : 'Standard Delivery (Free)',
            payment: isMagicDirect ? 'Razorpay Magic Checkout' : formData.paymentMethod,
        };

        const isManualEntry = !customerData?.addresses || customerData.addresses.length === 0 || useManualAddress;

        if (!isMagicDirect && isManualEntry && saveAddressToBook && userId) {
            try {
                const newAddress = {
                    id: Date.now().toString(),
                    label: 'Other',
                    fullName: formData.fullName,
                    mobile: formData.mobile,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    pincode: formData.pincode,
                    isDefault: (!customerData?.addresses || customerData.addresses.length === 0)
                };
                const newAddresses = [...(customerData?.addresses || []), newAddress];
                await updateCustomerProfile(userId, { addresses: newAddresses });
            } catch (error) {
                console.error("Failed to save address to book:", error);
            }
        }

        if (!isMagicDirect && formData.paymentMethod === 'Cash on Delivery (COD)') {
            try {
                const result = await addOrder({
                    userId: userId || undefined,
                    customerName: formData.fullName || 'Guest',
                    customerEmail: formData.email,
                    status: 'Processing',
                    amount: orderTotalStr,
                    shippingDetails,
                    method: methodDetails,
                    items: items as never,
                    date: null,
                    codPrice: codFee > 0 ? codFee : undefined,
                    couponCode: discount > 0 ? promoCode.trim().toUpperCase() : undefined,
                    discount: discount > 0 ? discount : undefined,
                    membershipDiscount: membershipDiscount > 0 ? membershipDiscount : undefined,
                    earnedPoints: earnedPoints,
                    redeemedPoints: redeemDiscount > 0 ? pointsToRedeem : undefined,
                    redeemDiscount: redeemDiscount > 0 ? redeemDiscount : undefined,
                });

                isOrderPlacedRef.current = true;
                tracker.track('purchase_complete', {
                    orderNumber: result.orderNumber,
                    amount: orderTotal,
                    paymentMethod: 'Cash on Delivery (COD)',
                    isCod: true,
                    itemCount: items.length
                });

                clearCart();
                router.push(`/checkout/success?orderNumber=${result.orderNumber}`);
            } catch (err) {
                console.error('Failed to place COD order:', err);
                showNotification('Failed to place order. Please try again.', 'error', {
                    title: 'Order Error',
                });
                setIsSubmitting(false);
            }
            return;
        }

        // ── Online Payment (Razorpay Magic Checkout) ─────────────────────────
        try {
            const loaded =
                (await loadScript('https://checkout.razorpay.com/v1/magic-checkout.js')) ||
                (await loadScript('https://checkout.razorpay.com/v1/checkout.js'));
            if (!loaded) {
                showNotification('Payment gateway failed to load. Check your internet.', 'error', {
                    title: 'Network Error',
                });
                setIsSubmitting(false);
                return;
            }

            const { httpsCallable } = await import('firebase/functions');
            const { functions } = await import('@/lib/firebase');

            const createPayOrder = httpsCallable(functions, 'createPayOrder');
            const response = await createPayOrder({ amount: orderTotal }) as {
                data: { success: boolean; order?: { id: string; amount: number; currency: string }; message?: string };
            };

            const orderData = response.data;
            if (!orderData?.success || !orderData.order?.id) {
                showNotification(
                    orderData?.message ?? 'Failed to create payment order.',
                    'error',
                    { title: 'Server Error' }
                );
                setIsSubmitting(false);
                return;
            }

            const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
            if (!razorpayKey) {
                showNotification('Payment configuration missing. Contact support.', 'error', {
                    title: 'Config Error',
                });
                setIsSubmitting(false);
                return;
            }

            const options = {
                key: razorpayKey,
                amount: orderData.order.amount,
                currency: orderData.order.currency,
                name: 'Munch Tokri',
                description: 'Order Payment',
                order_id: orderData.order.id,
                one_click_checkout: true,
                handler: async (razorpayResponse: {
                    razorpay_order_id: string;
                    razorpay_payment_id: string;
                    razorpay_signature: string;
                }) => {
                    try {
                        // ── STEP 1: Verify signature on backend before saving order ──
                        const verifyPayment = httpsCallable(functions, 'verifyPayment');
                        const verifyResult = await verifyPayment({
                            razorpay_order_id: razorpayResponse.razorpay_order_id,
                            razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                            razorpay_signature: razorpayResponse.razorpay_signature,
                        }) as { data: { status: string } };

                        if (verifyResult.data?.status !== 'success') {
                            tracker.track('payment_failure', {
                                paymentMethod: 'UPI / QR',
                                amount: orderTotal,
                                errorReason: 'Backend signature verification failed'
                            });
                            showNotification(
                                'Payment verification failed. Contact support with your payment ID.',
                                'error',
                                { title: 'Verification Failed' }
                            );
                            setIsSubmitting(false);
                            return;
                        }

                        tracker.track('payment_success', {
                            paymentMethod: 'UPI / QR',
                            amount: orderTotal,
                            razorpayOrderId: razorpayResponse.razorpay_order_id,
                            razorpayPaymentId: razorpayResponse.razorpay_payment_id
                        });

                        // ── STEP 2: Save order only after verified ───────────────────
                        const result = await addOrder({
                            userId: userId || undefined,
                            customerName: formData.fullName || 'Guest',
                            customerEmail: formData.email,
                            status: 'Processing',
                            amount: orderTotalStr,
                            shippingDetails,
                            method: methodDetails,
                            items: items as never,
                            date: null,
                            codPrice: codFee > 0 ? codFee : undefined,
                            couponCode: discount > 0 ? promoCode.trim().toUpperCase() : undefined,
                            discount: discount > 0 ? discount : undefined,
                            membershipDiscount: membershipDiscount > 0 ? membershipDiscount : undefined,
                            earnedPoints: earnedPoints,
                            redeemedPoints: redeemDiscount > 0 ? pointsToRedeem : undefined,
                            redeemDiscount: redeemDiscount > 0 ? redeemDiscount : undefined,
                            paymentDetails: {
                                razorpayOrderId: razorpayResponse.razorpay_order_id,
                                razorpayPaymentId: razorpayResponse.razorpay_payment_id,
                                razorpaySignature: razorpayResponse.razorpay_signature,
                            },
                        });

                        isOrderPlacedRef.current = true;
                        tracker.track('purchase_complete', {
                            orderNumber: result.orderNumber,
                            amount: orderTotal,
                            paymentMethod: 'UPI / QR',
                            isCod: false,
                            itemCount: items.length
                        });

                        clearCart();
                        router.push(`/checkout/success?orderNumber=${result.orderNumber}`);
                    } catch (saveErr) {
                        console.error('Order save failed after payment:', saveErr);
                        tracker.track('payment_failure', {
                            paymentMethod: 'UPI / QR',
                            amount: orderTotal,
                            errorReason: 'Order record save failed after payment authorization'
                        });
                        showNotification(
                            `Payment successful (ID: ${razorpayResponse.razorpay_payment_id}) but order save failed. Please contact support.`,
                            'error',
                            { title: 'Order Save Failed' }
                        );
                        setIsSubmitting(false);
                    }
                },
                prefill: {
                    name: formData.fullName || 'Guest',
                    email: formData.email,
                    contact: formData.mobile || '',
                },
                theme: { color: '#ef4444' },
                modal: {
                    ondismiss: () => {
                        setIsSubmitting(false);
                        tracker.track('payment_cancel', {
                            paymentMethod: 'UPI / QR',
                            amount: orderTotal,
                            reason: 'User closed payment popup'
                        });
                        showNotification('Payment cancelled. You can try again.', 'info', {
                            title: 'Payment Cancelled',
                        });
                    },
                },
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const RazorpayClass = (window as any).Razorpay;
            const paymentObject = new RazorpayClass(options);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            paymentObject.on('payment.failed', (r: any) => {
                const failReason = r?.error?.description || 'Payment failed';
                tracker.track('payment_failure', {
                    paymentMethod: 'UPI / QR',
                    amount: orderTotal,
                    errorReason: failReason,
                    errorCode: r?.error?.code
                });
                showNotification('Payment failed. ' + failReason, 'error', {
                    title: 'Payment Failed',
                });
                setIsSubmitting(false);
            });
            paymentObject.open();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to initiate payment.';
            console.error('Payment initiation error:', err);
            tracker.track('payment_failure', {
                paymentMethod: formData.paymentMethod,
                amount: orderTotal,
                errorReason: msg
            });
            showNotification(msg, 'error', { title: 'Payment Error' });
            setIsSubmitting(false);
        }
    };

    // Auto-launch Magic Checkout if arriving via ?magic=1
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('magic') === '1' && cartItems.length > 0 && orderTotal > 0 && !autoMagicTriggeredRef.current) {
            autoMagicTriggeredRef.current = true;
            const timer = setTimeout(() => {
                handlePlaceOrder(true);
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [cartItems.length, orderTotal]);

    // ── Helper: combo vs regular quantity step ───────────────────────────
    const isComboItem = (item: typeof cartItems[0]) => {
        const cat = item.category?.toLowerCase();
        return cat === 'combos' || cat === 'combo' || item.baseWeight === 1;
    };

    const isCustomMixItem = (item: typeof cartItems[0]) => {
        const cat = item.category?.toLowerCase();
        return cat === 'custom mix' || item.name.startsWith('Custom Mix (');
    };

    const getStep = (item: typeof cartItems[0]) => {
        if (isComboItem(item)) return 1;
        if (isCustomMixItem(item)) return 50;
        return item.baseWeight || 100;
    };

    const renderPriceRow = (
        label: string,
        value: string | number | React.ReactNode,
        icon?: React.ReactNode,
        color?: string,
        isBold?: boolean,
        isNegative?: boolean
    ) => (
        <div className={styles.priceRow} style={{ color: color || 'inherit', fontWeight: isBold ? 700 : 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ opacity: 0.6 }}>{icon}</span>
                <span>{label}</span>
            </div>
            <span style={{ fontWeight: 600 }}>{isNegative ? '-' : ''} {typeof value === 'number' ? `₹${value.toFixed(2)}` : value}</span>
        </div>
    );

    return (
        <div className={styles.checkoutContainer}>
            <div className={styles.grid}>
                {/* Left Column */}
                <div className={styles.mainContent}>
                    {/* Stepper */}
                    <nav className={styles.stepperNav}>
                        {['Shipping', 'Delivery', 'Payment', 'Review'].map((label, i) => (
                            <div
                                key={label}
                                className={`${styles.step} ${step >= i + 1 ? styles.stepActive : ''}`}
                            >
                                <span
                                    className={`${styles.stepIcon} ${step >= i + 1 ? styles.stepIconActive : ''}`}
                                >
                                    {i + 1}
                                </span>
                                <span
                                    className={`${styles.stepLabel} ${step >= i + 1 ? styles.stepLabelActive : ''}`}
                                >
                                    {label}
                                </span>
                            </div>
                        ))}
                    </nav>

                    {/* Step 1: Shipping */}
                    {step === 1 && (
                        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className={styles.sectionHeader}>
                                <h2>Shipping Address</h2>
                                <p>Please enter your accurate delivery details below.</p>
                            </div>

                            {customerData?.addresses && customerData.addresses.length > 0 && !useManualAddress && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <h4 style={{ marginBottom: '1rem', color: '#334155' }}>Select from Saved Addresses</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                                        {customerData.addresses.map(addr => (
                                            <div
                                                key={addr.id}
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        fullName: addr.fullName,
                                                        mobile: addr.mobile,
                                                        address: addr.address,
                                                        city: addr.city,
                                                        state: addr.state,
                                                        pincode: addr.pincode
                                                    }));
                                                    setFormError('');
                                                }}
                                                style={{
                                                    padding: '1rem',
                                                    border: formData.address === addr.address && formData.mobile === addr.mobile ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                                                    borderRadius: '0.5rem',
                                                    cursor: 'pointer',
                                                    backgroundColor: formData.address === addr.address && formData.mobile === addr.mobile ? '#f0fdf4' : 'white'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <strong style={{ color: '#1e293b' }}>{addr.label}</strong>
                                                    {addr.isDefault && <span style={{ fontSize: '0.7rem', backgroundColor: '#e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '1rem' }}>Default</span>}
                                                </div>
                                                <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{addr.fullName}</p>
                                                <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', color: '#000' }}>{addr.address}</p>
                                                <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', color: '#000' }}>{addr.city}, {addr.state} {addr.pincode}</p>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#000' }}>Phone: {addr.mobile}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setUseManualAddress(true);
                                            setFormData(prev => ({ ...prev, address: '', city: '', state: '', pincode: '' }));
                                        }}
                                        style={{ marginTop: '1rem', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                    >
                                        + Enter a new address
                                    </button>
                                </div>
                            )}

                            {(!customerData?.addresses || customerData.addresses.length === 0 || useManualAddress) && (
                                <>
                                    {customerData?.addresses && customerData.addresses.length > 0 && (
                                        <button
                                            onClick={() => setUseManualAddress(false)}
                                            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: '-0.5rem' }}
                                        >
                                            ← Back to saved addresses
                                        </button>
                                    )}
                                    <div className={styles.formGrid}>
                                        <div className={`${styles.inputGroup} ${styles.inputGroupFull}`}>
                                            <label className={styles.inputLabel}>Full Name</label>
                                            <input className={styles.inputField} name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="Arjun Sharma" type="text" />
                                        </div>
                                        <div className={`${styles.inputGroup} ${styles.inputGroupFull}`}>
                                            <label className={styles.inputLabel}>Email Address</label>
                                            <input className={styles.inputField} name="email" value={formData.email} onChange={handleInputChange} placeholder="arjun@example.com" type="email" />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Mobile Number</label>
                                            <div className={styles.inputRelative}>
                                                <span className={styles.inputPrefix}>+91</span>
                                                <input className={`${styles.inputField} ${styles.inputWithPrefix}`} name="mobile" value={formData.mobile} onChange={handleInputChange} placeholder="98765 43210" type="tel" maxLength={10} />
                                            </div>
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Pincode</label>
                                            <input className={styles.inputField} name="pincode" value={formData.pincode} onChange={handleInputChange} placeholder="560001" type="text" maxLength={6} />
                                        </div>
                                        <div className={`${styles.inputGroup} ${styles.inputGroupFull}`}>
                                            <label className={styles.inputLabel}>Street Address / Landmark</label>
                                            <input className={styles.inputField} name="address" value={formData.address} onChange={handleInputChange} placeholder="House No, Street, Locality..." type="text" />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>City</label>
                                            <input className={styles.inputField} name="city" value={formData.city} onChange={handleInputChange} placeholder="Bengaluru" type="text" />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>State</label>
                                            <select className={styles.inputField} name="state" value={formData.state} onChange={handleInputChange}>
                                                {['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'].map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                                <option disabled>── Union Territories ──</option>
                                                {['Andaman and Nicobar Islands', 'Chandigarh', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'].map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {userId && (!customerData?.addresses || customerData.addresses.length === 0 || useManualAddress) && (
                                        <div style={{ marginTop: '0.5rem', gridColumn: '1 / -1' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#000', fontSize: '0.9rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={saveAddressToBook}
                                                    onChange={(e) => setSaveAddressToBook(e.target.checked)}
                                                    style={{ width: '1rem', height: '1rem', accentColor: 'var(--primary)' }}
                                                />
                                                Save this address to my Address Book for future use
                                            </label>
                                        </div>
                                    )}
                                </>
                            )}
                            {formError && (
                                <div style={{ color: '#ef4444', fontSize: '0.875rem', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '0.375rem', border: '1px solid #fecaca' }}>
                                    {formError}
                                </div>
                            )}
                            <div className={styles.actions}>
                                <button className={styles.submitBtn} onClick={handleNextStep}>
                                    <span>Continue to Delivery</span><span>→</span>
                                </button>
                            </div>
                        </section>
                    )}

                    {/* Step 2: Delivery */}
                    {step === 2 && (
                        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className={styles.sectionHeader}>
                                <h2>Delivery Priority</h2>
                                <p>Standard delivery across India.</p>
                            </div>
                            <div className={styles.formGrid}>
                                <div className={styles.inputGroupFull} style={{ padding: '1rem', border: '2px solid var(--primary)', borderRadius: '0.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: 0 }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ margin: 0, fontWeight: 700 }}>Standard Delivery</h4>
                                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#000' }}>Estimated 3–5 business days</p>
                                        </div>
                                        <span style={{ fontWeight: 700 }}>
                                            {shippingCost === 0 ? 'FREE' : `₹${shippingCost}`}
                                        </span>
                                    </label>
                                </div>
                            </div>
                            <div className={styles.actions} style={{ display: 'flex', gap: '1rem' }}>
                                <button className={styles.submitBtn} style={{ backgroundColor: 'transparent', color: 'var(--primary)', border: '2px solid var(--primary)' }} onClick={() => setStep(1)}>Back</button>
                                <button className={styles.submitBtn} onClick={handleNextStep}>Continue to Payment →</button>
                            </div>
                        </section>
                    )}

                    {/* Step 3: Payment */}
                    {step === 3 && (
                        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className={styles.sectionHeader}>
                                <h2>Payment Method</h2>
                                <p>Select how you would like to pay.</p>
                            </div>
                            <div className={styles.formGrid}>
                                {(['UPI / QR', 'Cash on Delivery (COD)'] as const)
                                    .filter(method => method !== 'Cash on Delivery (COD)' || storeSettings?.enableCOD !== false)
                                    .map(method => (
                                        <div key={method} className={styles.inputGroupFull} style={{ padding: '1rem', border: formData.paymentMethod === method ? '2px solid var(--primary)' : '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', margin: 0 }}>
                                                <input type="radio" name="paymentMethod" value={method} checked={formData.paymentMethod === method} onChange={handleInputChange} style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--primary)' }} />
                                                <div>
                                                    <h4 style={{ margin: 0, fontWeight: 700 }}>{method}</h4>
                                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#000' }}>
                                                        {method === 'UPI / QR' ? 'Pay via Google Pay, PhonePe, Paytm & more' : 'Pay when you receive the order 30Rs Shipping fee will be added'}
                                                    </p>
                                                </div>
                                            </label>
                                        </div>
                                    ))}
                            </div>
                            <div className={styles.actions} style={{ display: 'flex', gap: '1rem' }}>
                                <button className={styles.submitBtn} style={{ backgroundColor: 'transparent', color: 'var(--primary)', border: '2px solid var(--primary)' }} onClick={() => setStep(2)}>Back</button>
                                <button className={styles.submitBtn} onClick={handleNextStep}>Review Order →</button>
                            </div>
                        </section>
                    )}

                    {/* Step 4: Review */}
                    {step === 4 && (
                        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className={styles.sectionHeader}>
                                <h2>Review Your Order</h2>
                                <p>Confirm your details before placing the order.</p>
                            </div>
                            <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 1rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>Shipping To</h4>
                                <p style={{ margin: '0 0 0.5rem', fontWeight: 'bold' }}>{formData.fullName}</p>
                                <p style={{ margin: '0 0 0.5rem', color: '#000' }}>{formData.address}, {formData.city}, {formData.state} {formData.pincode}</p>
                                <p style={{ margin: 0, color: '#000' }}>+91 {formData.mobile}</p>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ margin: '0 0 0.5rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>Delivery</h4>
                                    <p style={{ margin: 0, color: '#000' }}>Standard ({shippingCost === 0 ? 'Free' : `₹${shippingCost}`})</p>
                                </div>
                                <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ margin: '0 0 0.5rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>Payment</h4>
                                    <p style={{ margin: 0, color: '#000' }}>{formData.paymentMethod}</p>
                                </div>
                            </div>
                            <div className={styles.actions} style={{ display: 'flex', gap: '1rem' }}>
                                <button className={styles.submitBtn} style={{ backgroundColor: 'transparent', color: 'var(--primary)', border: '2px solid var(--primary)' }} onClick={() => setStep(3)} disabled={isSubmitting}>Back</button>
                                <button className={styles.submitBtn} onClick={() => handlePlaceOrder(false)} disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <><Loader2 className="animate-spin" size={18} /> Processing...</>
                                    ) : (
                                        <><ShieldCheck size={18} /> Place Order</>
                                    )}
                                </button>
                            </div>
                        </section>
                    )}
                </div>

                {/* Right Column: Order Summary */}
                <aside className={styles.sidebar}>
                    <div className={styles.orderSummaryBox}>
                        <div className={styles.summaryHeader}>
                            <h2>Order Summary</h2>
                            <span className={styles.itemBadge}>{cartItems.length} Items</span>
                        </div>

                        <div className={styles.productList}>
                            {cartItems.map((item) => {
                                const step = getStep(item);
                                const combo = isComboItem(item);
                                const comboGrams = (item as any).grams || (item as any).variantGrams || (item.products?.reduce((s: number, p: any) => s + (Number(p.grams) || 0), 0) || 0);
                                const unitDisplay = isComboItem(item)
                                    ? `${item.quantity} Pack${item.quantity > 1 ? 's' : ''}${comboGrams > 0 ? ` (${comboGrams * item.quantity}g)` : ''}`
                                    : isCustomMixItem(item) 
                                        ? `${item.quantity}g` 
                                        : `${item.quantity / (item.baseWeight || 100)} (${item.quantity}g)`;

                                // Proper pricing calculation
                                const itemTotal = (item.price / (item.baseWeight || 100)) * item.quantity;
                                return (
                                    <div key={item.id} className={styles.productItem}>
                                        <div className={styles.productImageWrapper}>
                                            <img src={item.imageURL || '/logo.png'} alt={item.name} onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }} />
                                        </div>
                                        <div className={styles.productDetails} style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.85rem', fontWeight: 700, maxWidth: '80%', flex: 1 }}>{item.name}</h4>
                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                    {isCustomMixItem(item) && (
                                                        <button
                                                            onClick={() => router.push(`/build-mixture?edit=${item.id}`)}
                                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0.25rem' }}
                                                            title="Edit Mix"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }} title="Remove">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {item.products && item.products.length > 0 && (
                                                <div style={{ margin: '0.35rem 0 0.5rem', padding: '0.4rem 0.6rem', background: '#f8fafc', borderLeft: '3px solid #0d9488', borderRadius: '4px' }}>
                                                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.72rem', fontWeight: 700, color: '#0f766e' }}>
                                                        Pack of {item.products.length} includes:
                                                    </p>
                                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.72rem', color: '#334155', lineHeight: 1.4 }}>
                                                        {item.products.map((p: any, i: number) => (
                                                            <li key={i} style={{ marginBottom: '0.15rem' }}>
                                                                <span style={{ color: '#0d9488', fontWeight: 'bold' }}>• </span>
                                                                <span style={{ fontWeight: 600 }}>{p.name}</span> <span style={{ color: '#64748b' }}>({p.grams || 0}g)</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                {isCustomMixItem(item) ? (
                                                    <span style={{ fontSize: '0.9rem', color: '#000', fontWeight: 700 }}>{unitDisplay}</span>
                                                ) : (
                                                    <div className={styles.qtyControls}>
                                                        <button
                                                            className={styles.qtyBtn}
                                                            onClick={() => updateQuantity(item.id, item.quantity - step)}
                                                            disabled={item.quantity <= step}
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                        <span className={styles.qtyValue}>{unitDisplay}</span>
                                                        <button
                                                            className={styles.qtyBtn}
                                                            onClick={() => updateQuantity(item.id, item.quantity + step)}
                                                            disabled={item.quantity >= (item.maxStock || (item.category === 'Combos' ? 50 : 20000))}
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                                <p style={{ margin: 0, fontWeight: 600 }}>₹{itemTotal.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {cartItems.length === 0 && (
                                <p style={{ color: '#000', textAlign: 'center', margin: '2rem 0' }}>Your cart is empty.</p>
                            )}
                        </div>

                        {/* Price Breakdown */}
                        <div className={styles.priceBreakdown}>
                            {renderPriceRow('Subtotal', cartTotal, <ShoppingBag size={14} />, undefined, false, false)}

                            {isWholesaleActive && membershipConfig?.wholesale && (
                                <div style={{ backgroundColor: '#f0fdf4', padding: '0.75rem', borderRadius: '0.4rem', marginBottom: '0.5rem', border: '1px dashed #22c55e' }}>
                                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wholesale Pricing Applied</h4>
                                    <div className={styles.priceRow} style={{ fontSize: '0.85rem', marginBottom: '0.25rem', color: '#166534' }}>
                                        <span>Total Weight</span>
                                        <span style={{ fontWeight: 600 }}>{(totalGrams / 1000).toFixed(2)} KG</span>
                                    </div>
                                    <div className={styles.priceRow} style={{ fontSize: '0.9rem', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #dcfce7', fontWeight: 'bold', color: '#166534' }}>
                                        <span>Corrected Subtotal</span>
                                        <span>₹{effectiveSubtotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            {membershipDiscount > 0 && renderPriceRow(`Club Discount (${membershipDiscountPct}%)`, membershipDiscount, <Star size={14} />, 'var(--primary)', true, true)}
                            {discount > 0 && renderPriceRow('Promo Code', discount, <Zap size={14} />, '#16a34a', true, true)}
                            {redeemDiscount > 0 && renderPriceRow(`${pointsToRedeem === 1 ? 'Coin' : 'Coins'} Redeemed`, redeemDiscount, <Coins size={14} />, '#eb5a3c', true, true)}

                            {renderPriceRow('Shipping', (shippingCost === 0 ? <span className={styles.freeText}>FREE</span> : shippingCost), <Truck size={14} />)}
                            {codFee > 0 && renderPriceRow('COD Extra Charge', codFee, <Coins size={14} />)}
                            {renderPriceRow('Tax (CGST + SGST)', (cgst + sgst), <IndianRupee size={14} />)}

                            <div className={styles.totalRow}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <ShieldCheck size={20} className="text-[var(--primary)]" />
                                    <span>Grand Total</span>
                                </div>
                                <span>₹{orderTotal.toFixed(2)}</span>
                            </div>

                            {earnedPoints > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--primary-light, #f0fdfa)', padding: '0.5rem', borderRadius: '0.5rem', marginTop: '0.5rem', border: '1px solid rgba(0, 128, 128, 0.1)' }}>
                                    <Sparkles size={14} className="text-[var(--primary)]" />
                                    <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>You'll earn {earnedPoints} {earnedPoints === 1 ? 'Coin' : 'Coins'} on this order!</span>
                                </div>
                            )}
                        </div>

                        <div className={styles.trustIndicators}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: '#16a34a', fontSize: '1.2rem' }}>🔒</span>
                                    <h4 style={{ margin: 0, fontWeight: 'bold' }}>100% Secure Checkout</h4>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#000' }}>256-bit encryption • Verified by Razorpay</p>
                            </div>
                            <div className={styles.returnPolicy}>
                                <span>ℹ️</span> Free returns within 7 days of delivery
                            </div>
                        </div>

                        {/* Redemption Section */}
                        {customerData && (customerData.loyaltyPoints || 0) > 0 && (
                            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.75rem', border: '1px solid #bbf7d0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <Zap size={16} fill="var(--primary)" color="var(--primary)" />
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#166534' }}>
                                        You have {(customerData.loyaltyPoints || 0).toLocaleString()} Coins!
                                    </p>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#166534', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
                                    1 Coin = ₹{membershipConfig?.loyalty?.pointsValueInRupees || 5} discount.
                                    {membershipConfig?.loyalty?.minRedeemPoints > 1 && ` Min redemption: ${membershipConfig.loyalty.minRedeemPoints}.`}
                                </p>

                                {redeemDiscount > 0 ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>
                                            Applied {pointsToRedeem} Coins
                                        </p>
                                        <button
                                            onClick={() => { setRedeemDiscount(0); setPointsToRedeem(0); }}
                                            style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <input
                                            type="number"
                                            placeholder="Points..."
                                            style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                            defaultValue={customerData.loyaltyPoints}
                                            id="pointsInput"
                                        />
                                        <button
                                            onClick={() => {
                                                const val = Number((document.getElementById('pointsInput') as HTMLInputElement).value) || 0;
                                                const min = membershipConfig?.loyalty?.minRedeemPoints || 1;
                                                if (val < min) {
                                                    showNotification(`Minimum ${min} coins required to redeem.`, 'error');
                                                    return;
                                                }
                                                if (val > (customerData.loyaltyPoints || 0)) {
                                                    showNotification("You don't have enough coins.", 'error');
                                                    return;
                                                }
                                                const valuePerPoint = membershipConfig?.loyalty?.pointsValueInRupees || 5;
                                                setPointsToRedeem(val);
                                                showNotification(`Redeemed ${val} coins!`, 'success');
                                            }}
                                            style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Promo Code */}
                        <div className={styles.promoCodeArea}>
                            <input
                                className={styles.promoInput}
                                placeholder="Promo code"
                                type="text"
                                value={promoCode}
                                onChange={e => { setPromoCode(e.target.value); setPromoError(''); }}
                                onKeyDown={e => e.key === 'Enter' && handleApplyPromo()}
                            />
                            <button className={styles.promoBtn} onClick={handleApplyPromo}>
                                Apply
                            </button>
                        </div>
                        {promoError && (
                            <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                                {promoError}
                            </p>
                        )}
                        {discount > 0 && (
                            <p style={{ color: '#16a34a', fontSize: '0.8rem', marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                                ✓ Coupon applied — saving ₹{discount.toFixed(2)}
                            </p>
                        )}
                    </div>
                </aside>
            </div>

            {/* Mobile Footer */}
            <div className={styles.mobileFooter}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <p className={styles.mobileTotalLabel}>Ground Total</p>
                    <p className={styles.mobileTotalValue}>₹{orderTotal.toFixed(2)}</p>
                </div>
                <button className={styles.mobileNextBtn} onClick={step < 4 ? handleNextStep : () => handlePlaceOrder(false)} disabled={isSubmitting}>
                    {isSubmitting ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Loader2 className="animate-spin" size={18} />
                            <span>Processing</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {step < 4 ? <ArrowRight size={18} /> : <ShieldCheck size={18} />}
                            <span>{step < 4 ? 'Next Step' : 'Place Order'}</span>
                        </div>
                    )}
                </button>
            </div>
        </div>
    );
}
