export type AnalyticsEventName =
    | 'page_view'
    | 'product_impression'
    | 'product_view'
    | 'product_click'
    | 'product_image_click'
    | 'category_click'
    | 'nav_click'
    | 'search'
    | 'search_click'
    | 'filter_change'
    | 'sort_change'
    | 'add_to_cart'
    | 'remove_from_cart'
    | 'cart_open'
    | 'cart_view'
    | 'cart_clear'
    | 'quantity_change'
    | 'wishlist_toggle'
    | 'coupon_apply'
    | 'coupon_error'
    | 'coupon_remove'
    | 'points_redeem'
    | 'checkout_start'
    | 'checkout_step'
    | 'checkout_abandon'
    | 'payment_initiate'
    | 'payment_success'
    | 'payment_failure'
    | 'payment_cancel'
    | 'purchase_complete'
    | 'scroll'
    | 'heartbeat';

export interface TrafficSourceInfo {
    source: string; // 'direct', 'google', 'instagram', 'facebook', 'whatsapp', 'referral', etc.
    medium: string; // 'organic', 'cpc', 'social', 'email', 'referral', 'none'
    campaign?: string;
    term?: string;
    content?: string;
    referrer?: string;
}

export interface DeviceInfo {
    type: 'mobile' | 'desktop' | 'tablet';
    browser: string;
    os: string;
    screenResolution?: string;
    viewport?: string;
}

export interface AnalyticsEvent {
    id: string;
    eventName: AnalyticsEventName;
    timestamp: number;
    visitorId: string;
    sessionId: string;
    userId?: string;
    path: string;
    title?: string;
    trafficSource: TrafficSourceInfo;
    device: DeviceInfo;
    properties?: Record<string, any>;
}

export interface ActiveSession {
    sessionId: string;
    visitorId: string;
    userId?: string;
    startTime: number;
    lastActive: number;
    currentPath: string;
    currentProduct?: string;
    pageViews: number;
    device: DeviceInfo;
    trafficSource: TrafficSourceInfo;
    cartCount: number;
    cartTotal: number;
    checkoutStep?: number;
    isCheckoutActive?: boolean;
}

export interface AnalyticsSession {
    sessionId: string;
    visitorId: string;
    userId?: string;
    startTime: number;
    lastActive: number;
    endTime?: number;
    duration: number; // in seconds
    pageViews: number;
    entryPage: string;
    exitPage: string;
    trafficSource: TrafficSourceInfo;
    device: DeviceInfo;
    isNewVisitor: boolean;
    interactionsCount: number;
    productsViewed: string[];
    cartActionsCount: number;
    cartValue?: number;
    checkoutStarted: boolean;
    checkoutStepReached?: number;
    checkoutAbandoned?: boolean;
    purchaseCompleted: boolean;
    purchaseAmount?: number;
    orderId?: string;
    pagesSequence: string[];
}

export interface FunnelStep {
    id: string;
    name: string;
    description: string;
    count: number;
    conversionFromPrevious: number; // percentage
    dropoffFromPrevious: number; // percentage
    dropoffCount: number;
    conversionFromTotal: number; // percentage
}

export interface ShoppingFunnelData {
    steps: FunnelStep[];
    overallConversionRate: number;
    totalVisitors: number;
    totalPurchases: number;
}

export interface ProductPerformanceItem {
    id: string;
    name: string;
    category: string;
    price: number;
    impressions: number;
    views: number;
    uniqueViewers: number;
    avgTimeSpentSeconds: number;
    galleryClicks: number;
    cartAdditions: number;
    cartRemovals: number;
    checkoutInitiations: number;
    purchases: number;
    revenue: number;
    viewToCartRate: number; // percentage
    cartToPurchaseRate: number; // percentage
    overallConversionRate: number; // percentage
    classification: 'Star' | 'High Traffic Low Conversion' | 'Hidden Gem' | 'High Cart Dropoff' | 'Needs Promotion' | 'Normal';
}

