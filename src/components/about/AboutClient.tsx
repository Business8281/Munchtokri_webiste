"use client";

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Leaf, Ban, History, Sprout, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button/Button';
import styles from '@/app/(public)/about/about.module.css';

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

const scaleUp = {
    initial: { scale: 0.9, opacity: 0 },
    whileInView: { scale: 1, opacity: 1 },
    viewport: { once: true },
    transition: { duration: 0.6 }
};

const featureIcons: Record<string, React.ReactNode> = {
    "No Palm Oil": <Leaf size={24} />,
    "No Maida": <Ban size={24} />,
    "60+ Years Heritage": <History size={24} />,
    "Natural Ingredients": <Sprout size={24} />,
    "Handcrafted Quality": <Sparkles size={24} />
};

export default function AboutClient() {
    return (
        <main className={styles.aboutContainer}>
            {/* Hero Section - Mirrored from Home */}
            <section className={styles.hero}>
                <div className={`${styles.container} ${styles.flexLayout}`}>
                    <motion.div className={styles.heroContent} {...fadeIn}>
                        <span className={styles.heroLabel}>ESTABLISHED 1961 - MALLESWARAM</span>
                        <h1 className={styles.heroTitle}>
                            About
                        </h1>
                        <p className={styles.heroDesc}>
                            Munch Tokri is a modern extension of the timeless legacy of Hurigalu Angadi, a beloved snack brand that began its journey in 1961. We bring together taste, nutrition, and 60+ years of Bangalore heritage.
                        </p>
                    </motion.div>
                    <motion.div className={styles.imageSide} {...scaleUp}>
                        <Image
                            src="/images/about/munch_tokri_hero.png"
                            alt="Munch Tokri Snacks"
                            width={700} height={700} className={styles.contentImage}
                        />
                    </motion.div>
                </div>
            </section>

            {/* Our Story */}
            <section className={styles.section}>
                <div className={styles.container}>
                    <div className={`${styles.flexLayout} ${styles.imageLeft}`}>
                        <motion.div className={styles.textSide} {...fadeIn}>
                            <h2 className={`${styles.sectionTitle} ${styles.storyHeading}`}>
                                Our Story – <span>A Humble Beginning</span>
                            </h2>
                            <p className={styles.heroDesc} style={{ color: 'var(--text-secondary)', maxWidth: 'none' }}>
                                The story of Hurigalu Angadi began with a simple dream and a bicycle. In the early 1960s, an elderly entrepreneur started selling warm roasted groundnuts on the streets of Malleswaram. With just a cycle, a lantern, and an unwavering passion for flavor, he slowly built a loyal community of customers who loved the rich taste of his roasted snacks.
                            </p>
                        </motion.div>
                        <motion.div className={styles.imageSide} {...scaleUp}>
                            <Image
                                src="/images/about/story.png"
                                alt="Humble Beginning - Vintage Snack Seller"
                                width={600} height={400} className={styles.contentImage}
                            />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Growing Through Generations */}
            <section className={styles.section} style={{ background: '#fdfdfd' }}>
                <div className={styles.container}>
                    <div className={styles.flexLayout}>
                        <motion.div className={styles.textSide} {...fadeIn}>
                            <h2 className={`${styles.sectionTitle} ${styles.genHeading}`}>
                                Growing Through <span>Generations</span>
                            </h2>
                            <p className={styles.heroDesc} style={{ color: 'var(--text-secondary)', maxWidth: 'none' }}>
                                Over the decades, Hurigalu Angadi grew from a small local shop into a nostalgic destination for snack lovers across Bangalore. Today, the business proudly continues into its third generation and remains family-owned, preserving the same authenticity and warmth that started 60 years ago.
                            </p>
                        </motion.div>
                        <motion.div className={styles.imageSide} {...scaleUp}>
                            <Image
                                src="/images/store.png"
                                alt="Traditional Shop"
                                width={600} height={400} className={styles.contentImage}
                            />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Tradition Section */}
            <section className={styles.section}>
                <div className={styles.container}>
                    <div className={`${styles.flexLayout} ${styles.imageLeft}`}>
                        <motion.div className={styles.textSide} {...fadeIn}>
                            <h2 className={`${styles.sectionTitle} ${styles.modernHeading}`}>
                                Tradition Meets <span>Modernity</span>
                            </h2>
                            <p className={styles.heroDesc} style={{ color: 'var(--text-secondary)', maxWidth: 'none' }}>
                                While the soul of our recipes remains traditional, we have embraced modern roasting and packaging processes to ensure consistency and hygiene. Our methods evolved from traditional chulhas to modern roasting systems while preserving the authentic flavors known and loved by our community.
                            </p>
                        </motion.div>
                        <motion.div className={styles.imageSide} {...scaleUp}>
                            <Image
                                src="/images/manuf.png"
                                alt="Modern Production"
                                width={600} height={400} className={styles.contentImage}
                            />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Philosophy Section - Mirrored Primary Style */}
            <section className={`${styles.section} ${styles.philosophy}`}>
                <div className={styles.container}>
                    <motion.div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }} {...fadeIn}>
                        <span className={styles.heroLabel}>OUR ETHOS</span>
                        <h2 className={styles.sectionTitle}>Our Philosophy – Healthy Snacking</h2>
                        <p className={styles.heroDesc} style={{ margin: '0 auto 2rem' }}>
                            At Munch Tokri, we believe snacking should nourish the body as much as it delights the taste buds. We bring back wholesome snacks made with pulses, nuts and natural grains.
                        </p>
                    </motion.div>

                    <motion.div className={styles.featuresGrid} variants={staggerContainer} initial="initial" whileInView="whileInView" viewport={{ once: true }}>
                        {Object.keys(featureIcons).map((feature, i) => (
                            <motion.div key={i} className={styles.featureItem} variants={fadeIn}>
                                <div className={styles.featureIcon}>
                                    {featureIcons[feature]}
                                </div>
                                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'white' }}>{feature}</span>
                            </motion.div>
                        ))}
                    </motion.div>

                    <motion.div style={{ marginTop: '5rem' }} {...scaleUp}>
                        <Image
                            src="/images/about/philosophy.png"
                            alt="Healthy Ingredients"
                            width={1200} height={600} className={styles.contentImage}
                            style={{ transform: 'none' }}
                        />
                    </motion.div>
                </div>
            </section>

            {/* Product Assortment */}
            <section className={styles.section}>
                <div className={styles.container}>
                    <motion.div style={{ textAlign: 'center' }} {...fadeIn}>
                        <h2 className={styles.sectionTitle}>Nutritious <span>Authentic</span> Snacks</h2>
                        <p className={styles.heroDesc} style={{ margin: '0 auto', color: 'var(--text-secondary)' }}>
                            Naturally rich in plant protein, dietary fibre and essential healthy fats.
                        </p>
                    </motion.div>

                    <motion.div className={styles.productAssortment} variants={staggerContainer} initial="initial" whileInView="whileInView" viewport={{ once: true }}>
                        {["Mix-o-Mania", "Red Roast Hurigalu", "Zaika Blast", "Sabu Dana Puff", "Masoor Dhamaka", "Corn Craze"].map((product, i) => (
                            <motion.div key={i} className={styles.productTag} variants={scaleUp}>
                                {product}
                            </motion.div>
                        ))}
                    </motion.div>

                    <motion.div style={{ marginTop: '5rem' }} {...scaleUp}>
                        <Image
                            src="/images/about/products.png"
                            alt="Product Assortment"
                            width={1200} height={500} className={styles.contentImage}
                            style={{ transform: 'none' }}
                        />
                    </motion.div>
                </div>
            </section>

            {/* Promise Box */}
            <section className={styles.section}>
                <div className="container">
                    <motion.div className={styles.ctaBox} {...fadeIn}>
                        <h2 className={styles.headingFont}>Our Promise</h2>
                        <p style={{ maxWidth: '900px', margin: '0 auto 1rem', lineHeight: '1.8' }}>
                            For over six decades, our commitment has remained the same: Authentic flavors, honest ingredients and healthy snacking. Every bite delivers the warmth that began in 1961.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Image
                                src="/images/family.png"
                                alt="Family Sharing"
                                width={800} height={500}
                                className={styles.promiseImg}
                            />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* CTA Boxed - Mirrored from Home */}
            <section className={styles.ctaSection}>
                <div className="container">
                    <motion.div className={styles.ctaBox} {...fadeIn} style={{ background: 'var(--primary)' }}>
                        <h2 className={styles.headingFont}>Taste the Tradition</h2>
                        <p>Healthy munchies crafted with authentic Karnataka flavors.</p>
                        <Button variant="ghost" size="lg" onClick={() => window.location.href = '/shop'} className={styles.ctaBtn}>
                            Explore Our Snacks
                        </Button>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}
