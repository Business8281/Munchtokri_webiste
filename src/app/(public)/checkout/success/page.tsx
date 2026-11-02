"use client";

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    CheckCircle2,
    ShoppingBag,
    LayoutDashboard,
    Truck,
    MapPin,
    CreditCard,
    Phone,
    Mail,
    Calendar,
    ExternalLink,
    ShieldCheck,
    LogIn,
    Package
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { tracker } from '@/lib/analytics/tracker';
import styles from './success.module.css';

function SuccessContent() {
    const searchParams = useSearchParams();
    const orderNumber = searchParams?.get('orderNumber');
    const [order, setOrder] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!orderNumber) {
            setLoading(false);
            return;
        }

        tracker.track('purchase_complete', {
            orderNumber,
            isConfirmedOnSuccessPage: true
        });

        // Listen in real-time to the placed order
        const q = query(
            collection(db, 'orders'),
            where('orderNumber', '==', orderNumber),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const docSnap = snapshot.docs[0];
                setOrder({ id: docSnap.id, ...docSnap.data() });
            }
            setLoading(false);
        }, (err) => {
            console.error('Error fetching order on success page:', err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [orderNumber]);

    // Estimated delivery calculation (3-5 business days)
    const getDeliveryDates = () => {
        const today = new Date();
        const addDays = (d: Date, days: number) => {
            const copy = new Date(d);
            copy.setDate(copy.getDate() + days);
            return copy;
        };
        const minDate = addDays(today, 3);
        const maxDate = addDays(today, 5);
        const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
        return {
            minFormatted: minDate.toLocaleDateString('en-IN', options),
            maxFormatted: maxDate.toLocaleDateString('en-IN', options),
        };
    };

    const deliveryDates = getDeliveryDates();
    const isCod = Boolean(
        order?.paymentDetails?.isCod ||
        order?.method?.payment?.toLowerCase().includes('cash on delivery')
    );
    const advancePaid = Number(order?.paymentDetails?.advancePaid || 0);
    const codBalance = Number(order?.paymentDetails?.codBalance || 0);

    const customerEmail = order?.customerEmail && !order.customerEmail.includes('customer@munchtokri.com')
        ? order.customerEmail
        : '';
    const isEmailMatching = currentUser?.email && customerEmail
        ? currentUser.email.toLowerCase() === customerEmail.toLowerCase()
        : false;

    return (
        <div className={styles.successContainer}>
            <div className={styles.successCard}>
                {/* Header Badge */}
                <div className={styles.iconWrapper}>
                    <CheckCircle2 className={styles.successIcon} size={72} color="#16a34a" />
                </div>
                <h1 className={styles.title}>Order Placed Successfully!</h1>
                <p className={styles.message}>
                    Thank you for ordering with Munch Tokri. Your order has been confirmed and is being prepared with traditional love and care.
                </p>

                {/* Order ID Pill */}
                {orderNumber && (
                    <div style={{
                        backgroundColor: '#f1f5f9',
                        padding: '1rem 1.25rem',
                        borderRadius: '0.75rem',
                        marginBottom: '1.5rem',
                        border: '1.5px dashed #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                    }}>
                        <div style={{ textAlign: 'left' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                Order Reference
                            </span>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ef4444' }}>
                                {orderNumber}
                            </div>
                        </div>
                        <div style={{
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                        }}>
                            {order?.status || 'Processing'}
                        </div>
                    </div>
                )}

                {/* Delivery Estimate & Velocity Courier Info */}
                <div style={{
                    backgroundColor: '#f0fdfa',
                    border: '1px solid #99f6e4',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    textAlign: 'left',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f766e', fontWeight: 700, marginBottom: '0.35rem' }}>
                        <Truck size={18} />
                        <span>Velocity Express Courier Delivery</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#134e4a', lineHeight: 1.5 }}>
                        Estimated delivery between <strong>{deliveryDates.minFormatted}</strong> and <strong>{deliveryDates.maxFormatted}</strong>.
                        {order?.velocityAWB && (
                            <span style={{ display: 'block', marginTop: '0.35rem', color: '#0f766e' }}>
                                AWB Tracking Number: <strong>{order.velocityAWB}</strong>
                            </span>
                        )}
                    </p>
                    {order?.shippingDetails?.mobile && (
                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>📱 Velocity tracking and delivery updates are sent directly via WhatsApp / SMS to <strong>+91 {order.shippingDetails.mobile}</strong></span>
                        </p>
                    )}
                </div>

                {/* Payment Breakdown (20% Advance COD vs Full Prepaid) */}
                {order && (
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        padding: '1.25rem',
                        marginBottom: '1.5rem',
                        textAlign: 'left',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 700, marginBottom: '0.75rem' }}>
                            <CreditCard size={18} color="#ef4444" />
                            <span>Payment Summary</span>
                        </div>

                        {isCod ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                                    <span>Total Order Amount:</span>
                                    <strong style={{ color: '#0f172a' }}>{order.amount}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', backgroundColor: '#f0fdf4', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                                    <span>20% Advance Paid Online (Razorpay):</span>
                                    <strong>- ₹{advancePaid.toFixed(2)}</strong>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: '#fffbeb',
                                    padding: '0.6rem',
                                    borderRadius: '6px',
                                    border: '1px solid #fef3c7',
                                    fontWeight: 700,
                                    color: '#b45309',
                                    marginTop: '0.25rem',
                                }}>
                                    <span>Balance to Pay on Delivery (Cash/UPI):</span>
                                    <span style={{ fontSize: '1.05rem', color: '#b45309' }}>₹{codBalance.toFixed(2)}</span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#16a34a', backgroundColor: '#f0fdf4', padding: '0.6rem', borderRadius: '6px' }}>
                                <span>Total Paid Online (Prepaid):</span>
                                <strong style={{ fontSize: '1.1rem' }}>{order.amount}</strong>
                            </div>
                        )}
                    </div>
                )}

                {/* Delivery Address Details */}
                {order?.shippingDetails && (
                    <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        padding: '1.25rem',
                        marginBottom: '1.5rem',
                        textAlign: 'left',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 700, marginBottom: '0.6rem' }}>
                            <MapPin size={18} color="#ef4444" />
                            <span>Delivering To</span>
                        </div>
                        <p style={{ margin: '0 0 0.25rem', fontWeight: 700, color: '#1e293b' }}>
                            {order.customerName || 'Customer'}
                        </p>
                        <p style={{ margin: '0 0 0.4rem', color: '#475569', fontSize: '0.9rem', lineHeight: 1.4 }}>
                            {order.shippingDetails.address}, {order.shippingDetails.city}, {order.shippingDetails.state} - <strong>{order.shippingDetails.pincode}</strong>
                        </p>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                            📞 Mobile: <strong>+91 {order.shippingDetails.mobile}</strong>
                            {customerEmail && ` • ✉️ ${customerEmail}`}
                        </p>
                    </div>
                )}

                {/* Ordered Items Preview */}
                {order?.items && order.items.length > 0 && (
                    <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        textAlign: 'left',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 700, marginBottom: '0.75rem' }}>
                            <Package size={18} color="#2563eb" />
                            <span>Ordered Items ({order.items.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {order.items.map((it: any, idx: number) => {
                                const isCombo = it.category === 'Combos';
                                const qtyLabel = isCombo
                                    ? `${it.quantity} ${it.quantity === 1 ? 'pack' : 'packs'}`
                                    : `${it.quantity}g`;
                                return (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', color: '#334155' }}>
                                        <span>
                                            • <strong>{it.name}</strong> ({qtyLabel})
                                        </span>
                                        <span>₹{((it.price / (it.baseWeight || 100)) * it.quantity).toFixed(2)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Gmail & Account Association Card */}
                {customerEmail && (
                    <div style={{
                        backgroundColor: isEmailMatching ? '#f0fdf4' : '#fffbeb',
                        border: isEmailMatching ? '1.5px solid #86efac' : '1.5px solid #fde68a',
                        borderRadius: '0.75rem',
                        padding: '1.25rem',
                        marginBottom: '2rem',
                        textAlign: 'left',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isEmailMatching ? '#15803d' : '#92400e', fontWeight: 700, marginBottom: '0.4rem' }}>
                            <Mail size={18} />
                            <span>Account & Live Tracking Access</span>
                        </div>
                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: isEmailMatching ? '#166534' : '#78350f', lineHeight: 1.5 }}>
                            {isEmailMatching ? (
                                <>
                                    ✅ You are logged in with <strong>{customerEmail}</strong>. This order is automatically linked to your account and visible in your customer dashboard!
                                </>
                            ) : (
                                <>
                                    This order is registered under <strong>{customerEmail}</strong>. To view your live tracking status, download tax invoices, and track delivery progress anytime, please log in with this <strong>same Gmail address</strong>.
                                </>
                            )}
                        </p>
                        {!isEmailMatching && (
                            <Link
                                href={`/login?redirect=/dashboard`}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.6rem 1.1rem',
                                    backgroundColor: '#0f172a',
                                    color: '#ffffff',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    textDecoration: 'none',
                                }}
                            >
                                <LogIn size={16} />
                                Log in with Google ({customerEmail})
                            </Link>
                        )}
                    </div>
                )}

                {/* Bottom Action Buttons */}
                <div className={styles.actionButtons}>
                    <Link href="/dashboard" className={styles.primaryBtn}>
                        <LayoutDashboard size={20} />
                        View Live Order Status
                    </Link>
                    <Link href="/shop" className={styles.secondaryBtn}>
                        <ShoppingBag size={20} />
                        Continue Shopping
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function OrderSuccessPage() {
    return (
        <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading order confirmation...</div>}>
            <SuccessContent />
        </Suspense>
    );
}
