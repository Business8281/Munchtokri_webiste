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

export default function RefundClient() {
    return (
        <main className={styles.policyContainer}>
            {/* Hero Section */}
            <section className={styles.hero}>
                <div className="container">
                    <motion.div {...fadeIn}>
                        <h1 className={styles.heroTitle}>Refund & Return Policy</h1>
                        <p className={styles.heroDesc}>
                            Our commitment to quality ensures that every bite is authentic. Here is how we handle returns and refunds.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Content Section */}
            <section className={styles.content}>
                <div className="container">
                    <motion.div className={styles.card} {...fadeIn} transition={{ delay: 0.2 }}>
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>1. Perishable Items</h2>
                            <div className={styles.sectionContent}>
                                <p>
                                    Due to the perishable nature of our traditional snacks, we generally do not accept returns once a product has been delivered.
                                </p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>2. Damaged or Incorrect Items</h2>
                            <div className={styles.sectionContent}>
                                <p>
                                    If you receive a damaged product or the wrong item, please contact our support team within 3 hours of delivery with photographic proof. 
                                    Refunds or replacements will be processed after validation.
                                </p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>3. Processing Refunds</h2>
                            <div className={styles.sectionContent}>
                                <p>
                                    Approved refunds will be processed back to the original payment method within 5-7 business days.
                                </p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>4. Cancellations</h2>
                            <div className={styles.sectionContent}>
                                <p>
                                    Orders can only be cancelled before they are dispatched. Once an order is in transit, cancellation is not possible.
                                </p>
                            </div>
                        </div>

                        <div className={styles.contactBox}>
                            <h4>Need help with a refund?</h4>
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
