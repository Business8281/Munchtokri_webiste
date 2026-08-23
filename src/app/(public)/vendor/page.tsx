"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button/Button';
import styles from './vendor.module.css';

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

export default function VendorPage() {
    const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        address: '',
        description: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const isFormValid = formData.fullName.trim() !== '' && 
                        formData.email.trim() !== '' && 
                        formData.phone.trim() !== '' && 
                        formData.address.trim() !== '' && 
                        formData.description.trim() !== '';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid) return;
        
        setFormStatus('submitting');

        // Construct the WhatsApp message
        const message = `*New Vendor Sign-up*\n\n` +
            `*Name:* ${formData.fullName}\n` +
            `*Email:* ${formData.email}\n` +
            `*Phone:* ${formData.phone}\n` +
            `*Address:* ${formData.address}\n` +
            `*Description:* ${formData.description}`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/919886537430?text=${encodedMessage}`;

        // Simulate a small delay for better UX before redirecting
        setTimeout(() => {
            window.open(whatsappUrl, '_blank');
            setFormStatus('success');
        }, 800);
    };

    return (
        <main className={styles.vendorContainer}>
            {/* Hero Section */}
            <section className={styles.hero}>
                <div className="container">
                    <motion.div {...fadeIn}>
                        <span className={styles.heroLabel}>PARTNER WITH US</span>
                        <h1 className={styles.heroTitle}>Become a Vendor</h1>
                        <p className={styles.heroDesc}>
                            Join the Munch Tokri family! We are always looking for partners who share our passion for authentic, traditional snacks.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Main Content Section */}
            <section className={styles.section}>
                <div className="container">
                    <div className={styles.contentRow}>
                        {/* Info Side */}
                        <motion.div className={styles.infoSide} variants={staggerContainer} initial="initial" whileInView="whileInView">
                            <h2 className={styles.sectionTitle}>
                                Grow Your <span>Business</span>
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', fontSize: '1.1rem', lineHeight: '1.7' }}>
                                At Munch Tokri, we believe in heritage and quality. If you manufacture specialized traditional snacks, sweets, or savories, we invite you to showcase your products on our platform.
                            </p>

                            <div className={styles.infoGrid}>
                                <motion.div className={styles.infoCard} variants={fadeIn}>
                                    <div className={styles.infoIcon}>📈</div>
                                    <h3>Expand Reach</h3>
                                    <p>Access our vast customer base across the country and grow your brand visibility.</p>
                                </motion.div>

                                <motion.div className={styles.infoCard} variants={fadeIn}>
                                    <div className={styles.infoIcon}>🤝</div>
                                    <h3>Fair Partnership</h3>
                                    <p>We believe in transparent pricing and mutually beneficial long-term relationships.</p>
                                </motion.div>

                                <motion.div className={styles.infoCard} variants={fadeIn}>
                                    <div className={styles.infoIcon}>🚚</div>
                                    <h3>Logistics Support</h3>
                                    <p>Benefit from our established supply chain and delivery network to reach more homes.</p>
                                </motion.div>

                                <motion.div className={styles.infoCard} variants={fadeIn}>
                                    <div className={styles.infoIcon}>🏢</div>
                                    <h3>Legacy Shop</h3>
                                    <p>Connect with our retail heritage in Malleswaram to validate your brand quality.</p>
                                </motion.div>
                            </div>
                        </motion.div>

                        {/* Form Side */}
                        <motion.div className={styles.formSide} {...fadeIn}>
                            <div className={styles.formCard}>
                                {formStatus === 'success' ? (
                                    <div className={styles.successCard}>
                                        <div className={styles.successIcon}>🎉</div>
                                        <div className={styles.successContent}>
                                            <h2>Details Sent!</h2>
                                            <p>
                                                Thank you for your interest! Your details have been sent to our team via WhatsApp. We will review your application and get back to you soon.
                                            </p>
                                            <Button 
                                                variant="outline" 
                                                className={styles.submitBtn} 
                                                onClick={() => {
                                                    setFormData({ fullName: '', email: '', phone: '', address: '', description: '' });
                                                    setFormStatus('idle');
                                                }}
                                            >
                                                New Application
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit}>
                                        <h2 className={styles.sectionTitle} style={{ fontSize: '1.8rem' }}>
                                            Vendor <span>Sign-up</span>
                                        </h2>
                                        
                                        <div className={styles.formGroup}>
                                            <label htmlFor="fullName" className={styles.formLabel}>FULL NAME</label>
                                            <input 
                                                type="text" 
                                                id="fullName" 
                                                className={styles.input} 
                                                placeholder="Enter your full name" 
                                                value={formData.fullName}
                                                onChange={handleChange}
                                                required 
                                            />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label htmlFor="email" className={styles.formLabel}>EMAIL ADDRESS</label>
                                            <input 
                                                type="email" 
                                                id="email" 
                                                className={styles.input} 
                                                placeholder="example@mail.com" 
                                                value={formData.email}
                                                onChange={handleChange}
                                                required 
                                            />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label htmlFor="phone" className={styles.formLabel}>PHONE NUMBER</label>
                                            <input 
                                                type="tel" 
                                                id="phone" 
                                                className={styles.input} 
                                                placeholder="+91 98765 43210" 
                                                value={formData.phone}
                                                onChange={handleChange}
                                                required 
                                            />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label htmlFor="address" className={styles.formLabel}>BUSINESS ADDRESS</label>
                                            <input 
                                                type="text" 
                                                id="address" 
                                                className={styles.input} 
                                                placeholder="Street, City, State, PIN" 
                                                value={formData.address}
                                                onChange={handleChange}
                                                required 
                                            />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label htmlFor="description" className={styles.formLabel}>PRODUCT DESCRIPTION</label>
                                            <textarea 
                                                id="description" 
                                                className={styles.textarea} 
                                                placeholder="Tell us about your products..." 
                                                value={formData.description}
                                                onChange={handleChange}
                                                required
                                            ></textarea>
                                        </div>

                                        <Button 
                                            type="submit" 
                                            className={styles.submitBtn} 
                                            disabled={formStatus === 'submitting' || !isFormValid}
                                        >
                                            {formStatus === 'submitting' ? 'Processing...' : 'Submit to WhatsApp'}
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
