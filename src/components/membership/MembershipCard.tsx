"use client";

import React, { useEffect, useState } from 'react';
import { Check, Star, Zap, Shield, Loader2 } from 'lucide-react';
import JoinButton from './JoinButton';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface MembershipPlan {
    id: string;
    name: string;
    price: number;
    priceLabel: string;
    tagline: string;
    razorpayPlanId: string;
    razorpayPaymentLink: string;
    benefits: string[];
    isLive: boolean;
}

export default function MembershipCard({ planId }: { planId?: string }) {
    const [plan, setPlan] = useState<MembershipPlan | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Live listener for membership plan
        const unsub = onSnapshot(doc(db, 'settings', 'membership'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.plans && Array.isArray(data.plans)) {
                    const selected = planId 
                        ? data.plans.find((p: any) => p.id === planId)
                        : data.plans.find((p: any) => p.isLive);
                    setPlan(selected || data.plans[0]);
                } else if (data.price !== undefined) {
                    // Legacy format
                    setPlan({
                        id: 'default',
                        name: 'Munch Tokri Membership',
                        ...data
                    } as MembershipPlan);
                }
            }
            setLoading(false);
        }, (error) => {
            console.error("Error listening to membership plan:", error);
            setLoading(false);
        });

        return () => unsub();
    }, [planId]);

    if (loading) {
      return (
        <div className="w-full max-w-sm h-[500px] bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-[var(--primary)]" size={32} />
          <p className="mt-4 text-zinc-500 font-medium">Loading membership info...</p>
        </div>
      );
    }

    if (!plan) return null;

    return (
        <div className="relative group max-w-sm w-full mx-auto">
            {/* Background Decorative element */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            
            <div className="relative bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col p-8 h-full min-h-[500px]">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 font-outfit">{plan.name}</h3>
                        <p className="text-[var(--primary)] font-bold tracking-widest text-xs uppercase mt-1">Membership</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl flex items-center justify-center">
                        <Star className="text-[var(--primary)] fill-[var(--primary)]" size={24} />
                    </div>
                </div>

                {/* Price */}
                <div className="mb-8">
                    <div className="flex items-baseline">
                        <span className="text-5xl font-black text-zinc-900 dark:text-zinc-50">₹{plan.price}</span>
                        <span className="text-zinc-500 dark:text-zinc-400 ml-2 font-medium">{plan.priceLabel}</span>
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 font-medium italic">{plan.tagline}</p>
                </div>

                {/* Benefits List */}
                <div className="space-y-4 mb-10 flex-grow">
                    {plan.benefits.map((benefit, index) => (
                        <div key={index} className="flex items-center gap-3">
                            <div className="h-6 w-6 bg-[var(--primary)] rounded-full flex items-center justify-center flex-shrink-0 animate-pulse-slow">
                                <Check className="text-white" size={12} />
                            </div>
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium"> {benefit} </span>
                        </div>
                    ))}
                </div>

                {/* Footer/CTA */}
                <div className="mt-auto space-y-4">
                    <JoinButton 
                        planId={plan.id}
                        paymentLink={plan.razorpayPaymentLink}
                        className="w-full py-4 text-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-[var(--primary)]/20" 
                    />
                    
                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 dark:text-zinc-500 font-medium font-outfit uppercase tracking-tighter">
                        <Shield size={12} className="text-zinc-400" />
                        <span>Secure Payment by Razorpay</span>
                    </div>
                </div>

                {/* Floating Badge */}
                {plan.price > 0 && (
                  <div className="absolute top-0 right-0 p-4 -mr-2 -mt-2">
                      <div className="bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-black px-2 py-1 rounded-full border border-[var(--accent)]/20 shadow-sm rotate-12 flex items-center gap-1">
                          <Zap size={10} fill="currentColor" />
                          <span>BEST VALUE</span>
                      </div>
                  </div>
                )}
            </div>
            
        </div>
    );
}
