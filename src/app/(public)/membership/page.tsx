"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
    Check,
    X,
    Star,
    Zap,
    ShieldCheck,
    Clock,
    ShoppingBag,
    Truck,
    Gift,
    Heart,
    ArrowRight,
    HelpCircle,
    Cake,
    Package,
    Sparkles,
    Loader2
} from 'lucide-react';
import MembershipCard from '@/components/membership/MembershipCard';
import Button from '@/components/ui/Button/Button';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import styles from './MembershipPage.module.css';

interface MembershipPlan {
    id: string;
    name: string;
    price: number;
    priceLabel: string;
    tagline: string;
    razorpayPlanId: string;
    benefits: string[];
    isLive: boolean;
}

const benefits = [
    {
        title: "Free Delivery Always",
        desc: "No more minimum order values. Get free shipping on every single order, no matter how small.",
        icon: <Truck size={32} />
    },
    {
        title: "Flat 10% Extra Off",
        desc: "Save more on every purchase. Members get an additional 10% discount that stacks with other offers.",
        icon: <Zap size={32} />
    },
    {
        title: "Priority Handling",
        desc: "Skip the queue. Member orders are packed and dispatched with the highest priority.",
        icon: <Clock size={32} />
    },
    {
        title: "Early Access",
        desc: "Be the first to taste our new launches and seasonal special combos before they go public.",
        icon: <Star size={32} />
    },
    {
        title: "Exclusive Offers",
        desc: "Access member-only flash sales and special discounts curated just for the Munch Tokri Club.",
        icon: <Gift size={32} />
    },
    {
        title: "VIP Support",
        desc: "Direct access to our dedicated customer delight team for any assistance you need.",
        icon: <Heart size={32} />
    },
    {
        title: "Birthday Special",
        desc: "Celebrate with us! Get a special surprise gift or extra discount during your birthday month.",
        icon: <Cake size={32} />
    },
    {
        title: "Bulk Discounts",
        desc: "Ordering for an event? Members get exclusive wholesale pricing on bulk orders.",
        icon: <Package size={32} />
    },
    {
        title: "Member-Only Mixes",
        desc: "Access limited-edition mixture combinations and custom packs available only to the club.",
        icon: <Sparkles size={32} />
    }
];

