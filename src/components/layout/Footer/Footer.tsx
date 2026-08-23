"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Facebook, Twitter, Instagram, Phone, Mail, MapPin } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './Footer.module.css';

interface StoreSettings {
    storeName: string;
    contactEmail: string;
    contactNumber: string;
    address: string;
}

const Footer = () => {
    const [settings, setSettings] = useState<StoreSettings | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'store');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(docSnap.data() as StoreSettings);
                }
            } catch (error) {
                console.error("Error fetching footer settings:", error);
            }
        };
        fetchSettings();
    }, []);

    return (
        <footer className={styles.footer}>
            <div className={`${styles.container} container`}>
                <div className={styles.brand}>
                    <div className={styles.logoWrapper}>
                        <Link href="/">
                            <Image
                                src="/logo.png"
                                alt="Munch Tokri Logo"
                                width={92}
                                height={80}
                                className={styles.logoImage}
                            />
                        </Link>
                    </div>
                    <p className={styles.description}>
                        Preserving the authentic taste of Karnataka since 1961. Handcrafted with love and traditional recipes.
                    </p>
                    <div className={styles.contactInfo}>
                        {settings?.contactNumber && (
                            <div className={styles.contactItem}>
                                <Phone size={16} />
                                <span>{settings.contactNumber}</span>
                            </div>
                        )}
                        {settings?.contactEmail && (
                            <div className={styles.contactItem}>
                                <Mail size={16} />
                                <span>{settings.contactEmail}</span>
                            </div>
                        )}
                    </div>
                    <div className={styles.socials}>
                        <a href="https://www.facebook.com/share/v/1C4eJdjyfm/" target="_blank" rel="noopener noreferrer"><Facebook size={20} /></a>
                        <a href="https://www.instagram.com/munch_tokri?igsh=Z2UxYWg0MnRobjJo&utm_source=qr" target="_blank" rel="noopener noreferrer"><Instagram size={20} /></a>
                    </div>
                </div>

                <div className={styles.links}>
                    <h3>Our Services</h3>
                    <Link href="/shop">Munch Products</Link>
                    <Link href="/build-mixture">Munch Your Mix</Link>
                    <Link href="/combos">Combo Packs</Link>
                </div>

                <div className={styles.links}>
                    <h3>Quick Links</h3>
                    <Link href="/about">About Us</Link>
                    <Link href="/membership">Munch Tokri Club</Link>
                    <Link href="/contact">Contact Us</Link>
                    <Link href="/shop?category=Best Sellers">Best Sellers</Link>
                </div>

                <div className={styles.links}>
                    <h3>Information</h3>
                    <Link href="/privacy">Privacy Policy</Link>
                    <Link href="/terms">Terms & Conditions</Link>
                    <Link href="/shipping">Shipping Policy</Link>
                    <Link href="/refund">Refund Policy</Link>
                </div>
            </div>
            <div className={styles.bottom}>
                <div className={`${styles.container} ${styles.bottomContainer}`}>
                    <p>&copy; {new Date().getFullYear()} {settings?.storeName || 'Munch Tokri'} - Traditional Karnataka Snacks since 1961.</p>
                    <p className={styles.developer}>
                        Developed by <a href="https://www.xrmarketing.in" target="_blank" rel="noopener noreferrer">xrmarketing</a>
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
