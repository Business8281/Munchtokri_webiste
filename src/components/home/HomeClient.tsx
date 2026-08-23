"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Leaf, Droplets, History, Sprout, Hammer, Star, ChevronLeft, ChevronRight, Mouse } from 'lucide-react';
import { motion } from 'framer-motion';
import { useProducts } from '@/hooks/useFirestore';
import Button from '@/components/ui/Button/Button';
import ProductCard from '@/components/ui/Card/ProductCard';
import { Product } from '@/types';
import MembershipSection from '@/components/home/MembershipSection';
import styles from '@/app/(public)/page.module.css';

const featureIcons: Record<string, React.ReactNode> = {
    "NO PRESERVATIVES": <ShieldCheck size={24} />,
    "NO PALM OIL": <Leaf size={24} />,
    "RICE BRAN OIL": <Droplets size={24} />,
    "60+ YEARS HERITAGE": <History size={24} />,
    "NATURAL INGREDIENTS": <Sprout size={24} />,
    "HANDCRAFTED QUALITY": <Hammer size={24} />
};

const testimonials = [
    { name: "Srinivasa Murthy", role: "Malleswaram Resident", review: "The taste of Hurigalu here takes me back to my childhood. Authentic and fresh every time!" },
    { name: "Laxmi Rao", role: "Home Maker", review: "I love their Mixture. It's not oily like others and the spices are perfectly balanced." },
    { name: "Prakash Raj", role: "Software Engineer", review: "Great snacks for the office. The Masoor Dhamaka is my absolute favorite!" },
    { name: "Vinutha S.", role: "Teacher", review: "Quality ingredients and traditional taste. Best snacks in Bangalore, hands down." },
    { name: "Girish Karnad", role: "Cultural Historian", review: "Hurigalu Angadi is a part of our heritage. Glad they are keeping the tradition alive." },
    { name: "Anupama Hegde", role: "Food Blogger", review: "If you want real Karnataka snacks, this is the place. Their Sabu Dana Puff is so light and tasty." },
    { name: "Venkatramana K.", role: "Retired Officer", review: "Been buying from here for 40 years. The quality has never changed. Highly recommended." },
    { name: "Kavitha Gowda", role: "Student", review: "Affordable and delicious! The Corn Craze is addictive. Love the packaging too." },
    { name: "Raghavendra Rao", role: "Banker", review: "Perfect for tea time. Their snacks are crunchy and full of flavor. My kids love it." },
    { name: "Sudha Murthy", role: "Writer", review: "Simple, honest, and traditional. Exactly how Bangalore's heritage snacks should be." },
    { name: "Manjunath Swamy", role: "Business Owner", review: "Consistent taste and great service. We order in bulk for all our family functions." },
    { name: "Deepa Narayan", role: "Artist", review: "The Red Roast Hurigalu is unique and very healthy. Best snacking option for fitness lovers." }
];

interface HomeClientProps {
    bestSellers: Product[];
}