export default function MembershipPage() {
    const [plans, setPlans] = useState<MembershipPlan[]>([]);
    const [pageContent, setPageContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        // 1. Listen for Plans
        const unsubscribePlans = onSnapshot(doc(db, 'settings', 'membership'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.plans && Array.isArray(data.plans)) {
                    setPlans(data.plans.filter((p: MembershipPlan) => p.isLive));
                }
            }
        });

        // 2. Listen for Page Dynamic Content (Hero, Benefits, FAQ)
        const unsubscribePage = onSnapshot(doc(db, 'settings', 'membership_page'), (snap) => {
            if (snap.exists()) {
                setPageContent(snap.data());
            }
            setLoading(false);
        }, (err) => {
            console.error("Error listening for page content:", err);
            setLoading(false);
        });

        return () => {
            unsubscribePlans();
            unsubscribePage();
        };
    }, []);

    // Enforce Login View if user is not authenticated
    const [user, setUser] = useState<any>(null);
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
            setUser(u);
        });
        return () => unsubscribe();
    }, []);

    if (!loading && !user) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-zinc-50 dark:bg-zinc-950">
                <div className="w-20 h-20 bg-orange-100 dark:bg-orange-950/20 rounded-3xl flex items-center justify-center text-orange-600 mb-6">
                    <Star size={40} fill="currentColor" />
                </div>
                <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 mb-2">Exclusive for Members</h2>
                <p className="text-zinc-500 max-w-md mb-8">Login to your Munch Tokri account to view available membership plans and unlock premium savings.</p>
                <Link href={`/login?redirect=${encodeURIComponent('/membership')}`}>
                    <Button variant="primary" size="lg" className="px-12">Login to View Plans</Button>
                </Link>
            </div>
        );
    }

    const displayHero = pageContent?.hero || {
        label: "The Munch Tokri Club",
        title: "Elevate Your Snacking Game",
        desc: "Join our exclusive club and unlock premium benefits, huge savings, and priority access to Karnataka's finest handcrafted snacks."
    };

    const displayBenefits = pageContent?.benefits || [
        { title: "Free Delivery Always", desc: "No more minimum order values. Get free shipping on every single order, no matter how small." },
        { title: "Flat 10% Extra Off", desc: "Save more on every purchase. Members get an additional 10% discount that stacks with other offers." },
        { title: "Priority Handling", desc: "Skip the queue. Member orders are packed and dispatched with the highest priority." },
        { title: "Early Access", desc: "Be the first to taste our new launches and seasonal special combos before they go public." },
        { title: "Exclusive Offers", desc: "Access member-only flash sales and special discounts curated just for the Munch Tokri Club." },
        { title: "VIP Support", desc: "Direct access to our dedicated customer delight team for any assistance you need." },
        { title: "Birthday Special", desc: "Celebrate with us! Get a special surprise gift or extra discount during your birthday month." },
        { title: "Bulk Discounts", desc: "Ordering for an event? Members get exclusive wholesale pricing on bulk orders." },
        { title: "Member-Only Mixes", desc: "Access limited-edition mixture combinations and custom packs available only to the club." }
    ];

    const displayFaqs = pageContent?.faqs || [
        { q: "What is the Munch Tokri Club?", a: "It's our exclusive membership program designed for our most loyal customers to enjoy extra savings, free shipping, and priority service." },
        { q: "How much does it cost?", a: plans.length > 0 ? `We have plans starting at just ₹${Math.min(...plans.map(p => p.price))}. Select the tier that fits you best!` : "The membership is very affordable. Join to unlock massive savings!" },
        { q: "How do I use my discount?", a: "Once you're a member, your member benefits are automatically applied at checkout when you're logged into your account. No coupon codes needed!" },
        { q: "Is there a limit on free delivery?", a: "For club members, we offer free delivery on orders as per the plan benefits. Most plans include unlimited free delivery nationwide!" }
    ];

    // Helper to get static icon mapping (or default)
    const getBenefitIcon = (index: number) => {
        const icons = [<Truck key={0} size={32} />, <Zap key={1} size={32} />, <Clock key={2} size={32} />, <Star key={3} size={32} />, <Gift key={4} size={32} />, <Heart key={5} size={32} />, <Cake key={6} size={32} />, <Package key={7} size={32} />, <Sparkles key={8} size={32} />];
        return icons[index % icons.length];
    };

    const displayComparison = pageContent?.comparison || [
        { feature: "Extra 10% Off Every Order", guest: "No", member: "Yes" },
        { feature: "Unlimited Free Delivery", guest: "Starts at ₹350", member: "Always Free" },
        { feature: "Priority Order Packing", guest: "Standard", member: "VIP Priority" },
        { feature: "Early Access to Special Packs", guest: "No", member: "Yes" },
        { feature: "Member-only Flash Sales", guest: "No", member: "Yes" }
    ];

    // Helper to render check/x or text
    const renderCompareValue = (val: string, isMember: boolean) => {
        const lower = val.toLowerCase().trim();
        if (lower === 'yes' || lower === 'true' || lower === 'check') {
            return <Check className={styles.checkIcon} size={20} />;
        }
        if (lower === 'no' || lower === 'false' || lower === 'x') {
            return <X className={styles.xIcon} size={20} />;
        }
        return <span className={isMember ? styles.premiumText : ''}>{val}</span>;
    };

    return (
        <div className={styles.membershipPage}>
            {/* ... hero ... */}
            <section className={styles.hero}>
                <div className={styles.heroBackground}>
                    <div className={styles.blob1}></div>
                    <div className={styles.blob2}></div>
                </div>

                <div className="container">
                    <div className={styles.heroContent}>
                        <div className={styles.heroText}>
                            <div className={styles.heroLabel}>
                                <Star size={14} fill="currentColor" />
                                <span>{displayHero.label}</span>
                            </div>
                            <h1 className={styles.heroTitle}>
                                {displayHero.title.split('\n').map((line: string, i: number) => (
                                    <React.Fragment key={i}>
                                        {line}
                                        {i === 0 && <br />}
                                    </React.Fragment>
                                ))}
                            </h1>
                            <p className={styles.heroDesc}>
                                {displayHero.desc}
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <Link href="#join">
                                    <Button variant="primary" size="lg">View All Plans</Button>
                                </Link>
                                <Link href="/shop">
                                    <Button variant="ghost" size="lg">Explore Products</Button>
                                </Link>
                            </div>
                        </div>

                        <div className={styles.heroCard}>
                            {loading ? (
                              <div className="w-[350px] h-[450px] flex items-center justify-center bg-white/50 rounded-3xl">
                                <Loader2 className="animate-spin text-[var(--primary)]" size={40} />
                              </div>
                            ) : plans.length > 0 ? (
                              <MembershipCard planId={plans[0].id} />
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits Grid */}
            <section className={styles.benefits}>
                <div className="container">
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionLabel}>Why Join Us?</span>
                        <h2 className={styles.sectionTitle}>Exclusive Member Benefits</h2>
                        <p className="text-zinc-500 font-medium">Designed to give you the best traditional snack experience possible.</p>
                    </div>

                    <div className={styles.benefitGrid}>
                        {displayBenefits.map((benefit: any, i: number) => (
                            <div key={i} className={styles.benefitCard}>
                                <div className={styles.iconWrapper}>
                                    {getBenefitIcon(i)}
                                </div>
                                <h3>{benefit.title}</h3>
                                <p>{benefit.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Comparison Table */}
            <section className={styles.comparison}>
                <div className="container">
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Membership vs Guest</h2>
                        <p className="text-zinc-500 font-medium">See how much more you get as a Munch Tokri Club member.</p>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.compareTable}>
                            <thead>
                                <tr>
                                    <th className={styles.featureCol}>Feature</th>
                                    <th>Guest</th>
                                    <th className={styles.premiumText}>Club Member</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayComparison.map((row: any, i: number) => (
                                    <tr key={i}>
                                        <td className={styles.featureCol}>{row.feature}</td>
                                        <td>{renderCompareValue(row.guest, false)}</td>
                                        <td>{renderCompareValue(row.member, true)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className={styles.faq}>
                <div className="container">
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Common Questions</h2>
                    </div>

                    <div className={styles.faqGrid}>
                        {displayFaqs.map((faq: any, i: number) => (
                            <div key={i} className={styles.faqItem}>
                                <div className="flex gap-4">
                                    <HelpCircle className="text-[var(--primary)] flex-shrink-0" size={24} />
                                    <div>
                                        <h4>{faq.q}</h4>
                                        <p>{faq.a}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA - Show All Plans */}
            <section id="join" className={styles.cta}>
                <div className="container">
                    <div className={styles.ctaBox}>
                        <h2>Choose Your Plan</h2>
                        <p>Join thousands of happy snackers in the Munch Tokri Club today.</p>
                        <div className="flex flex-wrap justify-center gap-8 mt-12">
                            {loading ? (
                              <Loader2 className="animate-spin text-[var(--primary)]" size={40} />
                            ) : plans.length > 0 ? (
                              plans.map(plan => (
                                <MembershipCard key={plan.id} planId={plan.id} />
                              ))
                            ) : (
                              <p className="text-zinc-400">No active plans available at the moment.</p>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
