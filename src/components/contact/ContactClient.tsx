"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Button from '@/components/ui/Button/Button';
import styles from '@/app/(public)/contact/contact.module.css';

const fadeIn = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.8 }
};

const staggerContainer = {
    initial: { opacity: 0 },
    whileInView: { opacity: 1 },
    viewport: { once: true },
    transition: { staggerChildren: 0.2 }
};

interface StoreSettings {
    storeName: string;
    contactEmail: string;
    secondaryEmail?: string;
    bulkOrderEmail?: string;
    contactNumber: string;
    secondaryNumber?: string;
    storeNumber?: string;
    address: string;
    businessHours: string;
}

export default function ContactClient() {
    const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
    const [settings, setSettings] = useState<StoreSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'store');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(docSnap.data() as StoreSettings);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormStatus('submitting');
        // Simulate API call
        setTimeout(() => setFormStatus('success'), 1500);
    };

    if (loading) {
        return (
            <main className={styles.contactContainer}>
                <section className={styles.hero}>
                    <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>
                        <p>Loading contact information...</p>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className={styles.contactContainer}>
            <section className={styles.hero}>
                <div className="container">
                    <motion.div {...fadeIn}>
                        <span className={styles.heroLabel}>WE&apos;D LOVE TO HEAR FROM YOU</span>
                        <h1 className={styles.heroTitle}>Contact</h1>
                        <p className={styles.heroDesc}>
                            Have questions about our traditional snacks or want to share your feedback? 
                            Reach out to our team and we&apos;ll get back to you as soon as possible.
                        </p>
                    </motion.div>
                </div>
            </section>

            <section className={styles.section}>
                <div className="container">
                    <div className={styles.contentRow}>
                        <motion.div className={styles.infoSide} variants={staggerContainer} initial="initial" whileInView="whileInView">
                            <h2 className={styles.sectionTitle}>
                                Contact <span>Information</span>
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem' }}>
                                Visit our {settings?.storeName || 'heritage shop'} in Malleswaram or reach out via email for bulk orders and support.
                            </p>

                            <div className={styles.infoGrid}>
                                <motion.div className={styles.infoCard} variants={fadeIn}>
                                    <div className={styles.infoIcon}>📍</div>
                                    <h3>Visit Us</h3>
                                    <p>
                                        {settings?.address ? (
                                            settings.address.split('\n').map((line, i) => (
                                                <React.Fragment key={i}>{line}<br /></React.Fragment>
                                            ))
                                        ) : (
                                            <>Hurigalu Angadi (Heritage Shop)<br />Malleswaram, Bangalore<br />Karnataka - 560003</>
                                        )}
                                    </p>
                                </motion.div>

                                <motion.div className={styles.infoCard} variants={fadeIn}>
                                    <div className={styles.infoIcon}>✉️</div>
                                    <h3>Email Us</h3>
                                    <p>
                                        Support: {settings?.contactEmail || 'hello@munchtokri.com'}<br />
                                        {settings?.secondaryEmail && <>Primary Email 2: {settings.secondaryEmail}<br /></>}
                                        {settings?.bulkOrderEmail && <>Bulk Orders: {settings.bulkOrderEmail}<br /></>}
                                    </p>
                                </motion.div>

                                <motion.div className={styles.infoCard} variants={fadeIn}>
                                    <div className={styles.infoIcon}>📞</div>
                                    <h3>Call Us</h3>
                                    <p>
                                        Customer Care: <a href={`tel:${settings?.contactNumber || '+919876543210'}`} className={styles.contactLink}>{settings?.contactNumber || '+91 98765 43210'}</a><br />
                                        {settings?.secondaryNumber && <>Customer Care: <a href={`tel:${settings.secondaryNumber}`} className={styles.contactLink}>{settings.secondaryNumber}</a><br /></>}
                                        {settings?.storeNumber && <>Store: <a href={`tel:${settings.storeNumber}`} className={styles.contactLink}>{settings.storeNumber}</a><br /></>}
                                    </p>
                                </motion.div>

                                <motion.div className={styles.infoCard} variants={fadeIn}>
                                    <div className={styles.infoIcon}>⏰</div>
                                    <h3>Business Hours</h3>
                                    <p>
                                        {settings?.businessHours ? (
                                            settings.businessHours.split('\n').map((line, i) => (
                                                <React.Fragment key={i}>{line}<br /></React.Fragment>
                                            ))
                                        ) : (
                                            <>Mon - Sat: 10:00 AM - 9:00 PM<br />Sunday: 11:00 AM - 7:00 PM</>
                                        )}
                                    </p>
                                </motion.div>
                            </div>
                        </motion.div>

                        <motion.div className={styles.formSide} {...fadeIn}>
                            <div className={styles.formCard}>
                                {formStatus === 'success' ? (
                                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                                        <div style={{ fontSize: '4rem', marginBottom: '2rem' }}>🎉</div>
                                        <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Message Sent!</h2>
                                        <p style={{ color: 'var(--text-secondary)' }}>
                                            Thank you for reaching out. A member of the {settings?.storeName || 'Munch Tokri'} family will be in touch with you shortly.
                                        </p>
                                        <div style={{ marginTop: '2rem' }}>
                                            <Button 
                                                variant="outline" 
                                                className={styles.submitBtn} 
                                                onClick={() => setFormStatus('idle')}
                                            >
                                                Send Another Message
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit}>
                                        <h2 className={styles.sectionTitle} style={{ fontSize: '2rem' }}>
                                            Send us a <span>Message</span>
                                        </h2>
                                        
                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>FULL NAME</label>
                                            <input type="text" className={styles.input} placeholder="John Doe" required />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>EMAIL ADDRESS</label>
                                            <input type="email" className={styles.input} placeholder="john@example.com" required />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>SUBJECT</label>
                                            <input type="text" className={styles.input} placeholder="Inquiry about bulk orders" required />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>YOUR MESSAGE</label>
                                            <textarea className={styles.textarea} placeholder="How can we help you?" required></textarea>
                                        </div>

                                        <Button 
                                            type="submit" 
                                            className={styles.submitBtn} 
                                            disabled={formStatus === 'submitting'}
                                        >
                                            {formStatus === 'submitting' ? 'Sending...' : 'Send Message'}
                                        </Button>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>
        </main>
    );
}
