"use client";

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
    Package,
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    RefreshCw
} from 'lucide-react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { collection, query, where, limit, onSnapshot, doc, setDoc, Timestamp } from 'firebase/firestore';
import { toast, Toaster } from 'react-hot-toast';
import { tracker } from '@/lib/analytics/tracker';
import styles from './success.module.css';

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderNumber = searchParams?.get('orderNumber');
    const [order, setOrder] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(false);
    const [authMismatchAlert, setAuthMismatchAlert] = useState<{ signedInEmail: string; expectedEmail: string } | null>(null);

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

    const handleGoogleLogin = async (targetEmail?: string) => {
        if (!auth || !googleProvider) {
            toast.error("Authentication service unavailable.");
            return;
        }

        setAuthLoading(true);
        const toastId = toast.loading("Connecting to Google Sign-In...");

        try {
            if (auth.currentUser) {
                await signOut(auth);
            }

            const result = await signInWithPopup(auth, googleProvider);
            const signedUser = result.user;

            if (signedUser && signedUser.email) {
                const loggedEmail = signedUser.email.toLowerCase();

                // Update / merge customer record in Firestore
                await setDoc(doc(db, 'customers', signedUser.uid), {
                    name: signedUser.displayName || 'Guest User',
                    email: loggedEmail,
                    photoURL: signedUser.photoURL,
                    joinedDate: Timestamp.now(),
                }, { merge: true });

                const expected = (targetEmail || customerEmail || '').toLowerCase();
                if (expected && loggedEmail !== expected) {
                    setAuthMismatchAlert({
                        signedInEmail: signedUser.email,
                        expectedEmail: expected,
                    });
                    toast.error(`Logged in as ${signedUser.email}. Note: This order is registered under ${expected}.`, { id: toastId, duration: 6000 });
                } else {
                    setAuthMismatchAlert(null);
                    toast.success("Order linked successfully! Opening your dashboard...", { id: toastId });
                    setTimeout(() => {
                        router.push('/dashboard');
                    }, 1000);
                }
            } else {
                throw new Error("No email found with this Google account.");
            }
        } catch (err: any) {
            console.error("Google Sign-In Error on Success Page:", err);
            if (err.code === 'auth/popup-blocked') {
                toast.error("Popup blocked! Redirecting to login...", { id: toastId });
                const redirectUrl = `/login?email=${encodeURIComponent(customerEmail)}&orderNumber=${encodeURIComponent(orderNumber || '')}&redirect=/dashboard`;
                router.push(redirectUrl);
            } else if (err.code === 'auth/popup-closed-by-user') {
                toast.error("Sign-in cancelled.", { id: toastId });
            } else {
                toast.error(err.message || "Sign-in failed.", { id: toastId });
            }
        } finally {
            setAuthLoading(false);
        }
    };

    const handleTrackOrderClick = () => {
        if (isEmailMatching) {
            router.push('/dashboard');
        } else if (customerEmail) {
            handleGoogleLogin(customerEmail);
        } else {
            router.push('/dashboard');
        }
    };

    return (
        <div className={styles.successContainer}>
            <Toaster position="top-center" reverseOrder={false} />
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
                                const isCustomMix = it.isCustomMix || it.id?.startsWith('custom-mix');
                                const qtyLabel = isCustomMix
                                    ? `1 Custom Pack (${it.quantity || it.baseWeight}g)`
                                    : isCombo
                                    ? `${it.quantity} ${it.quantity === 1 ? 'pack' : 'packs'}`
                                    : `${it.quantity}g`;
                                const itemTotal = isCustomMix
                                    ? Number(it.price || 0)
                                    : (it.price / (it.baseWeight || 100)) * it.quantity;

                                return (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.88rem', color: '#334155', borderBottom: idx < order.items.length - 1 ? '1px dashed #e2e8f0' : 'none', paddingBottom: '0.4rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>
                                                • <strong>{it.name}</strong> ({qtyLabel})
                                            </span>
                                            <span style={{ fontWeight: 600 }}>₹{itemTotal.toFixed(2)}</span>
                                        </div>
                                        {isCustomMix && it.products && it.products.length > 0 && (
                                            <div style={{ paddingLeft: '1rem', fontSize: '0.78rem', color: '#64748b' }}>
                                                {it.products.map((p: any) => `${p.name} (${p.weight || p.quantity || 0}g)`).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Account & Live Tracking Access Section */}
                {customerEmail && (
                    <div style={{
                        backgroundColor: isEmailMatching ? '#f0fdf4' : '#fffbeb',
                        border: isEmailMatching ? '1.5px solid #86efac' : '2px solid #f59e0b',
                        borderRadius: '0.85rem',
                        padding: '1.35rem',
                        marginBottom: '2rem',
                        textAlign: 'left',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)'
                    }}>
                        {isEmailMatching ? (
                            /* Case A: Already logged in with matching email */
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#15803d', fontWeight: 800, fontSize: '1rem', marginBottom: '0.4rem' }}>
                                    <CheckCircle2 size={20} color="#16a34a" />
                                    <span>Order Linked to Your Account</span>
                                </div>
                                <p style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', color: '#166534', lineHeight: 1.55 }}>
                                    You are logged in with <strong>{customerEmail}</strong>. This order is saved to your account. You can view live courier movement, download official tax invoices, and request order cancellation/refunds anytime from your dashboard.
                                </p>
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.65rem 1.25rem',
                                        backgroundColor: '#16a34a',
                                        color: '#ffffff',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <LayoutDashboard size={18} />
                                    <span>Track Your Order in Dashboard</span>
                                </button>
                            </div>
                        ) : currentUser ? (
                            /* Case B: Logged in with different email */
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309', fontWeight: 800, fontSize: '1rem', marginBottom: '0.4rem' }}>
                                    <AlertTriangle size={20} color="#d97706" />
                                    <span>Account Mismatch: Login Required as {customerEmail}</span>
                                </div>
                                <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#78350f', lineHeight: 1.55 }}>
                                    You are currently logged in as <strong>{currentUser.email}</strong>, but this order was placed under <strong>{customerEmail}</strong>.
                                    <br />
                                    Orders in your dashboard are strictly filtered by your registered email. To track live shipping, view tax invoices, or request order cancellation, please log in with <strong>{customerEmail}</strong>.
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                                    <button
                                        onClick={() => handleGoogleLogin(customerEmail)}
                                        disabled={authLoading}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.6rem',
                                            padding: '0.65rem 1.2rem',
                                            backgroundColor: '#0f172a',
                                            color: '#ffffff',
                                            borderRadius: '8px',
                                            fontWeight: 700,
                                            fontSize: '0.88rem',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.27.81-.57z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                            <path fill="none" d="M1 1h22v22H1z" />
                                        </svg>
                                        <span>{authLoading ? 'Switching Account...' : `Switch Account & Log In with ${customerEmail}`}</span>
                                    </button>
                                    <button
                                        onClick={() => router.push('/dashboard')}
                                        style={{
                                            padding: '0.65rem 1rem',
                                            backgroundColor: '#f1f5f9',
                                            color: '#475569',
                                            borderRadius: '8px',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            border: '1px solid #cbd5e1',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Proceed with {currentUser.email}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Case C: Guest Checkout (Not logged in) */
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#92400e', fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.4rem' }}>
                                    <LogIn size={20} color="#b45309" />
                                    <span>Log in with Google to Track Your Order</span>
                                </div>
                                <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', color: '#78350f', lineHeight: 1.55 }}>
                                    You completed checkout as a guest under:
                                </p>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.4rem 0.85rem',
                                    backgroundColor: '#fed7aa',
                                    color: '#7c2d12',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    fontSize: '0.92rem',
                                    marginBottom: '0.85rem'
                                }}>
                                    <Mail size={16} />
                                    <span>{customerEmail}</span>
                                </div>
                                <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: '#78350f', lineHeight: 1.55 }}>
                                    To access real-time courier tracking, download official GST tax invoices, or request order cancellation/refunds, <strong>you must log in with this same Google email ({customerEmail})</strong>.
                                </p>

                                {authMismatchAlert && (
                                    <div style={{
                                        backgroundColor: '#fee2e2',
                                        border: '1px solid #fca5a5',
                                        borderRadius: '6px',
                                        padding: '0.75rem',
                                        marginBottom: '1rem',
                                        fontSize: '0.86rem',
                                        color: '#991b1b',
                                        lineHeight: 1.45
                                    }}>
                                        <strong>⚠️ Account Notice:</strong> You just signed in with <b>{authMismatchAlert.signedInEmail}</b>, but this order was placed under <b>{authMismatchAlert.expectedEmail}</b>. Only orders placed under your signed-in email are visible in your dashboard. Please click below to choose <b>{authMismatchAlert.expectedEmail}</b>.
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                                    <button
                                        onClick={() => handleGoogleLogin(customerEmail)}
                                        disabled={authLoading}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.65rem',
                                            padding: '0.75rem 1.4rem',
                                            backgroundColor: '#0f172a',
                                            color: '#ffffff',
                                            borderRadius: '8px',
                                            fontWeight: 700,
                                            fontSize: '0.92rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.27.81-.57z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                            <path fill="none" d="M1 1h22v22H1z" />
                                        </svg>
                                        <span>{authLoading ? 'Signing in...' : `Track Your Order (Continue with Google)`}</span>
                                    </button>
                                    <Link
                                        href={`/login?email=${encodeURIComponent(customerEmail)}&orderNumber=${encodeURIComponent(orderNumber || '')}&redirect=/dashboard`}
                                        style={{
                                            fontSize: '0.85rem',
                                            color: '#2563eb',
                                            textDecoration: 'underline',
                                            fontWeight: 600
                                        }}
                                    >
                                        Go to Standard Login Page
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Bottom Action Buttons */}
                <div className={styles.actionButtons}>
                    <button
                        onClick={handleTrackOrderClick}
                        className={styles.primaryBtn}
                        disabled={authLoading}
                        style={{ border: 'none', cursor: 'pointer' }}
                    >
                        {authLoading ? (
                            <RefreshCw size={20} className="animate-spin" />
                        ) : (
                            <LayoutDashboard size={20} />
                        )}
                        <span>
                            {isEmailMatching
                                ? 'Track Your Order'
                                : customerEmail
                                ? `Track Your Order (${customerEmail})`
                                : 'Track Your Order'}
                        </span>
                    </button>
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
