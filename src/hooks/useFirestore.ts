import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    onSnapshot,
    orderBy,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp,
    where,
    runTransaction,
    getDocs,
    limit,
    increment,
    getDoc,
    serverTimestamp,
    onSnapshotsInSync
} from 'firebase/firestore';
import { db as defaultDb } from '@/lib/firebase';
import { useFirebase } from '@/contexts/FirebaseContext';
import { Product, Combo, Review, OrderItem, Order, Customer, Coupon, Membership } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────
// Moved to @/types

// ── Helpers ────────────────────────────────────────────────────────────────

function parseBaseWeight(stockVal: unknown): number {
    if (typeof stockVal === 'number') return stockVal > 0 ? stockVal : 100;
    if (typeof stockVal === 'string') {
        const match = stockVal.match(/(\d+)/);
        if (match) {
            const val = parseInt(match[1], 10);
            return stockVal.toLowerCase().includes('kg') ? val * 1000 : val;
        }
    }
    return 100;
}

function dateToMillis(date: Timestamp | null | undefined | string | number): number {
    if (!date) return 0;
    if (typeof (date as Timestamp).toMillis === 'function') {
        return (date as Timestamp).toMillis();
    }
    const ms = new Date(date as string | number).getTime();
    return isNaN(ms) ? 0 : ms;
}

// ── useProducts ────────────────────────────────────────────────────────────

export const useProducts = () => {
    const { db } = useFirebase();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const qProducts = query(collection(db, 'products'), orderBy('name'));
        const qReviews = query(collection(db, 'reviews'));

        let productsData: Product[] = [];
        let reviewsData: any[] = [];

        const updateState = () => {
            // Identify top selling products for Best Seller badge (top 5 with sales > 0)
            const sortedBySales = [...productsData].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
            const topSalesThreshold = sortedBySales.length > 5 ? (sortedBySales[4].salesCount || 0) : 0;
            const topSellingIds = sortedBySales
                .filter(p => (p.salesCount || 0) > 0 && (p.salesCount || 0) >= topSalesThreshold)
                .slice(0, 5)
                .map(p => p.id);

            const aggregated = productsData.map(product => {
                const productReviews = reviewsData.filter(r => {
                    const rId = r.productId || r.productID;
                    if (!rId || !product.id) return false;
                    const match = String(rId).trim() === String(product.id).trim();
                    return match;
                });
                
                if (productReviews.length > 0) {
                    console.log(`[Sync] Found ${productReviews.length} reviews for ${product.name} (${product.id})`);
                }
                
                const numReviews = productReviews.length;
                let avgRating = 0;
                
                if (numReviews > 0) {
                    const sum = productReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
                    avgRating = Math.round((sum / numReviews) * 10) / 10;
                }

                return {
                    ...product,
                    avgRating: numReviews > 0 ? avgRating : (product.avgRating || 0),
                    numReviews: numReviews,
                    isBestSeller: topSellingIds.includes(product.id)
                };
            });
            setProducts(aggregated);
            setLoading(false);
        };

        const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
            productsData = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                const stockVal = data.stock ?? '';
                return {
                    id: docSnap.id,
                    ...data,
                    name: data.name ?? '',
                    price: data.price ?? 0,
                    category: data.category ?? '',
                    stock: typeof stockVal === 'string' ? stockVal : String(stockVal),
                    baseWeight: parseBaseWeight(stockVal),
                    stockStr: typeof stockVal === 'string' ? stockVal : `${stockVal}g`,
                } as Product;
            });
            updateState();
        });

        const unsubscribeReviews = onSnapshot(qReviews, (snapshot) => {
            reviewsData = snapshot.docs.map(docSnap => docSnap.data());
            updateState();
        });

        return () => {
            unsubscribeProducts();
            unsubscribeReviews();
        };
    }, [db]);

    const addProduct = useCallback(
        async (product: Omit<Product, 'id'>) => {
            await addDoc(collection(db, 'products'), product);
        },
        [db]
    );

    const updateProduct = useCallback(
        async (id: string, updates: Partial<Product>) => {
            await updateDoc(doc(db, 'products', id), updates);
        },
        [db]
    );

    const deleteProduct = useCallback(
        async (id: string) => {
            await deleteDoc(doc(db, 'products', id));
        },
        [db]
    );

    return { products, loading, addProduct, updateProduct, deleteProduct };
};

// ── useReviews ─────────────────────────────────────────────────────────────

