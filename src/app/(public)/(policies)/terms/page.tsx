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

export default function TermsPage() {
    return (
        <main className={styles.policyContainer}>
            {/* Hero Section */}
            <section className={styles.hero}>
                <div className="container">
                    <motion.div {...fadeIn}>
                        <h1 className={styles.heroTitle}>Terms & Conditions</h1>
                        <p className={styles.heroDesc}>
                            Welcome to Hurigalu Angadi. By using our website or placing an order, you agree to be bound by the following terms.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Content Section */}
            <section className={styles.content}>
                <div className="container">
                    <motion.div className={styles.card} {...fadeIn} transition={{ delay: 0.2 }}>
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>1. General Information</h2>
                            <div className={styles.sectionContent}>
                                <p>Hurigalu Angadi is a traditional Karnataka snack brand established in 1961. We reserve the right to update these Terms & Conditions at any time.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>2. Eligibility to Use</h2>
                            <div className={styles.sectionContent}>
                                <p>By using our website, you confirm you are at least 18 years of age or accessing under parental guidance, and are legally capable of entering a binding agreement.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>3. Products & Availability</h2>
                            <div className={styles.sectionContent}>
                                <ul>
                                    <li>All products are subject to availability.</li>
                                    <li>Slight variations may occur in handcrafted snacks.</li>
                                    <li>We reserve the right to limit quantities or modify offerings.</li>
                                </ul>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>4. Orders & Acceptance</h2>
                            <div className={styles.sectionContent}>
                                <p>Orders are considered confirmed only after successful payment. We reserve the right to cancel orders due to stock issues or pricing errors.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>5. Pricing & Payments</h2>
                            <div className={styles.sectionContent}>
                                <p>Prices are in INR and inclusive of taxes unless stated. Payment must be completed at the time of ordering via our secure third-party gateway.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>6. Shipping & Delivery</h2>
                            <div className={styles.sectionContent}>
                                <p>Timelines are estimates. We are not responsible for delays caused by courier partners or incorrect address details.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>7. Returns & Refunds</h2>
                            <div className={styles.sectionContent}>
                                <p>Due to the perishable nature of food products:</p>
                                <ul>
                                    <li>Returns are not accepted once delivered.</li>
                                    <li>Refunds/Replacements are considered only for damaged or incorrect items reported within 3 hours with proof.</li>
                                    <li>Cancellations are accepted only before dispatch.</li>
                                </ul>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>8. Product Usage & Storage</h2>
                            <div className={styles.sectionContent}>
                                <p>Freshly prepared products should be stored as per instructions on packaging. We are not responsible for issues arising from improper storage.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>9. Intellectual Property</h2>
                            <div className={styles.sectionContent}>
                                <p>All content on the website is the intellectual property of Hurigalu Angadi. Unauthorized use is strictly prohibited.</p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>10. Limitation of Liability</h2>
                            <div className={styles.sectionContent}>
                                <p>Hurigalu Angadi shall not be liable for allergic reactions (check ingredients) or service interruptions beyond our control.</p>
                            </div>
                        </div>

                        <div className={styles.contactBox}>
                            <h4>11. Contact Us</h4>
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
