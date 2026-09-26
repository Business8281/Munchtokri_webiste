"use client";

import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ShoppingBag, LayoutDashboard } from 'lucide-react';
import { tracker } from '@/lib/analytics/tracker';
import styles from './success.module.css';

function SuccessContent() {
    const searchParams = useSearchParams();
    const orderNumber = searchParams.get('orderNumber');

    useEffect(() => {
        if (orderNumber) {
            tracker.track('purchase_complete', {
                orderNumber,
                isConfirmedOnSuccessPage: true
            });
        }
    }, [orderNumber]);

    return (
        <div className={styles.successContainer}>
            <div className={styles.successCard}>
                <div className={styles.iconWrapper}>
                    <CheckCircle className={styles.successIcon} size={80} />
                </div>
                <h1 className={styles.title}>Order Placed Successfully!</h1>
                {orderNumber && (
                    <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Order Number</p>
                        <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444' }}>{orderNumber}</p>
                    </div>
                )}
                <p className={styles.message}>
                    Thank you for your order from Munch Tokri. We are processing it and will deliver it right to your doorstep to bring you the taste of tradition!
                </p>

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
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
            <SuccessContent />
        </Suspense>
    );
}
