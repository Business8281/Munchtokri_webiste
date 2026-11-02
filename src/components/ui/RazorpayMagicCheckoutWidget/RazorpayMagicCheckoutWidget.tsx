"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';
import styles from './RazorpayMagicCheckoutWidget.module.css';

interface RazorpayMagicCheckoutWidgetProps {
    onBuyNow: () => void;
    disabled?: boolean;
    loading?: boolean;
    buttonText?: string;
    showProtectionBar?: boolean;
}

export default function RazorpayMagicCheckoutWidget({
    onBuyNow,
    disabled = false,
    loading = false,
    buttonText = "Pay Online (Full Amount)",
    showProtectionBar = true,
}: RazorpayMagicCheckoutWidgetProps) {
    return (
        <div className={styles.container}>
            {/* Razorpay Buyer Protection Trust Badge */}
            {showProtectionBar && (
                <div className={styles.protectionBar}>
                    {/* Left: Razorpay Buyer Protection Brand Lockup */}
                    <div className={styles.leftProtection}>
                        <div className={styles.verticalBar} />
                        <div className={styles.brandColumn}>
                            <div className={styles.razorpayBrand}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                    <path d="M13 0L3 13.5H10.5L6 24L18 9.5H11.5L14.5 0H13Z" fill="#2563eb" />
                                </svg>
                                <span>Razorpay</span>
                            </div>
                            <div className={styles.protectionTitle}>
                                <span className={styles.buyerText}>BUYER</span>
                                <span className={styles.protectionText}>
                                    PR
                                    <span className={styles.shieldWrapper}>
                                        <svg width="14" height="15" viewBox="0 0 24 24" fill="none">
                                            <path d="M12 2L3 6V11.5C3 17 6.8 21.7 12 23C17.2 21.7 21 17 21 11.5V6L12 2Z" fill="#10b981" />
                                            <path d="M9 12L11 14L15 10" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    TECTION
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Features Row: Guaranteed Delivery, Assured Refunds, Prompt Support */}
                    <div className={styles.featuresList}>
                        {/* 1. Guaranteed Delivery */}
                        <div className={styles.featureItem}>
                            <svg className={styles.featureIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                                <path d="M15 18H9" />
                                <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.24-4.05a1 1 0 0 0-.78-.38H14v10" />
                                <circle cx="7" cy="18" r="2" />
                                <circle cx="17" cy="18" r="2" />
                                <path d="M2 9h4" />
                                <path d="M1 12h3" />
                            </svg>
                            <div className={styles.featureText}>
                                <strong>Guaranteed</strong>
                                <span>Delivery</span>
                            </div>
                        </div>

                        {/* 2. Assured Refunds */}
                        <div className={styles.featureItem}>
                            <div className={styles.refundIconWrapper}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                    <path d="M3 3v5h5" />
                                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                                    <path d="M16 21h5v-5" />
                                </svg>
                                <span className={styles.rupeeSymbolInIcon}>₹</span>
                            </div>
                            <div className={styles.featureText}>
                                <strong>Assured</strong>
                                <span>Refunds</span>
                            </div>
                        </div>

                        {/* 3. Prompt Support */}
                        <div className={styles.featureItem}>
                            <svg className={styles.featureIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
                            </svg>
                            <div className={styles.featureText}>
                                <strong>Prompt</strong>
                                <span>Support</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pitch-Black Buy Now Button (Magic Checkout) */}
            <button
                type="button"
                className={styles.buyNowButton}
                onClick={onBuyNow}
                disabled={disabled || loading}
            >
                {loading ? (
                    <>
                        <Loader2 className="animate-spin" size={20} />
                        <span>Opening Magic Checkout...</span>
                    </>
                ) : (
                    <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={styles.boltIcon}>
                            <path d="M13 1L3 13.5H10.5L6 23L19 9.5H11.5L14.5 1H13Z" fill="#ffffff" />
                        </svg>
                        <span>{buttonText}</span>
                    </>
                )}
            </button>

            {/* Secured by Razorpay Footer */}
            <div className={styles.securedFooter}>
                <span className={styles.securedText}>Secured by</span>
                <img
                    src="/razorpay.svg"
                    alt="Razorpay"
                    className={styles.razorpayLogo}
                />
            </div>
        </div>
    );
}
