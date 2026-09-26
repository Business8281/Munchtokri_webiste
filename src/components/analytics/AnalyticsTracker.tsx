"use client";

import React, { useEffect, useRef, createContext, useContext } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { tracker } from '@/lib/analytics/tracker';
import { AnalyticsEventName } from '@/types/analytics';

interface AnalyticsContextType {
    trackEvent: (eventName: AnalyticsEventName, properties?: Record<string, any>) => void;
    trackProductView: (product: { id: string; name: string; category?: string; price?: number; stock?: any }) => void;
    trackAddToCart: (product: { id: string; name: string; category?: string; price: number; quantity: number; baseWeight?: number }) => void;
    trackRemoveFromCart: (id: string, name?: string) => void;
    trackSearch: (query: string, resultCount: number) => void;
    trackCheckoutStep: (step: number, stepName: string, meta?: Record<string, any>) => void;
    trackCheckoutAbandon: (step: number, stepName: string, reasonSignal?: string) => void;
    trackPaymentAttempt: (method: string, amount: number) => void;
    trackPaymentResult: (status: 'success' | 'failure' | 'cancelled', details: { method: string; amount: number; orderId?: string; error?: string }) => void;
    visitorId: string;
    sessionId: string;
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const prevPathRef = useRef<string | null>(null);
    const pageStartTimeRef = useRef<number>(Date.now());
    const scrollMilestonesRef = useRef<Set<number>>(new Set());

