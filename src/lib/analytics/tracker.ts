"use client";

import { AnalyticsEvent, AnalyticsEventName, DeviceInfo, TrafficSourceInfo } from '@/types/analytics';

const VISITOR_ID_KEY = 'munchtokri_vid';
const SESSION_ID_KEY = 'munchtokri_sid';
const SESSION_LAST_ACTIVE_KEY = 'munchtokri_last_active';
const SESSION_START_KEY = 'munchtokri_session_start';
const SESSION_SOURCE_KEY = 'munchtokri_session_source';
const RETURNING_VISITOR_KEY = 'munchtokri_returning';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout

// Generate a random UUID
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Parse device info from user agent and screen
function detectDevice(): DeviceInfo {
    if (typeof window === 'undefined') {
        return { type: 'desktop', browser: 'Unknown', os: 'Unknown' };
    }

    const ua = navigator.userAgent;
    const width = window.innerWidth || screen.width || 1024;
    let type: 'mobile' | 'desktop' | 'tablet' = 'desktop';

    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) || (width >= 600 && width <= 1024 && ('ontouchstart' in window || navigator.maxTouchPoints > 0))) {
        type = 'tablet';
    } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua) || width < 600) {
        type = 'mobile';
    }

    // Detect browser
    let browser = 'Unknown';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/') && !ua.includes('Chromium/')) browser = 'Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Opera') || ua.includes('OPR/')) browser = 'Opera';

    // Detect OS
    let os = 'Unknown';
    if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Linux/i.test(ua)) os = 'Linux';

    return {
        type,
        browser,
        os,
        screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`
    };
}

// Parse traffic source and UTM parameters
function detectTrafficSource(): TrafficSourceInfo {
    if (typeof window === 'undefined') {
        return { source: 'direct', medium: 'none' };
    }

    // Check if session already has stored source
    try {
        const stored = sessionStorage.getItem(SESSION_SOURCE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {}

    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const utmCampaign = urlParams.get('utm_campaign') || undefined;
    const utmTerm = urlParams.get('utm_term') || undefined;
    const utmContent = urlParams.get('utm_content') || undefined;

    let source = utmSource || '';
    let medium = utmMedium || '';
    const referrer = document.referrer ? new URL(document.referrer, window.location.href).hostname : '';

    if (!source) {
        if (!document.referrer || referrer.includes(window.location.hostname)) {
            source = 'direct';
            medium = 'none';
        } else if (referrer.includes('google.') || referrer.includes('bing.') || referrer.includes('yahoo.') || referrer.includes('duckduckgo.')) {
            source = referrer.includes('google') ? 'google' : referrer;
            medium = 'organic';
        } else if (referrer.includes('instagram.com') || referrer.includes('facebook.com') || referrer.includes('t.co') || referrer.includes('twitter.com') || referrer.includes('x.com') || referrer.includes('whatsapp') || referrer.includes('youtube.com')) {
            source = referrer.includes('instagram') ? 'instagram' : referrer.includes('facebook') ? 'facebook' : referrer.includes('whatsapp') ? 'whatsapp' : 'social';
            medium = 'social';
        } else {
            source = referrer;
            medium = 'referral';
        }
    }

    const sourceInfo: TrafficSourceInfo = {
        source: source.toLowerCase(),
        medium: medium.toLowerCase(),
        campaign: utmCampaign,
        term: utmTerm,
        content: utmContent,
        referrer: document.referrer || undefined
    };

    try {
        sessionStorage.setItem(SESSION_SOURCE_KEY, JSON.stringify(sourceInfo));
    } catch {}

    return sourceInfo;
}

class AnalyticsTracker {
    private visitorId: string = '';
    private sessionId: string = '';
    private isNewVisitor: boolean = true;
    private eventQueue: AnalyticsEvent[] = [];
    private flushTimer: any = null;
    private heartbeatTimer: any = null;
    private lastEventTime: Record<string, number> = {};
    private isInitialized: boolean = false;
    private userId?: string;

    constructor() {
        if (typeof window !== 'undefined') {
            this.init();
        }
    }

    private init() {
        try {
            // Get or create Visitor ID
            let vid = localStorage.getItem(VISITOR_ID_KEY);
            if (!vid) {
                vid = 'vid_' + generateUUID().replace(/-/g, '').slice(0, 16);
                localStorage.setItem(VISITOR_ID_KEY, vid);
                localStorage.setItem(RETURNING_VISITOR_KEY, 'true');
                this.isNewVisitor = true;
            } else {
                this.isNewVisitor = false;
            }
            this.visitorId = vid;

            // Manage Session ID with timeout check
            const now = Date.now();
            const lastActive = parseInt(sessionStorage.getItem(SESSION_LAST_ACTIVE_KEY) || '0', 10);
            let sid = sessionStorage.getItem(SESSION_ID_KEY);

            if (!sid || (now - lastActive > SESSION_TIMEOUT_MS)) {
                sid = 'ses_' + generateUUID().replace(/-/g, '').slice(0, 16);
                sessionStorage.setItem(SESSION_ID_KEY, sid);
                sessionStorage.setItem(SESSION_START_KEY, now.toString());
                sessionStorage.removeItem(SESSION_SOURCE_KEY); // Re-calculate for new session
            }

            sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, now.toString());
            this.sessionId = sid;

            // Setup automated flush and heartbeat
            this.flushTimer = setInterval(() => this.flush(), 4000);
            this.startHeartbeat();

            // Flush on visibility change / unload
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.flush(true);
                } else if (document.visibilityState === 'visible') {
                    this.updateActivity();
                }
            });

            window.addEventListener('pagehide', () => this.flush(true));
            window.addEventListener('beforeunload', () => this.flush(true));

            // Setup real-time scroll depth milestone tracking
            this.setupScrollTracking();

            this.isInitialized = true;
        } catch (e) {
            console.warn('[Analytics] Initialization note:', e);
        }
    }

    private setupScrollTracking() {
        if (typeof window === 'undefined') return;
        const reachedDepths = new Set<number>();
        let lastPath = window.location.pathname;

        const checkScroll = () => {
            if (window.location.pathname !== lastPath) {
                lastPath = window.location.pathname;
                reachedDepths.clear();
            }

            const h = document.documentElement;
            const b = document.body;
            const scrollTop = h.scrollTop || b.scrollTop;
            const scrollHeight = (h.scrollHeight || b.scrollHeight) - h.clientHeight;
            if (scrollHeight <= 50) return;
            const pct = Math.round((scrollTop / scrollHeight) * 100);

            const thresholds = [25, 50, 75, 100];
            for (const t of thresholds) {
                if (pct >= t && !reachedDepths.has(t)) {
                    reachedDepths.add(t);
                    this.track('scroll', { depth: t, path: window.location.pathname });
                }
            }
        };

        window.addEventListener('scroll', checkScroll, { passive: true });
    }

    public setUserId(uid?: string) {
        this.userId = uid;
    }

    public getVisitorId(): string {
        return this.visitorId;
    }

    public getSessionId(): string {
        return this.sessionId;
    }

    private updateActivity() {
        try {
            sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, Date.now().toString());
        } catch {}
    }

    private startHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                this.trackHeartbeat();
            }
        }, 25000); // 25s heartbeat keeps real-time active users alive
    }

    public track(eventName: AnalyticsEventName, properties: Record<string, any> = {}) {
        if (typeof window === 'undefined') return;

        try {
            this.updateActivity();

            // Basic deduplication for duplicate rapid triggers (e.g. 500ms debounce on same event & path)
            const dedupeKey = `${eventName}_${window.location.pathname}_${properties.productId || properties.step || ''}`;
            const now = Date.now();
            if (this.lastEventTime[dedupeKey] && now - this.lastEventTime[dedupeKey] < 400) {
                return;
            }
            this.lastEventTime[dedupeKey] = now;

            const event: AnalyticsEvent = {
                id: generateUUID(),
                eventName,
                timestamp: now,
                visitorId: this.visitorId || 'anon',
                sessionId: this.sessionId || 'ses_anon',
                userId: this.userId,
                path: window.location.pathname,
                title: document.title || '',
                trafficSource: detectTrafficSource(),
                device: detectDevice(),
                properties: {
                    ...properties,
                    isNewVisitor: this.isNewVisitor
                }
            };

            this.eventQueue.push(event);

            // Immediate flush for key conversion milestones
            const criticalEvents: AnalyticsEventName[] = [
                'purchase_complete',
                'payment_success',
                'checkout_start',
                'checkout_abandon'
            ];

            if (criticalEvents.includes(eventName) || this.eventQueue.length >= 10) {
                this.flush();
            }
        } catch (err) {
            console.warn('[Analytics] Track error:', err);
        }
    }

    private trackHeartbeat() {
        try {
            // Read lightweight cart info if available
            let cartCount = 0;
            let cartTotal = 0;
            try {
                const cartData = localStorage.getItem('munchtokri_cart');
                if (cartData) {
                    const items = JSON.parse(cartData);
                    if (Array.isArray(items)) {
                        cartCount = items.length;
                        cartTotal = items.reduce((sum, item) => sum + ((item.price / (item.baseWeight || 100)) * item.quantity), 0);
                    }
                }
            } catch {}

            const heartbeatEvent: AnalyticsEvent = {
                id: generateUUID(),
                eventName: 'heartbeat',
                timestamp: Date.now(),
                visitorId: this.visitorId || 'anon',
                sessionId: this.sessionId || 'ses_anon',
                userId: this.userId,
                path: window.location.pathname,
                title: document.title || '',
                trafficSource: detectTrafficSource(),
                device: detectDevice(),
                properties: {
                    cartCount,
                    cartTotal: Math.round(cartTotal * 100) / 100,
                    isCheckout: window.location.pathname.startsWith('/checkout')
                }
            };

            this.eventQueue.push(heartbeatEvent);
            this.flush();
        } catch {}
    }

    public flush(useBeacon: boolean = false) {
        if (this.eventQueue.length === 0) return;

        const eventsToSend = [...this.eventQueue];
        this.eventQueue = [];

        try {
            const payload = JSON.stringify({ events: eventsToSend });

            if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
                const blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon('/api/analytics/collect', blob);
            } else {
                fetch('/api/analytics/collect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    keepalive: true
                }).catch(() => {
                    // Soft error handling - put back in queue if failed
                    if (this.eventQueue.length < 50) {
                        this.eventQueue.unshift(...eventsToSend);
                    }
                });
            }
        } catch (err) {
            console.warn('[Analytics] Flush error:', err);
        }
    }
}

// Global instance
export const tracker = new AnalyticsTracker();