export const useReviews = (productId: string) => {
    const { db } = useFirebase();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ averageRating: 0, totalReviews: 0 });

    useEffect(() => {
        if (!productId) {
            setLoading(false);
            return;
        }

        // Use composite index: productId + createdAt desc (defined in firestore.indexes.json)
        const q = query(
            collection(db, 'reviews'),
            where('productId', '==', productId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const items: Review[] = snapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                } as Review));

                setReviews(items);

                if (items.length > 0) {
                    const sum = items.reduce((acc, r) => acc + (r.rating || 0), 0);
                    const averageRating = Math.round((sum / items.length) * 10) / 10;
                    const totalReviews = items.length;
                    setStats({
                        averageRating,
                        totalReviews,
                    });
                } else {
                    setStats({ averageRating: 0, totalReviews: 0 });
                }
                setLoading(false);
            },
            (err) => {
                console.error('useReviews snapshot error:', err);
                setLoading(false);
            }
        );

        return unsubscribe;
    }, [db, productId]);

    const addReview = useCallback(
        async (review: Omit<Review, 'id' | 'createdAt'>) => {
            await addDoc(collection(db, 'reviews'), {
                ...review,
                createdAt: Timestamp.now(),
            });
        },
        [db]
    );

    return { reviews, loading, ...stats, addReview };
};

// ── useOrders ──────────────────────────────────────────────────────────────

export const useOrders = (userId?: string | null, isAdmin: boolean = false) => {
    const { db } = useFirebase();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Reset states whenever userId changes
        setLoading(true);
        setError(null);

        let q;
        if (userId) {
            // User context: fetch only their orders. 
            // Removed orderBy('date', 'desc') to avoid requiring a composite index.
            // We'll sort locally in the onSnapshot handler.
            q = query(
                collection(db, 'orders'),
                where('userId', '==', userId)
            );
        } else if (isAdmin) {
            // Admin context: fetch all orders. orderBy('date') usually has an index in admin views.
            q = query(collection(db, 'orders'), orderBy('date', 'desc'));
        } else {
            // userId is null or undefined (and not admin): don't listen
            setOrders([]);
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const items: Order[] = snapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                } as Order));

                // Local sort if we didn't sort in the query
                if (userId) {
                    items.sort((a, b) => dateToMillis(b.date) - dateToMillis(a.date));
                }

                setOrders(items);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('useOrders snapshot error:', err);
                // If it's a permission error and we were trying to fetch "all" (userId undefined),
                // it might just be the initial public layout loading.
                setError(err.message);
                setLoading(false);
            }
        );
        return unsubscribe;
    }, [db, userId, isAdmin]);

    const addOrder = useCallback(
        async (order: Omit<Order, 'id'>) => {
            const counterRef = doc(db, 'metadata', 'counters');
            let newOrderNumber = '';
            let newOrderId = '';

            try {
                await runTransaction(db, async (transaction) => {
                    // 1. Perform all READS first
                    const counterDoc = await transaction.get(counterRef);
                    
                    let couponDoc = null;
                    let couponRef = null;
                    if (order.couponCode) {
                        couponRef = doc(db, 'coupons', order.couponCode);
                        couponDoc = await transaction.get(couponRef);
                    }

                    // 2. Perform calculations
                    const currentCount = counterDoc.exists()
                        ? (counterDoc.data()?.orderCount as number) || 10000
                        : 10000;
                    const nextCount = currentCount + 1;
                    newOrderNumber = `MT-${nextCount}`;

                    // 3. Perform all WRITES
                    // Update counter
                    transaction.set(counterRef, { orderCount: nextCount }, { merge: true });

                    // Increment coupon usage if applicable
                    if (couponDoc && couponDoc.exists()) {
                        const currentUsed = (couponDoc.data()?.usedCount as number) || 0;
                        transaction.update(couponRef!, { usedCount: currentUsed + 1 });
                    }

                    // Create the order document
                    const orderCollection = collection(db, 'orders');
                    const newOrderRef = doc(orderCollection);
                    newOrderId = newOrderRef.id;
                    // Create sanitized order object (remove undefined fields)
                    const sanitizedOrder = Object.fromEntries(
                        Object.entries(order).filter(([_, v]) => v !== undefined)
                    );

                    transaction.set(newOrderRef, {
                        ...sanitizedOrder,
                        orderNumber: newOrderNumber,
                        date: Timestamp.now(),
                    });

                    // 4. Update sales count for each product
                    // 4. Update sales count for each product or combo
                    if (order.items) {
                        for (const item of order.items) {
                            // Only update for regular products and known combos
                            const isCombo = item.category === 'Combos';
                            const isProduct = !isCombo && item.category !== 'Custom Mix';
                            
                            if (isProduct || isCombo) {
                                const collectionName = isCombo ? 'combos' : 'products';
                                const docRef = doc(db, collectionName, item.productId);
                                transaction.update(docRef, {
                                    salesCount: increment(item.quantity || 1)
                                });
                            } else if (item.category === 'Custom Mix' && item.products) {
                                // For custom mixes, update sales count for each ingredient
                                for (const subItem of item.products) {
                                    if (subItem.productId) {
                                        const subRef = doc(db, 'products', subItem.productId);
                                        // subItem.quantity or grams? 
                                        // In build-mixture, each 'grams' is like a quantity.
                                        transaction.update(subRef, {
                                            salesCount: increment(subItem.grams || 1)
                                        });
                                    }
                                }
                            }
                        }
                    }

                    // 5. Update loyalty points if earned
                    if (order.earnedPoints && order.earnedPoints > 0 && order.userId) {
                        const customerRef = doc(db, 'customers', order.userId);
                        transaction.update(customerRef, {
                            loyaltyPoints: increment(order.earnedPoints)
                        });
                    }

                    // 6. Deduct loyalty points if redeemed
                    if (order.redeemedPoints && order.redeemedPoints > 0 && order.userId) {
                        const customerRef = doc(db, 'customers', order.userId);
                        transaction.update(customerRef, {
                            loyaltyPoints: increment(-order.redeemedPoints)
                        });
                    }
                });
                return { id: newOrderId, orderNumber: newOrderNumber };
            } catch (txErr) {
                console.error('Order transaction failed:', txErr);
                throw txErr;
            }
        },
        [db]
    );

    const updateOrderStatus = useCallback(
        async (id: string, status: string) => {
            await updateDoc(doc(db, 'orders', id), { status });
        },
        [db]
    );

    const updateOrderShipment = useCallback(
        async (id: string, data: { orderId: string; shipmentId: string }) => {
            await updateDoc(doc(db, 'orders', id), {
                shiprocketOrderId: data.orderId,
                shiprocketShipmentId: data.shipmentId,
                status: 'Dispatched',
            });
        },
        [db]
    );

    return { orders, loading, error, updateOrderStatus, addOrder, updateOrderShipment };
};

