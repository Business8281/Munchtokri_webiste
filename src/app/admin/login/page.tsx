"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { adminAuth, adminDb } from '@/lib/firebase';
import Button from '@/components/ui/Button/Button';
import styles from './auth.module.css';

export default function AdminLoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('Please enter both email and password.');
            return;
        }

        setLoading(true);
        const loginToast = toast.loading('Authenticating...');

        try {
            const result = await signInWithEmailAndPassword(adminAuth, email, password);
            const user = result.user;

            if (user.email) {
                const normalizedEmail = user.email.toLowerCase().trim();

                // Check by document ID (email as doc ID)
                const adminDoc = await getDoc(doc(adminDb, 'admins', normalizedEmail));
                let isAuthorized = adminDoc.exists();

                // Fallback: check by email field in case doc was stored differently
                if (!isAuthorized) {
                    const q = query(
                        collection(adminDb, 'admins'),
                        where('email', '==', normalizedEmail)
                    );
                    const querySnapshot = await getDocs(q);
                    isAuthorized = !querySnapshot.empty;
                }

                if (isAuthorized) {
                    toast.success('Welcome Back, Admin!', { id: loginToast });
                    setTimeout(() => router.push('/admin'), 800);
                } else {
                    await signOut(adminAuth);
                    toast.error(
                        `Access Denied: ${normalizedEmail} is not registered as an admin.`,
                        { id: loginToast }
                    );
                }
            }
        } catch (err: unknown) {
            const error = err as { code?: string };
            let message = 'Authentication failed. Please try again.';
            if (
                error.code === 'auth/user-not-found' ||
                error.code === 'auth/wrong-password' ||
                error.code === 'auth/invalid-credential'
            ) {
                message = 'Invalid email or password.';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Too many failed attempts. Please try again later.';
            }
            toast.error(message, { id: loginToast });
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
                    <p className={styles.subtitle}>Secure Administration Gateway</p>
                </div>

                <form onSubmit={handleEmailLogin} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="email">Email Address</label>
                        <div className={styles.inputWrapper}>
                            <Mail className={styles.inputIcon} size={18} />
                            <input
                                id="email"
                                type="email"
                                placeholder="admin@munchtokri.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="password">Password</label>
                        <div className={styles.inputWrapper}>
                            <Lock className={styles.inputIcon} size={18} />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className={styles.togglePassword}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <Button type="submit" disabled={loading} className={styles.submitBtn}>
                        {loading ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                style={{ display: 'flex' }}
                            >
                                <ShieldCheck size={20} />
                            </motion.div>
                        ) : (
                            <>
                                <span>Sign In to Dashboard</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </Button>
                </form>

                <div className={styles.footer}>
                    <p>
                        Authorized Access Only. Internal operations are monitored to ensure
                        data integrity and security.
                    </p>
                </div>
            </motion.div>

            <div className={styles.bgOrbs}>
                <motion.div
                    animate={{ y: [0, -30, 0] }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                    className={styles.orb1}
                />
                <motion.div
                    animate={{ y: [0, 30, 0] }}
                    transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                    className={styles.orb2}
                />
            </div>
        </div>
    );
}
