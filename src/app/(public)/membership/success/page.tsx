"use client";

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Sparkles, LayoutDashboard, ShoppingBag, Loader2, ShieldCheck, RefreshCcw } from 'lucide-react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import Button from '@/components/ui/Button/Button';
import styles from './MembershipSuccess.module.css';

function SuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const subscriptionId = searchParams.get('subscriptionId');
    const paymentId = searchParams.get('paymentId');
    
    const [status, setStatus] = useState<'loading' | 'active' | 'timeout'>('loading');
    const [user, setUser] = useState<any>(null);
    const [attempts, setAttempts] = useState(0);

    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged((u) => {
            setUser(u);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!user) return;

        // Listen to customer document for membership update
        const unsubscribe = onSnapshot(doc(db, 'customers', user.uid), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.isMember) {
                    setStatus('active');
                }
            }
        });

        // Timeout after 30 seconds if webhook is slow
        const timer = setTimeout(() => {
            if (status === 'loading') {
                setStatus('timeout');
            }
        }, 30000);

        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, [user, status]);

    const handleManualVerify = async () => {
        if (!user) return;
        setAttempts(prev => prev + 1);
        
        try {
            const snap = await getDoc(doc(db, 'customers', user.uid));
            if (snap.exists() && snap.data()?.isMember) {
                setStatus('active');
                toast.success("Membership confirmed!");
            } else {
                toast.error("Activation still in progress. Please wait a moment.");
            }
        } catch (error) {
            console.error("Verification error:", error);
        }
    };

    if (status === 'active') {
        return (
            <div className={styles.successCard}>
                <div className={styles.iconWrapper}>
                    <div className={styles.sparkles}>
                        <Sparkles className={styles.sparkle1} size={24} />
                        <Sparkles className={styles.sparkle2} size={20} />
                    </div>
                    <CheckCircle className={styles.successIcon} size={80} />
                </div>
                
                <h1 className={styles.title}>Welcome to the Club!</h1>
                <p className={styles.subtitle}>Your Munch Tokri Membership is now active.</p>
                
                <div className={styles.detailsBox}>
                    <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Subscription ID</span>
                        <span className={styles.detailValue}>{subscriptionId || 'Activated'}</span>
                    </div>
                    {paymentId && (
                        <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>Payment ID</span>
                            <span className={styles.detailValue}>{paymentId}</span>
                        </div>
                    )}
                </div>

                <div className={styles.benefitsCallout}>
                    <ShieldCheck size={18} className="text-green-600" />
                    <span>Your flat 10% discount and free delivery are now live!</span>
                </div>

                <p className={styles.message}>
                    Thank you for joining our exclusive community. You can now enjoy premium benefits on every order. Start exploring our traditional treats with your new member perks!
                </p>

                <div className={styles.actionButtons}>
                    <Link href="/dashboard?tab=membership" className={styles.primaryBtn}>
                        <LayoutDashboard size={20} />
                        Go to Dashboard
                    </Link>
                    <Link href="/shop" className={styles.secondaryBtn}>
                        <ShoppingBag size={20} />
                        Start Shopping
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.successCard}>
            <div className={styles.loadingWrapper}>
                <Loader2 className={styles.spinner} size={60} />
            </div>
            
            <h1 className={styles.title}>Activating Membership...</h1>
            <p className={styles.message}>
                We've received your payment. Our system is currently activating your premium benefits. This usually takes just a few seconds.
            </p>

            {status === 'timeout' && (
                <div className={styles.timeoutBox}>
                    <p>It's taking a bit longer than expected to confirm the activation.</p>
                    <Button 
                        variant="outline" 
                        onClick={handleManualVerify}
                        className="mt-4 flex items-center gap-2"
                    >
                        <RefreshCcw size={16} />
                        Verify Activation Now
                    </Button>
                </div>
            )}

            <div className={styles.waitInfo}>
                <p>Please do not close this window.</p>
            </div>
        </div>
    );
}

export default function MembershipSuccessPage() {
    return (
        <div className={styles.pageContainer}>
            <Suspense fallback={<div className="flex items-center justify-center p-20"><Loader2 className="animate-spin" /></div>}>
                <SuccessContent />
            </Suspense>
        </div>
    );
}
