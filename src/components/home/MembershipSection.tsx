"use client";

import React, { useEffect, useState } from 'react';
import MembershipCard from '@/components/membership/MembershipCard';
import { Sparkles, ShieldCheck, Zap, Heart, Loader2, Edit3, Clock, Truck, Gift, Cake, Package } from 'lucide-react';
import Link from 'next/link';
import { useFirebase } from '@/contexts/FirebaseContext';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, adminAuth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

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

export default function MembershipSection() {
    const { auth } = useFirebase();
    const user = auth.currentUser;
    const [primaryPlan, setPrimaryPlan] = useState<MembershipPlan | null>(null);
    const [pageContent, setPageContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        // 1. Live listener for membership plans (to get pricing)
        const unsubSettings = onSnapshot(doc(db, 'settings', 'membership'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.plans && Array.isArray(data.plans)) {
                    const live = data.plans.find((p: any) => p.isLive);
                    setPrimaryPlan(live || data.plans[0]);
                } else if (data.price !== undefined) {
                    setPrimaryPlan({ id: 'default', ...data } as MembershipPlan);
                }
            }
        }, (err) => {
            console.error('Membership settings listen error:', err);
        });

        // 2. Live listener for membership page content (Title, Desc, Benefits)
        const unsubPage = onSnapshot(doc(db, 'settings', 'membership_page'), (snap) => {
            if (snap.exists()) {
                setPageContent(snap.data());
            }
            setLoading(false);
        }, (err) => {
            console.error('Membership page settings listen error:', err);
            setLoading(false);
        });

        const unsubAdmin = onAuthStateChanged(adminAuth, (u) => {
            setIsAdmin(!!u);
        });

        return () => {
            unsubSettings();
            unsubPage();
            unsubAdmin();
        };
    }, []);

    const displayHero = pageContent?.hero || {
        label: "Exclusive Club",
        title: "The Ultimate \nSnacking Privilege",
        desc: `Join the Munch Tokri Club ${primaryPlan ? `for just ₹${primaryPlan.price}${primaryPlan.priceLabel}` : ''} and unlock a world of authentic flavors with VIP benefits.`
    };

    const defaultBenefits = [
        { title: "Free Delivery", desc: "On every single order, no limits.", icon: <Zap size={24} />, color: 'primary' },
        { title: "10% Extra Off", desc: "Stackable with existing offers.", icon: <ShieldCheck size={24} />, color: 'emerald' },
        { title: "Early Access", desc: "To new launches & combos.", icon: <Sparkles size={24} />, color: 'accent' },
        { title: "Priority Care", desc: "Direct VIP support line.", icon: <Heart size={24} />, color: 'secondary' },
    ];

    const displayBenefits = pageContent?.benefits?.slice(0, 4).map((b: any, i: number) => {
        const iconMap = [
            { icon: <Zap size={24} />, color: 'primary' },
            { icon: <ShieldCheck size={24} />, color: 'emerald' },
            { icon: <Sparkles size={24} />, color: 'accent' },
            { icon: <Heart size={24} />, color: 'secondary' },
            { icon: <Clock size={24} />, color: 'amber' },
            { icon: <Truck size={24} />, color: 'sky' },
            { icon: <Gift size={24} />, color: 'rose' },
            { icon: <Package size={24} />, color: 'indigo' },
            { icon: <Cake size={24} />, color: 'pink' },
        ];
        const style = iconMap[i % iconMap.length];
        return { ...b, icon: style.icon, className: style.color };
    }) || defaultBenefits;

    const getColorClass = (color: string) => {
        switch (color) {
            case 'emerald': return 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600';
            case 'accent': return 'bg-[var(--accent)]/10 text-[var(--accent)]';
            case 'secondary': return 'bg-[var(--secondary)]/10 text-[var(--secondary)]';
            case 'amber': return 'bg-amber-50 dark:bg-amber-900/10 text-amber-600';
            case 'sky': return 'bg-sky-50 dark:bg-sky-900/10 text-sky-600';
            case 'rose': return 'bg-rose-50 dark:bg-rose-900/10 text-rose-600';
            case 'indigo': return 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600';
            case 'pink': return 'bg-pink-50 dark:bg-pink-900/10 text-pink-600';
            default: return 'bg-[var(--primary)]/10 text-[var(--primary)]';
        }
    };

    return (
        <section className="relative py-24 overflow-hidden bg-white dark:bg-zinc-950">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--primary)] rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--accent)] rounded-full blur-[120px]"></div>
            </div>

            <div className="container relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    {/* Left: Content */}
                    <div className="max-w-2xl animate-fade-in">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-black uppercase tracking-widest border border-[var(--primary)]/20">
                                <Sparkles size={14} className="animate-pulse" />
                                <span>{displayHero.label}</span>
                            </div>

                            {isAdmin && (
                                <Link 
                                    href="/admin/memberships?tab=page"
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all group/edit"
                                    title="Edit Membership Content"
                                >
                                    <Edit3 size={12} className="group-hover/edit:rotate-12 transition-transform" />
                                    <span>Edit Section</span>
                                </Link>
                            )}
                        </div>
                        
                        <h2 className="text-4xl md:text-7xl font-black text-zinc-900 dark:text-zinc-50 mb-8 font-outfit tracking-tight leading-[1.05]">
                            {displayHero.title.split('\n').map((line: string, i: number) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <br />}
                                    {line.includes(' Privilege') ? (
                                        <>
                                            {line.replace(' Privilege', '')}
                                            <span className="text-[var(--primary)]"> Privilege</span>
                                        </>
                                    ) : (
                                        line
                                    )}
                                </React.Fragment>
                            ))}
                        </h2>
                        
                        <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-12 font-medium leading-relaxed max-w-xl whitespace-pre-line">
                            {displayHero.desc}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
                            {displayBenefits.map((benefit: any, i: number) => (
                                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group">
                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${getColorClass(benefit.className)}`}>
                                        {benefit.icon}
                                    </div>
                                    <div className="pt-1">
                                        <h4 className="font-bold text-zinc-900 dark:text-zinc-50 text-lg">{benefit.title}</h4>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{benefit.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-8">
                            {!user && (
                                <div className="flex items-center gap-3 text-zinc-400 dark:text-zinc-500 text-base font-medium">
                                    <Link href="/login" className="hover:text-[var(--primary)] transition-colors underline decoration-[var(--primary)]/30 underline-offset-4">Sign in</Link> to check your status
                                </div>
                            )}
                            <Link href="/membership" className="text-[var(--primary)] font-bold flex items-center gap-2 hover:translate-x-1 transition-transform">
                                Explore All Plans <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>

                    {/* Right: Membership Card */}
                    <div className="relative flex justify-center lg:justify-end animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <div className="relative z-10 w-full max-w-[400px]">
                            {loading ? (
                                <div className="h-[500px] flex items-center justify-center bg-white/5  rounded-3xl border border-dashed border-zinc-200">
                                    <Loader2 className="animate-spin text-[var(--primary)]" />
                                </div>
                            ) : (
                                <MembershipCard planId={primaryPlan?.id} />
                            )}
                        </div>
                        
                        {/* Floating visual flair */}
                        <div className="absolute -top-20 -right-20 h-64 w-64 bg-[var(--primary)]/10 rounded-full blur-[100px] animate-pulse-slow"></div>
                        <div className="absolute -bottom-20 -left-20 h-64 w-64 bg-[var(--accent)]/10 rounded-full blur-[100px] animate-pulse-slow-reverse"></div>
                    </div>
                </div>
            </div>
        </section>
    );
}

const ArrowRight = ({ size, className }: { size: number, className?: string }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M5 12h14m-7-7 7 7-7 7"/>
    </svg>
);
