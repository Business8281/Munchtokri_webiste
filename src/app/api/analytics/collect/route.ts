import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
    doc,
    setDoc,
    updateDoc,
    increment,
    collection,
    writeBatch,
    getDocs,
    query,
    where,
    deleteDoc,
    serverTimestamp
} from 'firebase/firestore';
import { AnalyticsEvent } from '@/types/analytics';

// Helper to get formatted date YYYY-MM-DD
function getLocalDateString(timestamp: number = Date.now()): string {
    const d = new Date(timestamp);
    // Indian Standard Time (UTC+5:30)
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    const year = ist.getFullYear();
    const month = String(ist.getMonth() + 1).padStart(2, '0');
    const day = String(ist.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const events: AnalyticsEvent[] = body.events || [];

        if (!Array.isArray(events) || events.length === 0) {
            return NextResponse.json({ success: true, processed: 0 });
        }

        const now = Date.now();
        const todayStr = getLocalDateString(now);

        // Group by session to update active sessions efficiently
        const sessionMap = new Map<string, AnalyticsEvent>();
        const sessionSequences = new Map<string, string[]>();
        let pageViewCount = 0;
        let cartAddCount = 0;
        let checkoutStartCount = 0;
        let purchaseCount = 0;
        let purchaseRevenue = 0;
        let searchCount = 0;
        let paymentInitiateCount = 0;
        let paymentFailureCount = 0;

        for (const ev of events) {
            sessionMap.set(ev.sessionId, ev);

            if (!sessionSequences.has(ev.sessionId)) {
                sessionSequences.set(ev.sessionId, []);
            }
            if (ev.path) {
                sessionSequences.get(ev.sessionId)!.push(ev.path);
            }

            if (ev.eventName === 'page_view') pageViewCount++;
            else if (ev.eventName === 'add_to_cart') cartAddCount++;
            else if (ev.eventName === 'checkout_start') checkoutStartCount++;
            else if (ev.eventName === 'purchase_complete') {
                purchaseCount++;
                purchaseRevenue += Number(ev.properties?.amount || 0);
            } else if (ev.eventName === 'search') searchCount++;
            else if (ev.eventName === 'payment_initiate') paymentInitiateCount++;
            else if (ev.eventName === 'payment_failure') paymentFailureCount++;
        }

function sanitizeForFirestore(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(sanitizeForFirestore);
    }
    // Check if it's a FieldValue like serverTimestamp() or increment()
    if ((obj as any)._methodName || (obj.constructor && obj.constructor.name === 'FieldValue')) {
        return obj;
    }
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) {
            clean[k] = null;
        } else if (v && typeof v === 'object' && !((v as any)._methodName || (v.constructor && v.constructor.name === 'FieldValue'))) {
            clean[k] = sanitizeForFirestore(v);
        } else {
            clean[k] = v;
        }
    }
    return clean;
}

        const batch = writeBatch(db);

        // 1. Update Active Sessions (for real-time dashboard)
        for (const [sessionId, latestEvent] of sessionMap.entries()) {
            const activeRef = doc(db, 'analytics_active_sessions', sessionId);
            const pathStr = latestEvent.path || (latestEvent as any).pagePath || '/';
            const isCheckout = Boolean(pathStr.startsWith('/checkout'));
            
            batch.set(activeRef, sanitizeForFirestore({
                sessionId: sessionId || 'unknown',
                visitorId: latestEvent.visitorId || 'anon',
                userId: latestEvent.userId || null,
                lastActive: latestEvent.timestamp || now,
                currentPath: pathStr,
                currentProduct: latestEvent.properties?.productName || latestEvent.properties?.productId || null,
                device: latestEvent.device || { type: 'desktop', browser: 'Unknown', os: 'Unknown' },
                trafficSource: latestEvent.trafficSource || { source: 'direct', medium: 'none' },
                cartCount: Number(latestEvent.properties?.cartCount || 0),
                cartTotal: Number(latestEvent.properties?.cartTotal || 0),
                isCheckoutActive: isCheckout,
                checkoutStep: Number(latestEvent.properties?.step || (isCheckout ? 1 : 0)),
                updatedAt: serverTimestamp()
            }), { merge: true });

            // 2. Update Session Record in analytics_sessions
            const sessionRef = doc(db, 'analytics_sessions', sessionId);
            batch.set(sessionRef, sanitizeForFirestore({
                sessionId: sessionId || 'unknown',
                visitorId: latestEvent.visitorId || 'anon',
                userId: latestEvent.userId || null,
                lastActive: latestEvent.timestamp || now,
                entryPage: pathStr,
                exitPage: pathStr,
                device: latestEvent.device || { type: 'desktop', browser: 'Unknown', os: 'Unknown' },
                trafficSource: latestEvent.trafficSource || { source: 'direct', medium: 'none' },
                isNewVisitor: Boolean(latestEvent.properties?.isNewVisitor ?? true),
                interactionsCount: increment(1),
                updatedAt: serverTimestamp()
            }), { merge: true });
        }

        // 3. Update Daily Aggregates (atomic increment)
        const dailyRef = doc(db, 'analytics_daily', todayStr);
        const dailyIncrements: Record<string, any> = {
            date: todayStr,
            totalEvents: increment(events.length),
            updatedAt: serverTimestamp()
        };

        if (pageViewCount > 0) dailyIncrements.pageViews = increment(pageViewCount);
        if (cartAddCount > 0) dailyIncrements.cartAdds = increment(cartAddCount);
        if (checkoutStartCount > 0) dailyIncrements.checkoutStarts = increment(checkoutStartCount);
        if (purchaseCount > 0) {
            dailyIncrements.purchases = increment(purchaseCount);
            dailyIncrements.revenue = increment(purchaseRevenue);
        }
        if (searchCount > 0) dailyIncrements.searches = increment(searchCount);
        if (paymentInitiateCount > 0) dailyIncrements.paymentInitiates = increment(paymentInitiateCount);
        if (paymentFailureCount > 0) dailyIncrements.paymentFailures = increment(paymentFailureCount);

        batch.set(dailyRef, dailyIncrements, { merge: true });

        // 4. Record raw events into analytics_events collection
        for (const ev of events) {
            // Skip pure heartbeats from raw table to preserve storage space
            if (ev.eventName === 'heartbeat') continue;
            const eventRef = doc(collection(db, 'analytics_events'));
            const cleanEvent = sanitizeForFirestore({
                ...ev,
                path: ev.path || (ev as any).pagePath || '/',
                title: ev.title || (ev as any).pageTitle || '',
                date: todayStr,
                createdAt: serverTimestamp()
            });
            batch.set(eventRef, cleanEvent);
        }

        await batch.commit();

        // 5. Asynchronous cleanup of stale active sessions (> 90 seconds old)
        // Fire-and-forget so response is not blocked
        (async () => {
            try {
                const staleThreshold = now - 90000;
                const staleQuery = query(
                    collection(db, 'analytics_active_sessions'),
                    where('lastActive', '<', staleThreshold)
                );
                const staleDocs = await getDocs(staleQuery);
                if (staleDocs.size > 0) {
                    const deleteBatch = writeBatch(db);
                    staleDocs.forEach((d) => deleteBatch.delete(d.ref));
                    await deleteBatch.commit();
                }
            } catch (cleanupErr) {
                // Silently ignore cleanup error
            }
        })();

        return NextResponse.json({ success: true, processed: events.length });
    } catch (error: any) {
        console.error('[Analytics Collect] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