// ── useCustomers ───────────────────────────────────────────────────────────

export const useCustomer = (uid?: string | null) => {
    const { db } = useFirebase();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!uid) {
            setCustomer(null);
            setLoading(uid === null ? false : true);
            return;
        }

        const unsubscribe = onSnapshot(
            doc(db, 'customers', uid),
            (docSnap) => {
                if (docSnap.exists()) {
                    setCustomer({ id: docSnap.id, ...docSnap.data() } as Customer);
                } else {
                    setCustomer(null);
                }
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('useCustomer snapshot error:', err);
                setError(err.message);
                setLoading(false);
            }
        );
        return unsubscribe;
    }, [db, uid]);

    return { customer, loading, error };
};

export const useMembership = (uid?: string | null) => {
    const { db } = useFirebase();
    const [membership, setMembership] = useState<Membership | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!uid) {
            setMembership(null);
            setLoading(false);
            return;
        }

        // Refactored to query for active membership by userId
        // This handles cases where the document ID is not the userId (e.g. subscriptionId)
        const q = query(
            collection(db, 'memberships'),
            where('userId', '==', uid),
            where('status', '==', 'active'),
            limit(1)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                if (!snapshot.empty) {
                    const docSnap = snapshot.docs[0];
                    setMembership({ id: docSnap.id, ...docSnap.data() } as Membership);
                } else {
                    setMembership(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error('useMembership snapshot error:', err);
                setLoading(false);
            }
        );
        return unsubscribe;
    }, [db, uid]);

    return { membership, loading };
};

export const useCustomers = (isAdmin: boolean = false) => {
    const { db } = useFirebase();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin) {
            setCustomers([]);
            setLoading(false);
            return;
        }

        // Listen to both collections to aggregate live
        const qCustomers = query(collection(db, 'customers'), orderBy('name'));
        const qOrders = query(collection(db, 'orders'));

        let customersData: Customer[] = [];
        let ordersData: Order[] = [];

        const updateState = () => {
            const aggregated = customersData.map(customer => {
                const customerOrders = ordersData.filter(o => 
                    o.userId === customer.id || o.customerEmail === customer.email
                );
                
                const totalSpent = customerOrders.reduce((sum, o) => {
                    const amt = parseFloat(o.amount.replace(/[^\d.-]/g, '')) || 0;
                    return sum + amt;
                }, 0);

                return {
                    ...customer,
                    orderCount: customerOrders.length,
                    totalSpent: totalSpent
                };
            });
            setCustomers(aggregated);
            setLoading(false);
        };

        const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
            customersData = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
            } as Customer));
            updateState();
        }, (err) => {
            console.error('useCustomers customers error:', err);
            setLoading(false);
        });

        const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
            ordersData = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
            } as Order));
            updateState();
        }, (err) => {
            console.error('useCustomers orders error:', err);
        });

        return () => {
            unsubscribeCustomers();
            unsubscribeOrders();
        };
    }, [db, isAdmin]);

    return { customers, loading };
};