export interface SearchQueryItem {
    query: string;
    searchesCount: number;
    uniqueUsers: number;
    resultsCountAvg: number;
    resultClicks: number;
    clickThroughRate: number;
    cartAdditions: number;
    purchases: number;
    revenue: number;
    conversionRate: number;
    isZeroResult: boolean;
}

export interface CartAbandonmentReportData {
    cartsCreated: number;
    totalCartValue: number;
    avgCartValue: number;
    abandonedCartsCount: number;
    abandonmentRate: number;
    completedCartsCount: number;
    abandonedProducts: {
        productId: string;
        productName: string;
        frequency: number;
        potentialRevenueLost: number;
    }[];
}

export interface CheckoutAbandonmentReportData {
    checkoutStarts: number;
    step1Shipping: { reached: number; left: number; dropoffPct: number; avgTimeSec: number };
    step2Delivery: { reached: number; left: number; dropoffPct: number; avgTimeSec: number };
    step3Payment: { reached: number; left: number; dropoffPct: number; avgTimeSec: number };
    step4Review: { reached: number; left: number; dropoffPct: number; avgTimeSec: number };
    completedOrders: number;
    checkoutAbandonmentRate: number;
    signals: {
        signal: string;
        count: number;
        category: 'validation' | 'coupon' | 'payment' | 'shipping' | 'user_exit' | 'technical';
        severity: 'high' | 'medium' | 'low';
    }[];
    deviceBreakdown: { device: string; checkouts: number; completed: number; abandonmentRate: number }[];
    sourceBreakdown: { source: string; checkouts: number; completed: number; abandonmentRate: number }[];
}

export interface PaymentReportData {
    initiated: number;
    successful: number;
    failed: number;
    cancelled: number;
    successRate: number;
    failureRate: number;
    cancellationRate: number;
    methodBreakdown: {
        method: string;
        initiated: number;
        successful: number;
        failed: number;
        successRate: number;
        revenue: number;
    }[];
    failureReasons: {
        reason: string;
        category: string;
        count: number;
        percentage: number;
    }[];
}

export interface PagePerformanceItem {
    path: string;
    title: string;
    views: number;
    uniqueVisitors: number;
    avgTimeOnPageSec: number;
    bounceRate: number;
    exitRate: number;
    avgScrollDepthPct: number;
    conversionContributionPct: number;
}

export interface CustomerJourneyNode {
    path: string;
    visits: number;
    exitCount: number;
    exitRate: number;
    nextPages: { path: string; count: number; percentage: number }[];
}

export interface DeviceBreakdownItem {
    device: string;
    users: number;
    sessions: number;
    sharePct: number;
    durationFormatted: string;
    cartAddRate: number;
    checkoutCompletion: number;
    conversionRate: number;
}

export interface TrafficBreakdownItem {
    channel: string;
    medium: string;
    visitors: number;
    sessions: number;
    aov: number;
    orders: number;
    revenue: number;
    conversionRate: number;
}

export interface BusinessInsight {
    id: string;
    type: 'positive' | 'warning' | 'critical' | 'info';
    category: 'product' | 'checkout' | 'search' | 'traffic' | 'device' | 'page';
    title: string;
    factualMetric: string; // Ground truth observation
    analyticalSignal: string; // The data pattern identified
    possibleExplanation: string; // Actionable diagnostic inference
    actionRecommendation: string;
}

export interface AnalyticsAlert {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    metric: string;
    currentValue: string | number;
    baselineValue: string | number;
    changePct: number;
    detectedAt: number;
}

export type DateRangePreset =
    | 'today'
    | 'yesterday'
    | '7d'
    | '30d'
    | '90d'
    | '6m'
    | '1y'
    | 'ytd'
    | 'all'
    | 'custom';

export interface DateRangeFilter {
    preset: DateRangePreset;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    compareWith: 'previous_period' | 'previous_year' | 'none';
}

export interface ScrollMilestoneItem {
    milestone: string;
    pct: number;
    desc: string;
}
