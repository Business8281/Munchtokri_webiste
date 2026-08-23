"use client";

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { signInWithPopup } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';
import { auth, db, googleProvider } from '@/lib/firebase';
import Button from '@/components/ui/Button/Button';
import styles from './auth.module.css';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get('redirect');
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        const loginToast = toast.loading('Initiating Google Sign-In...');

        try {
            if (!auth || !googleProvider) {
                throw new Error("Firebase Authentication is not properly configured.");
            }

            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            if (user.email) {
                // Save/Update user profile in 'customers' collection
                await setDoc(doc(db, 'customers', user.uid), {
                    name: user.displayName || 'Guest User',
                    email: user.email.toLowerCase(),
                    photoURL: user.photoURL,
                    joinedDate: Timestamp.now(),
                    // Use merge: true to avoid overwriting existing stats
                }, { merge: true });

                toast.success('Welcome to Munch Tokri!', { id: loginToast });
                setTimeout(() => router.push(redirect || '/'), 1000);
            } else {
                throw new Error("No mail found associated with your Google account.");
            }
        } catch (err: any) {
            console.error("Login Error Profile:", { code: err.code, msg: err.message });

            let errorTitle = 'Authentication failed';

            if (err.code === 'auth/popup-blocked') {
                errorTitle = 'Popup blocked! Please allow popups for this site.';
            } else if (err.code === 'auth/popup-closed-by-user') {
                errorTitle = 'Sign-in window was closed.';
            } else if (err.code === 'auth/unauthorized-domain') {
                errorTitle = 'Domain not authorized in Firebase Console.';
            } else if (err.message) {
                errorTitle = err.message;
            }

            toast.error(errorTitle, { id: loginToast });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.authContainer}>
            <Toaster position="top-center" reverseOrder={false} />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={styles.authCard}
            >
                <div className={styles.header}>
                    <div className={styles.logoWrapper}>
                        <Image
                            src="/logo.png"
                            alt="Munch Tokri Logo"
                            width={120}
                            height={104}
                            priority
                            className={styles.mainLogo}
                        />
                    </div>
                </div>

                <div className={styles.socialAuth}>
                    <Button
                        onClick={handleGoogleLogin}
                        className={styles.socialBtn}
                        disabled={loading}
                    >
                        {loading ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                style={{ display: 'flex' }}
                            >
                                <ShieldCheck size={20} />
                            </motion.div>
                        ) : (
                            <svg className={styles.googleIcon} viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.27.81-.57z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                                <path fill="none" d="M1 1h22v22H1z" />
                            </svg>
                        )}
                        <span>{loading ? 'Verifying Access...' : 'Continue with Google'}</span>
                    </Button>
                </div>

                <div className={styles.footer}>
                    <p>
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </motion.div>

            <motion.div
                animate={{
                    y: [0, -20, 0],
                    rotate: [0, 5, 0]
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                style={{
                    position: 'absolute',
                    top: '10%',
                    right: '10%',
                    width: '300px',
                    height: '300px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0, 128, 128, 0.03) 0%, transparent 70%)',
                    zIndex: 1
                }}
            />
            <motion.div
                animate={{
                    y: [0, 20, 0],
                    rotate: [0, -5, 0]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                style={{
                    position: 'absolute',
                    bottom: '10%',
                    left: '5%',
                    width: '400px',
                    height: '400px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(227, 30, 36, 0.02) 0%, transparent 70%)',
                    zIndex: 1
                }}
            />
        </div>
    );
}