// ── useCombos ──────────────────────────────────────────────────────────────

export const useCombos = () => {
    const { db } = useFirebase();
    const [combos, setCombos] = useState<Combo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'combos'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const items: Combo[] = snapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                } as Combo));
                setCombos(items);
                setLoading(false);
            },
            (err) => {
                console.error('useCombos snapshot error:', err);
                setLoading(false);
            }
        );
        return unsubscribe;
    }, [db]);

    const addCombo = useCallback(
        async (combo: Omit<Combo, 'id' | 'createdAt'>) => {
            await addDoc(collection(db, 'combos'), {
                ...combo,
                createdAt: Timestamp.now(),
            });
        },
        [db]
    );

    const updateCombo = useCallback(
        async (id: string, updates: Partial<Combo>) => {
            await updateDoc(doc(db, 'combos', id), updates);
        },
        [db]
    );

    const deleteCombo = useCallback(
        async (id: string) => {
            await deleteDoc(doc(db, 'combos', id));
        },
        [db]
    );

    return { combos, loading, addCombo, updateCombo, deleteCombo };
};

// ── useCoupons ─────────────────────────────────────────────────────────────

// Moved to @/types

export const useCoupons = (isAdmin: boolean = false) => {
    const { db } = useFirebase();
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin) {
            setCoupons([]);
            setLoading(false);
            return;
        }
        const q = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const items: Coupon[] = snapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                } as Coupon));
                setCoupons(items);
                setLoading(false);
            },
            (err) => {
                console.error('useCoupons snapshot error:', err);
                setLoading(false);
            }
        );
        return unsubscribe;
    }, [db, isAdmin]);

    const addCoupon = useCallback(
        async (coupon: Omit<Coupon, 'id' | 'createdAt' | 'usedCount'> & { createdAt?: Timestamp | null, usedCount?: number }) => {
            const code = coupon.code.toUpperCase();
            await setDoc(doc(db, 'coupons', code), {
                ...coupon,
                usedCount: coupon.usedCount ?? 0,
                createdAt: coupon.createdAt ?? Timestamp.now(),
            });
        },
        [db]
    );

    const updateCoupon = useCallback(
        async (id: string, updates: Partial<Coupon>) => {
            await updateDoc(doc(db, 'coupons', id), updates);
        },
        [db]
    );

    const deleteCoupon = useCallback(
        async (id: string) => {
            await deleteDoc(doc(db, 'coupons', id));
        },
        [db]
    );

    /** Validate a coupon code against an order subtotal. Returns discount amount or throws. */
    const validateCoupon = useCallback(
        async (code: string, subtotal: number): Promise<{ coupon: Coupon; discountAmount: number }> => {
            const q = query(
                collection(db, 'coupons'),
                where('code', '==', code.toUpperCase()),
                limit(1)
            );
            const snap = await getDocs(q);
            if (snap.empty) throw new Error('Coupon not found');

            const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as Coupon;
            if (coupon.status !== 'active') throw new Error('Coupon is not active');
            if (coupon.expiryDate && coupon.expiryDate.toMillis() < Date.now()) {
                throw new Error('Coupon has expired');
            }
            if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
                throw new Error('Coupon usage limit reached');
            }
            if (subtotal < coupon.minOrderValue) {
                throw new Error(`Minimum order value of ₹${coupon.minOrderValue} required`);
            }

            const discountAmount =
                coupon.discountType === 'percentage'
                    ? Math.round(subtotal * (coupon.discountValue / 100) * 100) / 100
                    : Math.min(coupon.discountValue, subtotal);

            return { coupon, discountAmount };
        },
        [db]
    );

    return { coupons, loading, addCoupon, updateCoupon, deleteCoupon, validateCoupon };
};

// ── Standalone helpers ─────────────────────────────────────────────────────

export const updateCustomerProfile = async (
    uid: string,
    data: Partial<Customer>
): Promise<void> => {
    await updateDoc(doc(defaultDb, 'customers', uid), data);
};
