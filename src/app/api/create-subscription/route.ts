import Razorpay from 'razorpay';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
    try {
        const { userId, planId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        // Fetch dynamic plan ID from Firestore
        const siteConfigSnap = await getDoc(doc(adminDb, 'settings', 'membership'));
        let razorpayPlanId = "plan_SXKsy3aNPYhIEh"; // Default fallback

        if (siteConfigSnap.exists()) {
            const data = siteConfigSnap.data();
            
            // If it's the new multi-plan format
            if (data.plans && Array.isArray(data.plans)) {
                // Try to find the specific plan requested, or the first live plan
                const selectedPlan = planId 
                    ? data.plans.find((p: any) => p.id === planId)
                    : data.plans.find((p: any) => p.isLive);
                
                if (selectedPlan?.razorpayPlanId) {
                    razorpayPlanId = selectedPlan.razorpayPlanId;
                }
            } 
            // Handle legacy format
            else if (data.razorpayPlanId) {
                razorpayPlanId = data.razorpayPlanId;
            }
        }

        const subscription = await razorpay.subscriptions.create({
            plan_id: razorpayPlanId,
            customer_notify: 1,
            total_count: 1, // 1 year membership
            notes: {
                userId: userId,
            },
        });

        return NextResponse.json(subscription);
    } catch (error: any) {
        console.error("Razorpay Subscription API Error:", error);
        return NextResponse.json({ 
            error: error.message || "Failed to create subscription" 
        }, { status: 500 });
    }
}
