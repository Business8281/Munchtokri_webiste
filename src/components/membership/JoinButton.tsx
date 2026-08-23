"use client";

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useFirebase } from '@/contexts/FirebaseContext';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface JoinButtonProps {
    className?: string;
    text?: string;
    planId?: string;
    paymentLink?: string;
}

declare global {
    interface Window {
        Razorpay: any;
    }
}

export default function JoinButton({ 
    className, 
    text = "Join Membership Now",
    planId,
    paymentLink
}: JoinButtonProps) {
    const { auth } = useFirebase();
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(false);

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleJoin = async () => {
        const user = auth.currentUser;
        const targetTab = "/dashboard?tab=membership";

        // If we are not on the dashboard, navigate there (via login if needed)
        if (pathname !== '/dashboard' && pathname !== '/membership') {
            if (!user) {
                router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            } else {
                // If they are on homepage or elsewhere, maybe they stay there or go to checkout?
                // The original logic redirected to dashboard. We'll keep it for now but allow /membership too.
            }
        }

        if (!user) {
            toast.error("Please log in to join the membership");
            router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            return;
        }

        // If a direct payment link is provided, use it
        if (paymentLink) {
            window.location.href = paymentLink;
            return;
        }

        setLoading(true);
        try {
            const res = await loadRazorpayScript();
            if (!res) {
                toast.error("Failed to load Razorpay SDK. Please check your internet connection.");
                setLoading(false);
                return;
            }

            const response = await fetch("/api/create-subscription", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    userId: user.uid,
                    planId: planId
                }),
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                subscription_id: data.id,
                name: "Munch Tokri Membership",
                description: "Membership Subscription",
                image: "/logo.png",
                handler: function (response: any) {
                    console.log("Payment Success", response);
                    toast.success("Payment successful! Activating your membership...");
                    
                    // Redirect to success page with subscription details
                    const successUrl = `/membership/success?subscriptionId=${data.id}&paymentId=${response.razorpay_payment_id}`;
                    router.push(successUrl);
                },
                prefill: {
                    email: user.email,
                    name: user.displayName || '',
                },
                theme: {
                    color: "#f97316",
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error: any) {
            console.error("Join Membership Error:", error);
            toast.error(error.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleJoin}
            disabled={loading}
            className={`flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 ${className || 'px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl shadow-lg'}`}
        >
            {loading ? (
                <>
                    <Loader2 className="animate-spin" size={20} />
                    Processing...
                </>
            ) : (
                text
            )}
        </button>
    );
}
