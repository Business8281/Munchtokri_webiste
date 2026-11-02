"use client";

import React, { useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useMagicCheckout } from '@/hooks/useMagicCheckout';
import RazorpayMagicCheckoutWidget from '@/components/ui/RazorpayMagicCheckoutWidget/RazorpayMagicCheckoutWidget';
import LegacyCheckoutForm from './LegacyCheckoutForm';
import {
    ShoppingBag,
    ShieldCheck,
    Truck,
    ArrowLeft,
    CheckCircle2,
    Lock,
    Zap,
    Loader2
} from 'lucide-react';
import styles from './magicCheckoutPage.module.css';

function CheckoutContent() {
    const searchParams = useSearchParams();
    const isLegacy = searchParams.get('legacy') === 'true' || searchParams.get('method') === 'cod';

    // If explicit legacy query param or COD requested, render the preserved legacy checkout wizard
    if (isLegacy) {
        return <LegacyCheckoutForm />;
    }

    const { cartItems, cartTotal } = useCart();
    const { openMagicCheckout, isLoading } = useMagicCheckout();
    const autoTriggeredRef = useRef(false);

    // Auto-trigger Razorpay Magic Checkout popup directly on mount if cart has items
    useEffect(() => {
        if (!autoTriggeredRef.current && cartItems.length > 0) {
            autoTriggeredRef.current = true;
            // Short timeout ensures DOM and scripts are fully initialized
            const timer = setTimeout(() => {
                openMagicCheckout();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [cartItems, openMagicCheckout]);

    if (cartItems.length === 0) {
        return (
            <div className={styles.pageWrapper}>
                <div className={styles.emptyState}>
                    <ShoppingBag className={styles.emptyIcon} size={56} />
                    <h1 className={styles.emptyTitle}>Your Cart is Empty</h1>
                    <p className={styles.emptySubtitle}>
                        Add delicious Karnataka snacks & sweets to your cart before proceeding to checkout.
                    </p>
                    <Link href="/shop" className={styles.shopButton}>
                        Explore Our Snacks
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.pageWrapper}>
            <div className={styles.container}>
                {/* Header Banner */}
                <div className={styles.headerBanner}>
                    <div className={styles.badge}>
                        <Zap size={14} />
                        Razorpay 1-Click Magic Checkout
                    </div>
                    <h1 className={styles.title}>Fast & Secure Checkout</h1>
                    <p className={styles.subtitle}>
                        Enter your mobile number and delivery address directly inside the Razorpay modal. Choose UPI, Cards, NetBanking, or Cash on Delivery.
                    </p>
                </div>

                {/* 2-Column Grid: Order Summary & Magic Checkout Trigger */}
                <div className={styles.checkoutGrid}>
                    {/* Left: Cart Items & Order Summary */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>
                                <ShoppingBag size={20} color="#2563eb" />
                                Order Items
                            </h2>
                            <span className={styles.itemsCountBadge}>
                                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
                            </span>
                        </div>

                        <div className={styles.itemsList}>
                            {cartItems.map((item) => {
                                const isCombo = item.category === 'Combos';
                                const itemTotal = (item.price / (item.baseWeight || 100)) * item.quantity;
                                const weightText = isCombo
                                    ? `${item.quantity} ${item.quantity === 1 ? 'unit' : 'units'}`
                                    : `${item.quantity}g`;

                                return (
                                    <div key={item.id} className={styles.itemRow}>
                                        <img
                                            src={item.imageURL || '/Logo Munch Tokri.png'}
                                            alt={item.name}
                                            className={styles.itemImage}
                                        />
                                        <div className={styles.itemInfo}>
                                            <h3 className={styles.itemName}>{item.name}</h3>
                                            <div className={styles.itemMeta}>
                                                <span>Qty: {weightText}</span>
                                                {item.variant && <span>• {item.variant}</span>}
                                            </div>
                                        </div>
                                        <div className={styles.itemPrice}>
                                            ₹{itemTotal.toFixed(2)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className={styles.summarySection}>
                            <div className={styles.summaryRow}>
                                <span>Subtotal</span>
                                <span>₹{cartTotal.toFixed(2)}</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span>Delivery</span>
                                <span className={styles.freeShippingTag}>Calculated in Razorpay</span>
                            </div>
                            <div className={styles.summaryTotalRow}>
                                <span>Total Amount</span>
                                <span>₹{cartTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <Link href="/shop" className={styles.returnLink}>
                            <ArrowLeft size={16} /> Continue Shopping
                        </Link>
                    </div>

                    {/* Right: Razorpay Magic Checkout Launcher & Buyer Protection */}
                    <div className={styles.ctaCard}>
                        {/* 1-Click Razorpay Magic Checkout Widget with Buyer Protection */}
                        <div className={styles.card}>
                            <RazorpayMagicCheckoutWidget
                                onBuyNow={() => openMagicCheckout()}
                                buttonText="Complete Order with Magic Checkout"
                                loading={isLoading}
                                showProtectionBar={true}
                            />

                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                                    Prefer Cash on Delivery?
                                </p>
                                <Link
                                    href="/checkout?legacy=true&method=cod"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        backgroundColor: '#ffffff',
                                        border: '2px solid #ef4444',
                                        borderRadius: '8px',
                                        color: '#ef4444',
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        textDecoration: 'none',
                                        boxSizing: 'border-box',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <Truck size={18} />
                                    Order with Cash on Delivery (Pay 20% Advance)
                                </Link>
                            </div>

                            <div className={styles.trustList}>
                                <div className={styles.trustItem}>
                                    <CheckCircle2 className={styles.trustIcon} size={18} />
                                    <span>Instant checkout with saved addresses via OTP</span>
                                </div>
                                <div className={styles.trustItem}>
                                    <CheckCircle2 className={styles.trustIcon} size={18} />
                                    <span>UPI (Google Pay, PhonePe, Paytm), Cards & NetBanking</span>
                                </div>
                                <div className={styles.trustItem}>
                                    <CheckCircle2 className={styles.trustIcon} size={18} />
                                    <span>Cash on Delivery (COD) supported</span>
                                </div>
                                <div className={styles.trustItem}>
                                    <Lock className={styles.trustIcon} size={18} />
                                    <span>256-bit bank-grade encryption & Razorpay Buyer Protection</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="animate-spin" size={32} color="#2563eb" />
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}