    // 1. Sync User Auth (Privacy-friendly customer ID only)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                tracker.setUserId(user.uid);
            } else {
                tracker.setUserId(undefined);
            }
        });
        return () => unsubscribe();
    }, []);

    // 2. Track Route Changes & Time on Previous Page
    useEffect(() => {
        const currentPath = pathname;
        const now = Date.now();

        // If there was a previous page, track time spent on that page
        if (prevPathRef.current && prevPathRef.current !== currentPath) {
            const timeSpentSec = Math.round((now - pageStartTimeRef.current) / 1000);
            if (timeSpentSec > 0) {
                tracker.track('page_view', {
                    path: prevPathRef.current,
                    durationSeconds: timeSpentSec,
                    isExit: false,
                    nextPage: currentPath
                });
            }
        }

        // Reset scroll milestones and start time
        scrollMilestonesRef.current.clear();
        pageStartTimeRef.current = now;
        prevPathRef.current = currentPath;

        // Track the new page view
        const queryStr = searchParams?.toString();
        tracker.track('page_view', {
            path: currentPath,
            queryString: queryStr ? `?${queryStr}` : undefined,
            referrer: typeof document !== 'undefined' ? document.referrer : '',
            title: typeof document !== 'undefined' ? document.title : ''
        });
    }, [pathname, searchParams]);

    // 3. Track Scroll Depth Milestones (25%, 50%, 75%, 100%)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleScroll = () => {
            const windowHeight = window.innerHeight;
            const docHeight = document.documentElement.scrollHeight - windowHeight;
            if (docHeight <= 0) return;

            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const scrollPercent = Math.min(100, Math.round((scrollTop / docHeight) * 100));

            const milestones = [25, 50, 75, 100];
            for (const m of milestones) {
                if (scrollPercent >= m && !scrollMilestonesRef.current.has(m)) {
                    scrollMilestonesRef.current.add(m);
                    tracker.track('page_view', {
                        path: pathname,
                        scrollDepthMilestone: m,
                        isScrollMilestone: true
                    });
                }
            }
        };

        let timer: any = null;
        const debouncedScroll = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(handleScroll, 150);
        };

        window.addEventListener('scroll', debouncedScroll, { passive: true });
        return () => {
            if (timer) clearTimeout(timer);
            window.removeEventListener('scroll', debouncedScroll);
        };
    }, [pathname]);

    // Helpers exposed via Context
    const trackEvent = (eventName: AnalyticsEventName, properties?: Record<string, any>) => {
        tracker.track(eventName, properties);
    };

    const trackProductView = (product: { id: string; name: string; category?: string; price?: number; stock?: any }) => {
        tracker.track('product_view', {
            productId: product.id,
            productName: product.name,
            category: product.category || 'General',
            price: product.price || 0,
            stock: product.stock
        });
    };

    const trackAddToCart = (product: { id: string; name: string; category?: string; price: number; quantity: number; baseWeight?: number }) => {
        tracker.track('add_to_cart', {
            productId: product.id,
            productName: product.name,
            category: product.category || 'General',
            price: product.price,
            quantity: product.quantity,
            baseWeight: product.baseWeight || 100,
            itemTotal: Math.round(((product.price / (product.baseWeight || 100)) * product.quantity) * 100) / 100
        });
    };

    const trackRemoveFromCart = (id: string, name?: string) => {
        tracker.track('remove_from_cart', {
            productId: id,
            productName: name || id
        });
    };

    const trackSearch = (query: string, resultCount: number) => {
        tracker.track('search', {
            query: query.trim(),
            resultCount,
            hasResults: resultCount > 0,
            isZeroResult: resultCount === 0
        });
    };

    const trackCheckoutStep = (step: number, stepName: string, meta?: Record<string, any>) => {
        tracker.track('checkout_step', {
            step,
            stepName,
            ...meta
        });
    };

    const trackCheckoutAbandon = (step: number, stepName: string, reasonSignal?: string) => {
        tracker.track('checkout_abandon', {
            step,
            stepName,
            reasonSignal: reasonSignal || 'User navigated away'
        });
    };

    const trackPaymentAttempt = (method: string, amount: number) => {
        tracker.track('payment_initiate', {
            paymentMethod: method,
            amount
        });
    };

    const trackPaymentResult = (status: 'success' | 'failure' | 'cancelled', details: { method: string; amount: number; orderId?: string; error?: string }) => {
        const evName = status === 'success' ? 'payment_success' : status === 'failure' ? 'payment_failure' : 'payment_cancel';
        tracker.track(evName, {
            paymentMethod: details.method,
            amount: details.amount,
            orderId: details.orderId,
            errorReason: details.error
        });
    };

    return (
        <AnalyticsContext.Provider
            value={{
                trackEvent,
                trackProductView,
                trackAddToCart,
                trackRemoveFromCart,
                trackSearch,
                trackCheckoutStep,
                trackCheckoutAbandon,
                trackPaymentAttempt,
                trackPaymentResult,
                visitorId: tracker.getVisitorId(),
                sessionId: tracker.getSessionId()
            }}
        >
            {children}
        </AnalyticsContext.Provider>
    );
}

export function useAnalytics() {
    const ctx = useContext(AnalyticsContext);
    if (!ctx) {
        // Safe fallback so calls never throw if accessed outside provider
        return {
            trackEvent: (name: AnalyticsEventName, props?: Record<string, any>) => tracker.track(name, props),
            trackProductView: (p: any) => tracker.track('product_view', p),
            trackAddToCart: (p: any) => tracker.track('add_to_cart', p),
            trackRemoveFromCart: (id: string, name?: string) => tracker.track('remove_from_cart', { productId: id, productName: name }),
            trackSearch: (q: string, count: number) => tracker.track('search', { query: q, resultCount: count, isZeroResult: count === 0 }),
            trackCheckoutStep: (step: number, name: string, meta?: any) => tracker.track('checkout_step', { step, stepName: name, ...meta }),
            trackCheckoutAbandon: (step: number, name: string, signal?: string) => tracker.track('checkout_abandon', { step, stepName: name, reasonSignal: signal }),
            trackPaymentAttempt: (method: string, amount: number) => tracker.track('payment_initiate', { paymentMethod: method, amount }),
            trackPaymentResult: (status: string, d: any) => tracker.track(status === 'success' ? 'payment_success' : status === 'failure' ? 'payment_failure' : 'payment_cancel', d),
            visitorId: tracker.getVisitorId(),
            sessionId: tracker.getSessionId()
        };
    }
    return ctx;
}
