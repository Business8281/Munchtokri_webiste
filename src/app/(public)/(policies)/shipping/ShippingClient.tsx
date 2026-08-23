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

export default function ShippingClient() {
    return (
        <main className={styles.policyContainer}>
            {/* Hero Section */}
            <section className={styles.hero}>
                <div className="container">
                    <motion.div {...fadeIn}>
                        <h1 className={styles.heroTitle}>Shipping & Delivery</h1>
                        <p className={styles.heroDesc}>
                            We strive to deliver our traditional handcrafted snacks to your doorstep with speed and care.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Content Section */}
            <section className={styles.content}>
                <div className="container">
                    <motion.div className={styles.card} {...fadeIn} transition={{ delay: 0.2 }}>
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>1. Shipping Timelines</h2>
                            <div className={styles.sectionContent}>
                                <p>
                                    Delivery timelines are estimates and may vary due to location, logistics, weather, or unforeseen circumstances. 
                                    Orders are typically processed within 24-48 hours.
                                </p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>2. Logistics Partners</h2>
                            <div className={styles.sectionContent}>
                                <p>
                                    We partner with reliable courier services to ensure your orders reach you in perfect condition. 
                                    However, we are not responsible for delays caused by courier partners once the order has been dispatched.
                                </p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>3. Shipping Charges</h2>
                            <div className={styles.sectionContent}>
                                <p>
                                    Delivery charges, if applicable, will be clearly mentioned at checkout. 
                                    These charges are calculated based on the weight of the order and the delivery location.
                                </p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>4. Address Information</h2>
                            <div className={styles.sectionContent}>
                                <p>
                                    Please ensure that the delivery address provided is accurate and complete. 
                                    We are not responsible for delivery failures or delays caused by incorrect or incomplete address details provided by the customer.
                                </p>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>5. Tracking Orders</h2>
                            <div className={styles.sectionContent}>
                                <p>
                                    Once your order is dispatched, you will receive tracking information via email or WhatsApp to monitor the status of your delivery.
                                </p>
                            </div>
                        </div>

                        <div className={styles.contactBox}>
                            <h4>Need help with your shipment?</h4>
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
