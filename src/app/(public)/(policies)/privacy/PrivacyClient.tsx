"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone } from 'lucide-react';
import styles from '../policy.module.css';

const fadeIn = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8 }
};

export default function PrivacyClient() {
    return (
        <main className={styles.policyContainer}>
            {/* Hero Section */}
            <section className={styles.hero}>
                <div className="container">
                    <motion.div {...fadeIn}>
                        <h1 className={styles.heroTitle}>Privacy Policy</h1>
                        <p className={styles.heroDesc}>
                            At Hurigalu Angadi, we respect your privacy and are committed to protecting the personal information you share with us.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Content Section */}
            <section className={styles.content}>
                <div className="container">
                    <motion.div className={styles.card} {...fadeIn} transition={{ delay: 0.2 }}>
                        <div className={styles.section}>
                            <p className={styles.sectionContent}>
                                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you interact with us—whether through our website, social media platforms, WhatsApp, or any other communication channel.
                            </p>
                            <p className={styles.sectionContent}>
                                By using our services, you agree to the practices described in this Privacy Policy.
                            </p>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>1. Information We Collect</h2>
                            <div className={styles.sectionContent}>
                                <p>We may collect the following types of information:</p>
                                
                                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.15rem' }}>a. Personal Information</h3>
                                <ul>
                                    <li>Name</li>
                                    <li>Phone number</li>
                                    <li>Email address</li>
                                    <li>Delivery address</li>
                                    <li>Order and purchase details</li>
                                    <li>Payment-related information (processed securely via third-party gateways)</li>
                                </ul>

                                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.15rem' }}>b. Non-Personal Information</h3>
                                <ul>
                                    <li>Browser type and device information</li>
                                    <li>IP address</li>
                                    <li>Website usage data (pages visited, time spent, interactions)</li>
                                    <li>Cookies and similar tracking technologies</li>
                                </ul>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>2. How We Use Your Information</h2>
                            <div className={styles.sectionContent}>
                                <p>Your information is used to:</p>
                                <ul>
                                    <li>Process and fulfill orders</li>
                                    <li>Communicate order updates and customer support responses</li>
                                    <li>Improve our products, services, and customer experience</li>
                                    <li>Send promotional offers and updates (if you opt in)</li>
                                    <li>Maintain internal records and ensure legal compliance</li>
                                </ul>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>3. Cookies and Tracking Technologies</h2>
                            <div className={styles.sectionContent}>
                                <p>We may use cookies to enhance website functionality, analyze traffic, and personalize your experience. You can choose to disable cookies through your browser settings.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>4. Sharing of Information</h2>
                            <div className={styles.sectionContent}>
                                <p>We do not sell, rent, or trade your personal information. We may share your information only with:</p>
                                <ul>
                                    <li>Delivery and logistics partners for order fulfillment</li>
                                    <li>Trusted service providers (payment gateways, IT services)</li>
                                    <li>Legal authorities if required by law</li>
                                </ul>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>5. Data Security</h2>
                            <div className={styles.sectionContent}>
                                <p>We implement technical and organizational measures to protect your information. While we strive to protect your data, no method of transmission over the internet is 100% secure.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>6. Your Rights and Choices</h2>
                            <div className={styles.sectionContent}>
                                <p>You have the right to access, update, or correct your personal information, request deletion, and opt out of promotional communications.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>7. Third-Party Links</h2>
                            <div className={styles.sectionContent}>
                                <p>Our platforms may contain links to third-party sites. We are not responsible for the privacy practices of those external sites.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>8. Children’s Privacy</h2>
                            <div className={styles.sectionContent}>
                                <p>Our products and services are not intended for children under 13. We do not knowingly collect information from children.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>9. Changes to This Policy</h2>
                            <div className={styles.sectionContent}>
                                <p>Hurigalu Angadi reserves the right to modify this Privacy Policy at any time. Changes will be posted on this page.</p>
                            </div>
                        </div>

                        <div className={styles.contactBox}>
                            <h4>10. Contact Us</h4>
                            <div className={styles.contactInfo}>
                                <div className={styles.contactItem}>
                                    <strong>Hurigalu Angadi</strong>
                                </div>
                                <div className={styles.contactItem}>
                                    <Mail size={18} />
                                    <span>Sales@Hurigaluangadi1961.com</span>
                                </div>
                                <div className={styles.contactItem}>
                                    <Phone size={18} />
                                    <span>+91 98865 37430 / 99013 26037</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}