export default function HomeClient({ bestSellers }: HomeClientProps) {
    const { products: liveProducts, loading } = useProducts();
    const [products, setProducts] = useState<Product[]>(bestSellers);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Force muted via JS to bypass browser inconsistencies
        video.muted = true;
        video.defaultMuted = true;

        const attemptPlay = async () => {
            try {
                // Ensure muted again before trying to play
                video.muted = true;
                await video.play();
                console.log("Hero video playing successfully");
            } catch (error) {
                console.log("Autoplay blocked or failed, waiting for interaction");
                
                // On block, we wait for any interaction to trigger play
                const triggerPlay = () => {
                    video.play().catch(e => console.log("Manual play failed:", e));
                    window.removeEventListener('click', triggerPlay);
                    window.removeEventListener('touchstart', triggerPlay);
                    window.removeEventListener('scroll', triggerPlay);
                };
                window.addEventListener('click', triggerPlay, { once: true });
                window.addEventListener('touchstart', triggerPlay, { once: true });
                window.addEventListener('scroll', triggerPlay, { once: true });
            }
        };

        // Small initial delay can help some browsers resolve the stream
        const initialPlayTimeout = setTimeout(attemptPlay, 150);

        // Keep-alive: Sometimes videos pause when the tab goes background or power mode changes
        const keepAlive = setInterval(() => {
            if (video && video.paused) {
                video.play().catch(() => {});
            }
        }, 3000);

        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && video.paused) {
                video.play().catch(() => {});
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearTimeout(initialPlayTimeout);
            clearInterval(keepAlive);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    useEffect(() => {
        if (!loading && liveProducts.length > 0) {
            // Filter to just 8 featured products for the home page carousel
            setProducts(liveProducts.slice(0, 8));
        }
    }, [liveProducts, loading]);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { scrollLeft, clientWidth } = scrollContainerRef.current;
            const scrollTo = direction === 'left'
                ? scrollLeft - clientWidth * 0.8
                : scrollLeft + clientWidth * 0.8;

            scrollContainerRef.current.scrollTo({
                left: scrollTo,
                behavior: 'smooth'
            });
        }
    };
    return (
        <main className={styles.main}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "VideoObject",
                        "name": "Authentic Karnataka Snacks - Munch Tokri Since 1961",
                        "description": "Experience the heritage of handcrafted traditional snacks from Bangalore's iconic Hurigalu Angadi.",
                        "thumbnailUrl": [
                            "https://munchtokri.com/images/hero_snacks.png"
                        ],
                        "uploadDate": "2024-01-01T08:00:00+08:00",
                        "duration": "PT0M30S",
                        "contentUrl": "https://munchtokri.com/herovideo.webm",
                        "embedUrl": "https://munchtokri.com/",
                        "interactionStatistic": {
                            "@type": "InteractionCounter",
                            "interactionType": { "@type": "WatchAction" },
                            "userInteractionCount": 1024
                        }
                    })
                }}
            />
            <section className={styles.hero}>
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    className={styles.heroVideo}
                    poster="/images/hero_snacks.png"
                    style={{ background: '#000' }}
                >
                    <source src="/herovideo.mp4" type="video/mp4" />
                    <source src="/herovideo.webm" type="video/webm" />
                    Your browser does not support the video tag.
                </video>
                <div className={styles.heroOverlay}></div>
                <div className={`${styles.heroContainer} container`}>
                    <div className={styles.heroContent}>
                        <motion.span
                            className={styles.heroLabel}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            ESTABLISHED 1961 - MALLESWARAM
                        </motion.span>
                        <motion.h1
                            className={styles.heroTitle}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                        >
                            Authentic <br />
                            <span>Karnataka Snacks</span> <br />
                            Since 1961
                        </motion.h1>
                        <motion.p
                            className={styles.heroDesc}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                        >
                            Handcrafted traditional snacks made with natural ingredients, roasted
                            in fire breeze and backed by 60+ years of heritage.
                        </motion.p>
                        <motion.div
                            className={styles.heroBtns}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.6 }}
                        >
                            <Link href="/shop">
                                <Button variant="primary" size="lg">Shop Now</Button>
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Best Sellers */}
            <section className={styles.bestSellers}>
                <div className="container">
                    <motion.div
                        className={styles.sectionHeader}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className={styles.sectionTitle}>Best Sellers</h2>
                        <Link href="/shop" className={styles.viewAll}>View all products →</Link>
                    </motion.div>
                    <motion.p
                        className={styles.sectionSubtitle}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                    >
                        Our most loved traditional delicacies, fresh from the roastery.
                    </motion.p>

                    <motion.div
                        className={styles.carouselContainer}
                        initial={{ opacity: 0, scale: 0.98 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <button
                            className={`${styles.navBtn} ${styles.prevBtn}`}
                            onClick={() => scroll('left')}
                            aria-label="Previous products"
                        >
                            <ChevronLeft size={24} />
                        </button>

                        <div className={styles.productCarousel} ref={scrollContainerRef}>
                            {products.length > 0 ? (
                                products.map((product) => (
                                    <div key={product.id} className={styles.carouselItem}>
                                        <ProductCard {...product} />
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', width: '100%' }}>
                                    Live products coming soon! Check back later.
                                </div>
                            )}
                        </div>

                        <button
                            className={`${styles.navBtn} ${styles.nextBtn}`}
                            onClick={() => scroll('right')}
                            aria-label="Next products"
                        >
                            <ChevronRight size={24} />
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* Build Your Mixture Section */}
            <section className={styles.buildMix}>
                <div className={`${styles.buildMixContainer} container`}>
                    <motion.div
                        className={styles.buildMixContent}
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <span className={styles.heroLabel}>NEW EXPERIENCE</span>
                        <h2 className={styles.sectionTitle}>Build Your <span>Own Mixture</span></h2>
                        <p>
                            Why settle for standard when you can create a masterpiece?
                            Choose from over 20+ authentic ingredients—from spicy boondi to
                            roasted cashews—and craft a mixture that&apos;s uniquely yours.
                        </p>
                        <ul className={styles.buildMixFeatures}>
                            <motion.li
                                initial={{ opacity: 0, x: -10 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                            >✓ Choose Your Ingredients</motion.li>
                            <motion.li
                                initial={{ opacity: 0, x: -10 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                            >✓ Control the Proportions</motion.li>
                            <motion.li
                                initial={{ opacity: 0, x: -10 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                            >✓ Freshly Mixed for You</motion.li>
                        </ul>
                        <div className={styles.heroBtns}>
                            <Link href="/build-mixture">
                                <Button variant="primary" size="lg">Start Building Your Mix</Button>
                            </Link>
                        </div>
                    </motion.div>
                    <motion.div
                        className={styles.buildMixImage}
                        initial={{ opacity: 0, x: 30, scale: 0.95 }}
                        whileInView={{ opacity: 1, x: 0, scale: 1 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <Image
                            src="/mixture_banner.png"
                            alt="Custom Mixture Ingredients"
                            className={styles.bannerImg}
                            width={800}
                            height={600}
                            priority
                            sizes="(max-width: 768px) 100vw, 50vw"
                            style={{ width: '100%', height: 'auto' }}
                        />
                    </motion.div>
                </div>
            </section>

            {/* Snack Combos Section */}
            <section className={styles.combos}>
                <div className={`${styles.combosContainer} container`}>
                    <motion.div
                        className={styles.combosImage}
                        initial={{ opacity: 0, x: -30, scale: 0.95 }}
                        whileInView={{ opacity: 1, x: 0, scale: 1 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <Image
                            src="/images/combo.png"
                            alt="Curated Snack Combos"
                            className={styles.comboImg}
                            width={800}
                            height={600}
                            sizes="(max-width: 768px) 100vw, 50vw"
                            style={{ width: '100%', height: 'auto' }}

                        />
                    </motion.div>
                    <motion.div
                        className={styles.combosContent}
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <span className={styles.heroLabel}>CURATED FOR YOU</span>
                        <h2 className={styles.sectionTitle}>Snack Combos – <span>Perfect for Sharing</span></h2>
                        <p>
                            Our handpicked snack combinations are curated to give you a complete taste of Bangalore&apos;s roastery heritage. From festive boxes to everyday munching packs, find your perfect match.
                        </p>
                        <ul className={styles.buildMixFeatures}>
                            <motion.li initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>✓ Curated Selections</motion.li>
                            <motion.li initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>✓ Great Value Packs</motion.li>
                            <motion.li initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>✓ Gift-Ready Packaging</motion.li>
                        </ul>
                        <div className={styles.heroBtns}>
                            <Link href="/combos">
                                <Button variant="primary" size="lg">Explore Snack Combos</Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Membership Integration */}
            <MembershipSection />

            {/* Heritage Section */}
            <section className={styles.heritage}>
                <div className={`${styles.heritageContainer} container`}>
                    <motion.div
                        className={styles.heritageImage}
                        initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                        whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 1 }}
                    >
                        <Image
                            src="/images/angadi_shop.png"
                            alt="Vintage Malleswaram Shop 1961"
                            className={styles.heritageImg}
                            width={800}
                            height={600}
                            sizes="(max-width: 768px) 100vw, 50vw"
                            style={{ width: '100%', height: 'auto' }}

                        />
                    </motion.div>
                    <motion.div
                        className={styles.heritageContent}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <h2 className={styles.sectionTitle}>From a 10×4 ft shop in Malleswaram...</h2>
                        <p>
                            In 1961, Hurigalu Angadi began as a small dream in a modest 10x4
                            feet stall in the heart of Malleswaram, Bangalore. Our founder,
                            driven by his passion for authentic tastes, spent years perfecting
                            the art of roasting nuts and spices.
                        </p>
                        <p>
                            Today, we are a beloved heritage brand, but our methods remain
                            unchanged. Every snack is still handcrafted with the same love,
                            using traditional snacks that have been passed down through
                            three generations.
                        </p>
                        <div className={styles.stats}>
                            <motion.div
                                className={styles.stat}
                                initial={{ opacity: 0, scale: 0.5 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
                            >
                                <strong>60+</strong>
                                <span>Years</span>
                            </motion.div>
                            <motion.div
                                className={styles.stat}
                                initial={{ opacity: 0, scale: 0.5 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
                            >
                                <strong>1M+</strong>
                                <span>Happy Customers</span>
                            </motion.div>
                            <motion.div
                                className={styles.stat}
                                initial={{ opacity: 0, scale: 0.5 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.6, type: "spring", stiffness: 100 }}
                            >
                                <strong>50+</strong>
                                <span>Social Venues</span>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Why Choose Us */}
            <section className={styles.features}>
                <div className="container">
                    <motion.h2
                        className={styles.sectionTitle}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >Why Choose Us</motion.h2>
                    <div className={styles.featureGrid}>
                        {Object.keys(featureIcons).map((feature, i) => (
                            <motion.div
                                key={i}
                                className={styles.featureItem}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <div className={styles.featureIcon}>
                                    {featureIcons[feature]}
                                </div>
                                <span>{feature}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className={styles.testimonials}>
                <div className="container">
                    <motion.h2
                        className={styles.sectionTitle}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >What Our Customers Say</motion.h2>
                    <div className={styles.testimonialGrid}>
                        {testimonials.map((t, i) => (
                            <motion.div
                                key={i}
                                className={styles.testimonialCard}
                                initial={{ opacity: 0, x: 50 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <div className={styles.stars}>
                                    {[...Array(5)].map((_, starI) => (
                                        <Star key={starI} size={16} fill="currentColor" />
                                    ))}
                                </div>
                                <p>&quot;{t.review}&quot;</p>
                                <div className={styles.user}>
                                    <div>
                                        <strong>{t.name}</strong>
                                        <span>{t.role}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className={styles.cta}>
                <div className="container">
                    <motion.div
                        className={styles.ctaBox}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2>Taste Tradition Today</h2>
                        <p>Fresh batches delivered straight from our traditional kitchen to your doorstep.</p>
                        <Button variant="ghost" size="lg" className={styles.ctaBtn}>Order Now</Button>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}
