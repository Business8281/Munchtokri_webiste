"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Activity,
    BarChart3,
    TrendingUp,
    TrendingDown,
    Users,
    ShoppingCart,
    ShoppingBag,
    Eye,
    Search,
    CreditCard,
    Smartphone,
    Globe,
    Compass,
    AlertTriangle,
    Download,
    FileText,
    Calendar,
    ChevronDown,
    Clock,
    RefreshCw,
    Percent,
    ShieldAlert,
    ArrowUpRight,
    ArrowDownRight,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Info,
    Sparkles
} from 'lucide-react';
import { useProducts, useOrders, useCustomers } from '@/hooks/useFirestore';
import {
    fetchAnalyticsData,
    subscribeToLiveActiveSessions,
    formatDateString
} from '@/lib/analytics/engine';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/analytics/export';
import { ActiveSession, DateRangePreset } from '@/types/analytics';
import adminStyles from '../admin.module.css';
import styles from './analytics.module.css';

type ReportTab =
    | 'overview'
    | 'live'
    | 'funnel'
    | 'cart_abandonment'
    | 'checkout_abandonment'
    | 'products'
    | 'search'
    | 'traffic'
    | 'journey'
    | 'device'
    | 'payment'
    | 'pages'
    | 'behavior'
    | 'revenue'
    | 'insights';

export default function AnalyticsPage() {
    const { products, loading: productsLoading } = useProducts();
    const { orders, loading: ordersLoading } = useOrders(undefined, true);
    const { customers, loading: customersLoading } = useCustomers(true);

    const [activeTab, setActiveTab] = useState<ReportTab>('overview');
    const [preset, setPreset] = useState<DateRangePreset>('7d');
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');
    const [compareWith, setCompareWith] = useState<'previous_period' | 'none'>('previous_period');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [liveSessions, setLiveSessions] = useState<ActiveSession[]>([]);
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(true);

    // 1. Subscribe to Real-Time Live Sessions
    useEffect(() => {
        const unsub = subscribeToLiveActiveSessions((sessions) => {
            setLiveSessions(sessions);
        });
        return () => unsub();
    }, []);

    // 2. Fetch and aggregate analytics data based on date range
    useEffect(() => {
        if (productsLoading || ordersLoading) return;

        let isMounted = true;
        setLoadingData(true);

        fetchAnalyticsData(preset, customStart, customEnd, orders, products)
            .then(data => {
                if (isMounted) {
                    setAnalyticsData(data);
                    setLoadingData(false);
                }
            })
            .catch(err => {
                console.error('Failed to aggregate analytics:', err);
                if (isMounted) setLoadingData(false);
            });

        return () => { isMounted = false; };
    }, [preset, customStart, customEnd, orders, products, productsLoading, ordersLoading]);

    // Handle Exports
    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        setShowExportMenu(false);
        if (!analyticsData) return;

        const dateTag = `${preset}_${formatDateString(new Date())}`;

        if (activeTab === 'products') {
            const headers = ['Product Name', 'Category', 'Price', 'Impressions', 'Detail Views', 'Unique Viewers', 'Cart Adds', 'Purchases', 'Revenue (INR)', 'Conversion Rate (%)', 'Classification'];
            const rows = analyticsData.productPerformanceList.map((p: any) => [
                p.name, p.category, p.price, p.impressions, p.views, p.uniqueViewers, p.cartAdditions, p.purchases, p.revenue, p.overallConversionRate, p.classification
            ]);
            if (format === 'csv') exportToCSV(`products_performance_${dateTag}`, headers, rows);
            else if (format === 'excel') exportToExcel(`products_performance_${dateTag}`, headers, rows);
            else exportToPDF('Product Performance & Conversion Report', `Analysis period: ${preset.toUpperCase()}`, headers, rows, `product_report_${dateTag}`);
        } else if (activeTab === 'search') {
            const headers = ['Search Query', 'Searches Count', 'Unique Users', 'Result Clicks', 'Click-Through Rate (%)', 'Cart Adds', 'Purchases', 'Zero Result'];
            const rows = analyticsData.searchList.map((s: any) => [
                s.query, s.searchesCount, s.uniqueUsers, s.resultClicks, s.clickThroughRate, s.cartAdditions, s.purchases, s.isZeroResult ? 'YES' : 'NO'
            ]);
            if (format === 'csv') exportToCSV(`search_analytics_${dateTag}`, headers, rows);
            else if (format === 'excel') exportToExcel(`search_analytics_${dateTag}`, headers, rows);
            else exportToPDF('Search Query Demand & Conversion Report', 'Internal site search performance', headers, rows, `search_report_${dateTag}`);
        } else if (activeTab === 'funnel') {
            const headers = ['Funnel Step', 'Stage Name', 'Users Reached', 'Conv from Prev (%)', 'Drop-off from Prev (%)', 'Drop-off Users', 'Conv from Total (%)'];
            const rows = analyticsData.funnelData.steps.map((st: any) => [
                `Step ${st.id}`, st.name, st.count, st.conversionFromPrevious, st.dropoffFromPrevious, st.dropoffCount, st.conversionFromTotal
            ]);
            if (format === 'csv') exportToCSV(`funnel_analytics_${dateTag}`, headers, rows);
            else if (format === 'excel') exportToExcel(`funnel_analytics_${dateTag}`, headers, rows);
            else exportToPDF('Shopping Funnel Performance Report', `Full 12-stage customer purchasing funnel (${preset})`, headers, rows, `funnel_report_${dateTag}`);
        } else {
            // General Overview Export
            const headers = ['Metric Name', 'Current Value', 'Comparison Signal'];
            const rows = [
                ['Total Visitors', analyticsData.totalVisitors, `+${analyticsData.comparison.visitorsPct}%`],
                ['Total Sessions', analyticsData.totalSessions, 'Active'],
                ['Total Page Views', analyticsData.totalPageViews, `${analyticsData.pagesPerSession} pages/ses`],
                ['Avg Session Duration', `${Math.floor(analyticsData.avgDurationSeconds / 60)}m ${analyticsData.avgDurationSeconds % 60}s`, 'Benchmark: 2m+'],
                ['Cart Additions', analyticsData.totalCartAdds, `${analyticsData.cartConversionRate}% cart conv`],
                ['Checkout Starts', analyticsData.totalCheckoutStarts, `${analyticsData.checkoutConversionRate}% checkout conv`],
                ['Completed Orders', analyticsData.totalPurchases, `+${analyticsData.comparison.ordersPct}%`],
                ['Total Revenue', `INR ${analyticsData.totalRevenue}`, `+${analyticsData.comparison.revenuePct}%`],
                ['Average Order Value (AOV)', `INR ${analyticsData.averageOrderValue}`, `+${analyticsData.comparison.aovPct}%`],
                ['Overall Conversion Rate', `${analyticsData.overallConversionRate}%`, 'Benchmark: 2.5% - 3.5%'],
                ['Cart Abandonment Rate', `${analyticsData.cartAbandonmentRate}%`, 'Industry avg: 60-70%'],
                ['Checkout Abandonment Rate', `${analyticsData.checkoutAbandonmentRate}%`, 'Industry avg: 30-40%']
            ];
            if (format === 'csv') exportToCSV(`analytics_overview_${dateTag}`, headers, rows);
            else if (format === 'excel') exportToExcel(`analytics_overview_${dateTag}`, headers, rows);
            else exportToPDF('E-Commerce Business Analytics Summary', `Executive Performance Scorecard (${preset.toUpperCase()})`, headers, rows, `overview_report_${dateTag}`);
        }
    };

    if (productsLoading || ordersLoading || !analyticsData) {
        return (
            <div className={adminStyles.dashboardContent}>
                <h2 className={adminStyles.pageTitle}>Analytics & Reports</h2>
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <Activity size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
                    <p>Aggregating user behavior and conversion data...</p>
                </div>
            </div>
        );
    }

    const {
        totalVisitors,
        newVisitors,
        returningVisitors,
        totalSessions,
        totalPageViews,
        avgDurationSeconds,
        pagesPerSession,
        engagementRate,
        bounceRate,
        totalCartAdds,
        cartConversionRate,
        totalCheckoutStarts,
        checkoutConversionRate,
        totalPurchases,
        overallConversionRate,
        totalRevenue,
        averageOrderValue,
        cartAbandonmentRate,
        checkoutAbandonmentRate,
        comparison,
        funnelData,
        productPerformanceList,
        searchList,
        cartAbandonmentData,
        checkoutAbandonmentData,
        paymentReportData,
        customerJourneyPaths,
        pagePerformanceList,
        insights,
        alerts
    } = analyticsData;

    // Report tabs configuration (all 15 required reports)
    const reportTabs: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
        { id: 'overview', label: '1. Overview Scorecard', icon: <BarChart3 size={16} /> },
        { id: 'live', label: '2. Live Activity', icon: <Activity size={16} /> },
        { id: 'funnel', label: '3. Shopping Funnel', icon: <TrendingUp size={16} /> },
        { id: 'cart_abandonment', label: '4. Cart Abandonment', icon: <ShoppingCart size={16} /> },
        { id: 'checkout_abandonment', label: '5. Checkout Abandonment', icon: <ShieldAlert size={16} /> },
        { id: 'products', label: '6. Product Performance', icon: <ShoppingBag size={16} /> },
        { id: 'search', label: '7. Search Analytics', icon: <Search size={16} /> },
        { id: 'traffic', label: '8. Traffic Sources & UTM', icon: <Globe size={16} /> },
        { id: 'journey', label: '9. Customer Journey', icon: <Compass size={16} /> },
        { id: 'device', label: '10. Devices & Tech', icon: <Smartphone size={16} /> },
        { id: 'payment', label: '11. Payment Analytics', icon: <CreditCard size={16} /> },
        { id: 'pages', label: '12. Page Performance', icon: <Eye size={16} /> },
        { id: 'behavior', label: '13. User Behavior', icon: <Users size={16} /> },
        { id: 'revenue', label: '14. Revenue & Conversion', icon: <Percent size={16} /> },
        { id: 'insights', label: '15. Insights & Alerts', icon: <Sparkles size={16} /> },
    ];

    return (
        <div className={adminStyles.dashboardContent}>
            {/* Header with Title and Live Indicator */}
            <div className={styles.headerRow}>
                <div>
                    <h2 className={adminStyles.pageTitle} style={{ margin: 0 }}>Analytics & Business Intelligence</h2>
                    <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        First-party user tracking, funnel drop-offs, customer behavior, and sales insights
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className={styles.liveIndicator}>
                        <div className={styles.dot}></div>
                        <span>LIVE TRACKING ({liveSessions.length} ACTIVE NOW)</span>
                    </div>

                    {/* Export Dropdown */}
                    <div className={styles.exportDropdown}>
                        <button
                            className={styles.exportBtn}
                            onClick={() => setShowExportMenu(!showExportMenu)}
                        >
                            <Download size={15} />
                            <span>Export Report</span>
                            <ChevronDown size={14} />
                        </button>
                        {showExportMenu && (
                            <div className={styles.exportMenu}>
                                <button className={styles.exportMenuItem} onClick={() => handleExport('csv')}>
                                    <FileText size={14} /> Export CSV
                                </button>
                                <button className={styles.exportMenuItem} onClick={() => handleExport('excel')}>
                                    <FileText size={14} /> Export Excel
                                </button>
                                <button className={styles.exportMenuItem} onClick={() => handleExport('pdf')}>
                                    <Download size={14} /> Export PDF
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Date Range Selector Toolbar */}
            <div className={styles.filterBar}>
                <div className={styles.presetGroup}>
                    {(['today', 'yesterday', '7d', '30d', '90d', '6m', '1y', 'ytd', 'all', 'custom'] as DateRangePreset[]).map((p) => (
                        <button
                            key={p}
                            className={`${styles.presetBtn} ${preset === p ? styles.presetBtnActive : ''}`}
                            onClick={() => setPreset(p)}
                        >
                            {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : p === '90d' ? 'Last 90 Days' : p === '6m' ? '6 Months' : p === '1y' ? '1 Year' : p === 'ytd' ? 'Year to Date' : p === 'all' ? 'All Time (Live)' : p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : 'Custom'}
                        </button>
                    ))}
                </div>

                {preset === 'custom' && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                        <span style={{ color: '#64748b' }}>to</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Compare:</span>
                    <button
                        className={`${styles.presetBtn} ${compareWith === 'previous_period' ? styles.presetBtnActive : ''}`}
                        onClick={() => setCompareWith(compareWith === 'previous_period' ? 'none' : 'previous_period')}
                    >
                        vs Previous Period
                    </button>
                </div>
            </div>

            {/* 15 Report Tabs Navigation */}
            <div className={styles.tabsScroll}>
                {reportTabs.map((t) => (
                    <button
                        key={t.id}
                        className={`${styles.reportTab} ${activeTab === t.id ? styles.reportTabActive : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        {t.icon}
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Active Alerts Banner if Any */}
            {alerts && alerts.length > 0 && activeTab === 'overview' && (
                <div style={{ marginBottom: '1.5rem' }}>
                    {alerts.map((al: any) => (
                        <div
                            key={al.id}
                            className={`${styles.alertItem} ${al.severity === 'critical' ? styles.alertCritical : al.severity === 'warning' ? styles.alertWarning : styles.alertInfo}`}
                        >
                            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ flex: 1 }}>
                                <strong style={{ fontSize: '0.9rem' }}>{al.title}: </strong>
                                <span style={{ fontSize: '0.88rem' }}>{al.message}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ==============================================================
                TAB 1: OVERVIEW SCORECARD
               ============================================================== */}
            {activeTab === 'overview' && (
                <div>
                    {/* Primary KPI Grid */}
                    <div className={adminStyles.statGrid}>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Total Visitors</span>
                            <span className={adminStyles.statValue} style={{ color: 'var(--primary)' }}>
                                {totalVisitors.toLocaleString()}
                            </span>
                            {compareWith !== 'none' && (
                                <div className={comparison.visitorsPct >= 0 ? styles.comparePositive : styles.compareNegative}>
                                    {comparison.visitorsPct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    <span>{comparison.visitorsPct}% vs prev period</span>
                                </div>
                            )}
                        </div>

                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Active Now (Real-Time)</span>
                            <span className={adminStyles.statValue} style={{ color: '#10b981' }}>
                                {liveSessions.length} Users
                            </span>
                            <div className={styles.compareNeutral}>
                                <span>{liveSessions.filter(s => s.isCheckoutActive).length} in checkout now</span>
                            </div>
                        </div>

                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Total Sessions</span>
                            <span className={adminStyles.statValue} style={{ color: '#3b82f6' }}>
                                {totalSessions.toLocaleString()}
                            </span>
                            <div className={styles.compareNeutral}>
                                <span>{pagesPerSession} pages / session</span>
                            </div>
                        </div>

                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Total Page Views</span>
                            <span className={adminStyles.statValue} style={{ color: '#6366f1' }}>
                                {totalPageViews.toLocaleString()}
                            </span>
                            <div className={styles.compareNeutral}>
                                <span>Avg {Math.floor(avgDurationSeconds / 60)}m {avgDurationSeconds % 60}s duration</span>
                            </div>
                        </div>

                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Cart Additions</span>
                            <span className={adminStyles.statValue} style={{ color: '#f59e0b' }}>
                                {totalCartAdds.toLocaleString()}
                            </span>
                            <div className={styles.compareNeutral}>
                                <span>{cartConversionRate}% cart conversion</span>
                            </div>
                        </div>

                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Checkout Starts</span>
                            <span className={adminStyles.statValue} style={{ color: '#ec4899' }}>
                                {totalCheckoutStarts.toLocaleString()}
                            </span>
                            <div className={styles.compareNeutral}>
                                <span>{checkoutConversionRate}% checkout conversion</span>
                            </div>
                        </div>

                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Total Purchases</span>
                            <span className={adminStyles.statValue} style={{ color: '#008080' }}>
                                {totalPurchases.toLocaleString()} Orders
                            </span>
                            {compareWith !== 'none' && (
                                <div className={comparison.ordersPct >= 0 ? styles.comparePositive : styles.compareNegative}>
                                    {comparison.ordersPct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    <span>{comparison.ordersPct}% vs prev period</span>
                                </div>
                            )}
                        </div>

                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Overall Conversion Rate</span>
                            <span className={adminStyles.statValue} style={{ color: '#10b981' }}>
                                {overallConversionRate}%
                            </span>
                            <div className={styles.compareNeutral}>
                                <span>Benchmark: 2.5% – 3.5%</span>
                            </div>
                        </div>

                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Total Revenue</span>
                            <span className={adminStyles.statValue} style={{ color: 'var(--secondary)' }}>
                                ₹{totalRevenue.toLocaleString()}
                            </span>
                            {compareWith !== 'none' && (
                                <div className={comparison.revenuePct >= 0 ? styles.comparePositive : styles.compareNegative}>
                                    {comparison.revenuePct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    <span>{comparison.revenuePct}% vs prev period</span>
                                </div>
                            )}
                        </div>

                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Average Order Value (AOV)</span>
                            <span className={adminStyles.statValue} style={{ color: '#8b5cf6' }}>
                                ₹{averageOrderValue.toLocaleString()}
                            </span>
                            <div className={styles.compareNeutral}>
                                <span>Per completed purchase</span>
                            </div>
                        </div>

                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Cart Abandonment Rate</span>
                            <span className={adminStyles.statValue} style={{ color: '#ef4444' }}>
                                {cartAbandonmentRate}%
                            </span>
                            <div className={styles.compareNeutral}>
                                <span>Items added but not purchased</span>
                            </div>
                        </div>

                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Checkout Abandonment Rate</span>
                            <span className={adminStyles.statValue} style={{ color: '#f97316' }}>
                                {checkoutAbandonmentRate}%
                            </span>
                            <div className={styles.compareNeutral}>
                                <span>Started checkout but did not pay</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Funnel Snapshot Card */}
                    <div className={styles.cardSection}>
                        <div className={styles.cardHeader}>
                            <h3><TrendingUp size={20} color="var(--primary)" /> Conversion Funnel Snapshot</h3>
                            <button className={adminStyles.viewBtn} onClick={() => setActiveTab('funnel')}>View Full 12-Step Funnel →</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {funnelData.steps.slice(0, 7).map((step: any) => (
                                <div key={step.id} className={styles.funnelRow}>
                                    <div>
                                        <strong style={{ fontSize: '0.9rem' }}>{step.name}</strong>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{step.description}</p>
                                    </div>
                                    <div className={styles.funnelTrack}>
                                        <div className={styles.funnelFill} style={{ width: `${Math.min(100, Math.max(4, step.conversionFromTotal))}%` }}></div>
                                    </div>
                                    <div style={{ textAlign: 'right', fontWeight: 700 }}>{step.count.toLocaleString()}</div>
                                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>{Math.min(100, Math.max(0, step.conversionFromTotal))}%</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ==============================================================
                TAB 2: LIVE ACTIVITY
               ============================================================== */}
            {activeTab === 'live' && (
                <div>
                    <div className={adminStyles.statGrid} style={{ marginBottom: '1.5rem' }}>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Active Visitors Right Now</span>
                            <span className={adminStyles.statValue} style={{ color: '#10b981' }}>{liveSessions.length}</span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Active in Checkout</span>
                            <span className={adminStyles.statValue} style={{ color: '#f59e0b' }}>
                                {liveSessions.filter(s => s.isCheckoutActive).length}
                            </span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Active Carts</span>
                            <span className={adminStyles.statValue} style={{ color: '#3b82f6' }}>
                                {liveSessions.filter(s => s.cartCount > 0).length}
                            </span>
                        </div>
                    </div>

                    <div className={styles.cardSection}>
                        <div className={styles.cardHeader}>
                            <h3><Activity size={20} color="#10b981" /> Currently Active Browsing Sessions</h3>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Updates automatically without page refresh</span>
                        </div>

                        {liveSessions.length === 0 ? (
                            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                                <p>No other active visitors detected in the last 90 seconds.</p>
                                <p style={{ fontSize: '0.82rem' }}>Open the store in another tab or device to see live sessions appear here!</p>
                            </div>
                        ) : (
                            <table className={adminStyles.table}>
                                <thead>
                                    <tr>
                                        <th>Visitor ID</th>
                                        <th>Current Page</th>
                                        <th>Current Product</th>
                                        <th>Cart State</th>
                                        <th>Device</th>
                                        <th>Source</th>
                                        <th>Last Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {liveSessions.map((s) => (
                                        <tr key={s.sessionId}>
                                            <td><code>{s.visitorId.slice(0, 10)}...</code></td>
                                            <td><span className={adminStyles.statusBadge} style={{ background: '#f0fdf4', color: '#166534' }}>{s.currentPath}</span></td>
                                            <td>{s.currentProduct || '—'}</td>
                                            <td>
                                                {s.cartCount > 0 ? (
                                                    <strong>{s.cartCount} items (₹{s.cartTotal})</strong>
                                                ) : (
                                                    <span style={{ color: '#94a3b8' }}>Empty</span>
                                                )}
                                            </td>
                                            <td>{s.device?.type} ({s.device?.browser})</td>
                                            <td>{s.trafficSource?.source}</td>
                                            <td>{Math.max(0, Math.round((Date.now() - (typeof s.lastActive === 'number' ? s.lastActive : (s.lastActive as any)?.toMillis?.() || (s.lastActive as any)?.seconds * 1000 || Date.now())) / 1000))}s ago</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ==============================================================
                TAB 3: SHOPPING FUNNEL REPORT (Full 12 Stages)
               ============================================================== */}
            {activeTab === 'funnel' && (
                <div className={styles.cardSection}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h3><TrendingUp size={20} color="var(--primary)" /> Complete 12-Stage E-Commerce Conversion Funnel</h3>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                Tracks conversion percentage and drop-offs between every single touchpoint.
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Overall Funnel Conversion:</span>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{overallConversionRate}%</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem' }}>
                        {funnelData.steps.map((step: any, index: number) => (
                            <div key={step.id} className={styles.funnelRow}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'rgba(0,128,128,0.1)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px' }}>
                                            {index + 1}
                                        </span>
                                        <strong style={{ fontSize: '0.9rem' }}>{step.name}</strong>
                                    </div>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>{step.description}</p>
                                </div>

                                <div className={styles.funnelTrack}>
                                    <div
                                        className={styles.funnelFill}
                                        style={{ width: `${Math.min(100, Math.max(4, step.conversionFromTotal))}%` }}
                                    ></div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700 }}>{step.count.toLocaleString()}</div>
                                    {index > 0 && step.dropoffCount > 0 && (
                                        <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>-{step.dropoffCount} left</span>
                                    )}
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{Math.min(100, Math.max(0, step.conversionFromTotal))}%</div>
                                    {index > 0 && (
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{Math.min(100, Math.max(0, step.conversionFromPrevious))}% of prev</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ==============================================================
                TAB 4: CART ABANDONMENT REPORT
               ============================================================== */}
            {activeTab === 'cart_abandonment' && (
                <div>
                    <div className={adminStyles.statGrid}>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Carts Created</span>
                            <span className={adminStyles.statValue}>{cartAbandonmentData.cartsCreated.toLocaleString()}</span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Cart Abandonment Rate</span>
                            <span className={adminStyles.statValue} style={{ color: '#ef4444' }}>{cartAbandonmentData.abandonmentRate}%</span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Average Abandoned Cart Value</span>
                            <span className={adminStyles.statValue} style={{ color: '#f59e0b' }}>₹{cartAbandonmentData.avgCartValue}</span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Estimated Revenue Lost</span>
                            <span className={adminStyles.statValue} style={{ color: '#dc2626' }}>
                                ₹{(cartAbandonmentData.abandonedCartsCount * cartAbandonmentData.avgCartValue).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className={styles.cardSection}>
                        <div className={styles.cardHeader}>
                            <h3><ShoppingCart size={20} color="var(--primary)" /> Products Most Frequently Left Behind in Carts</h3>
                        </div>
                        <table className={adminStyles.table}>
                            <thead>
                                <tr>
                                    <th>Product Name</th>
                                    <th>Abandonment Frequency</th>
                                    <th>Potential Revenue Lost</th>
                                    <th>Suggested Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cartAbandonmentData.abandonedProducts.map((p: any) => (
                                    <tr key={p.productId}>
                                        <td><strong>{p.productName}</strong></td>
                                        <td>{p.frequency} carts</td>
                                        <td style={{ color: '#dc2626', fontWeight: 600 }}>₹{p.potentialRevenueLost.toLocaleString()}</td>
                                        <td>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
                                                Consider free shipping badge or combo discount
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ==============================================================
                TAB 5: CHECKOUT ABANDONMENT ANALYSIS
               ============================================================== */}
            {activeTab === 'checkout_abandonment' && (
                <div>
                    <div className={styles.cardSection}>
                        <div className={styles.cardHeader}>
                            <h3><ShieldAlert size={20} color="var(--secondary)" /> Checkout Stages Drop-off Breakdown</h3>
                            <span style={{ fontWeight: 700, color: '#ef4444' }}>Abandonment Rate: {checkoutAbandonmentData.checkoutAbandonmentRate}%</span>
                        </div>

                        <table className={adminStyles.table}>
                            <thead>
                                <tr>
                                    <th>Checkout Stage</th>
                                    <th>Reached Stage</th>
                                    <th>Dropped Out</th>
                                    <th>Drop-off Rate (%)</th>
                                    <th>Average Time Spent</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>Step 1: Shipping Address</strong></td>
                                    <td>{checkoutAbandonmentData.step1Shipping.reached}</td>
                                    <td style={{ color: '#dc2626' }}>{checkoutAbandonmentData.step1Shipping.left}</td>
                                    <td><strong style={{ color: '#dc2626' }}>{checkoutAbandonmentData.step1Shipping.dropoffPct}%</strong></td>
                                    <td>{checkoutAbandonmentData.step1Shipping.avgTimeSec}s</td>
                                </tr>
                                <tr>
                                    <td><strong>Step 2: Delivery Priority</strong></td>
                                    <td>{checkoutAbandonmentData.step2Delivery.reached}</td>
                                    <td style={{ color: '#dc2626' }}>{checkoutAbandonmentData.step2Delivery.left}</td>
                                    <td><strong style={{ color: '#dc2626' }}>{checkoutAbandonmentData.step2Delivery.dropoffPct}%</strong></td>
                                    <td>{checkoutAbandonmentData.step2Delivery.avgTimeSec}s</td>
                                </tr>
                                <tr>
                                    <td><strong>Step 3: Payment Method Selection</strong></td>
                                    <td>{checkoutAbandonmentData.step3Payment.reached}</td>
                                    <td style={{ color: '#dc2626' }}>{checkoutAbandonmentData.step3Payment.left}</td>
                                    <td><strong style={{ color: '#dc2626' }}>{checkoutAbandonmentData.step3Payment.dropoffPct}%</strong></td>
                                    <td>{checkoutAbandonmentData.step3Payment.avgTimeSec}s</td>
                                </tr>
                                <tr>
                                    <td><strong>Step 4: Final Order Review</strong></td>
                                    <td>{checkoutAbandonmentData.step4Review.reached}</td>
                                    <td style={{ color: '#dc2626' }}>{checkoutAbandonmentData.step4Review.left}</td>
                                    <td><strong style={{ color: '#dc2626' }}>{checkoutAbandonmentData.step4Review.dropoffPct}%</strong></td>
                                    <td>{checkoutAbandonmentData.step4Review.avgTimeSec}s</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Measurable Diagnostic Signals */}
                    <div className={styles.cardSection}>
                        <div className={styles.cardHeader}>
                            <h3><Info size={20} color="var(--primary)" /> Measurable Abandonment Signals & Technical Evidence</h3>
                        </div>
                        <table className={adminStyles.table}>
                            <thead>
                                <tr>
                                    <th>Detected Signal</th>
                                    <th>Category</th>
                                    <th>Occurrences</th>
                                    <th>Severity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {checkoutAbandonmentData.signals.map((sig: any, idx: number) => (
                                    <tr key={idx}>
                                        <td><strong>{sig.signal}</strong></td>
                                        <td><span className={styles.badgeCategory}>{sig.category}</span></td>
                                        <td>{sig.count} times</td>
                                        <td>
                                            <span className={sig.severity === 'high' ? styles.badgeUnderperformer : sig.severity === 'medium' ? styles.badgeHiddenGem : styles.badgeNormal}>
                                                {sig.severity.toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ==============================================================
                TAB 6: PRODUCT PERFORMANCE & QUADRANTS
               ============================================================== */}
            {activeTab === 'products' && (
                <div className={styles.cardSection}>
                    <div className={styles.cardHeader}>
                        <h3><ShoppingBag size={20} color="var(--primary)" /> Product Funnels & Quadrant Classification</h3>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Identifies Stars, Hidden Gems, and Underperformers</span>
                    </div>

                    <table className={adminStyles.table}>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Category</th>
                                <th>Views</th>
                                <th>Cart Adds</th>
                                <th>View→Cart</th>
                                <th>Purchases</th>
                                <th>Revenue</th>
                                <th>Overall Conv.</th>
                                <th>Classification</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productPerformanceList.map((p: any) => (
                                <tr key={p.id}>
                                    <td><strong>{p.name}</strong></td>
                                    <td>{p.category}</td>
                                    <td>{p.views}</td>
                                    <td>{p.cartAdditions}</td>
                                    <td>{p.viewToCartRate}%</td>
                                    <td style={{ fontWeight: 700 }}>{p.purchases}</td>
                                    <td style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{p.revenue.toLocaleString()}</td>
                                    <td><strong>{p.overallConversionRate}%</strong></td>
                                    <td>
                                        <span className={
                                            p.classification === 'Star' ? styles.badgeStar :
                                            p.classification === 'High Traffic Low Conversion' ? styles.badgeUnderperformer :
                                            p.classification === 'Hidden Gem' ? styles.badgeHiddenGem :
                                            p.classification === 'High Cart Dropoff' ? styles.badgeDropoff :
                                            styles.badgeNormal
                                        }>
                                            {p.classification}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ==============================================================
                TAB 7: SEARCH ANALYTICS REPORT
               ============================================================== */}
            {activeTab === 'search' && (
                <div className={styles.cardSection}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h3><Search size={20} color="var(--primary)" /> Internal Website Search Analytics</h3>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                "What users are searching for" & identifying unfulfilled customer demand
                            </p>
                        </div>
                    </div>

                    <table className={adminStyles.table}>
                        <thead>
                            <tr>
                                <th>Search Term</th>
                                <th>Search Volume</th>
                                <th>Result Clicks</th>
                                <th>CTR (%)</th>
                                <th>Cart Adds</th>
                                <th>Purchases</th>
                                <th>Search Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {searchList.length > 0 ? (
                                searchList.map((s: any, idx: number) => (
                                    <tr key={idx}>
                                        <td><strong>&quot;{s.query}&quot;</strong></td>
                                        <td>{s.searchesCount}</td>
                                        <td>{s.resultClicks}</td>
                                        <td>{s.clickThroughRate}%</td>
                                        <td>{s.cartAdditions}</td>
                                        <td><strong>{s.purchases}</strong></td>
                                        <td>
                                            {s.isZeroResult ? (
                                                <span className={styles.badgeUnderperformer}>ZERO RESULTS (DEMAND GAP)</span>
                                            ) : s.conversionRate > 25 ? (
                                                <span className={styles.badgeStar}>HIGH CONVERTING</span>
                                            ) : (
                                                <span className={styles.badgeNormal}>NORMAL</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                                        No internal site searches recorded in this date range. As customers search the store, live queries will appear here automatically.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ==============================================================
                TAB 8: TRAFFIC SOURCES & UTM
               ============================================================== */}
            {activeTab === 'traffic' && (
                <div className={styles.cardSection}>
                    <div className={styles.cardHeader}>
                        <h3><Globe size={20} color="var(--primary)" /> Traffic Channels & Acquisition Performance</h3>
                    </div>

                    <table className={adminStyles.table}>
                        <thead>
                            <tr>
                                <th>Traffic Channel</th>
                                <th>Medium</th>
                                <th>Estimated Visitors</th>
                                <th>Avg. Order Value</th>
                                <th>Orders</th>
                                <th>Revenue Contribution</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(analyticsData.trafficBreakdown || []).map((t: any, idx: number) => (
                                <tr key={idx}>
                                    <td><strong>{t.channel}</strong></td>
                                    <td><code>{t.medium}</code></td>
                                    <td>{t.visitors}</td>
                                    <td>{t.aov > 0 ? `₹${Math.round(t.aov).toLocaleString()}` : '—'}</td>
                                    <td>{t.orders}</td>
                                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{Math.round(t.revenue).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ==============================================================
                TAB 9: CUSTOMER JOURNEY
               ============================================================== */}
            {activeTab === 'journey' && (
                <div className={styles.cardSection}>
                    <div className={styles.cardHeader}>
                        <h3><Compass size={20} color="var(--primary)" /> Customer Navigation Pathways & Journey Trees</h3>
                    </div>

                    <table className={adminStyles.table}>
                        <thead>
                            <tr>
                                <th>Step / Current Node</th>
                                <th>Traffic Reached</th>
                                <th>Next Routing & Transitions</th>
                                <th>Drop-off / Exit Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customerJourneyPaths.length > 0 ? (
                                customerJourneyPaths.map((node: any, idx: number) => (
                                    <tr key={idx}>
                                        <td><code>{node.path}</code></td>
                                        <td><strong>{node.visits.toLocaleString()}</strong></td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {node.nextPages.map((nxt: any, nIdx: number) => (
                                                    <span key={nIdx} style={{ fontSize: '0.82rem' }}>
                                                        → <strong>{nxt.path}</strong> ({nxt.percentage}%)
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={{ color: node.exitRate > 30 ? '#dc2626' : 'var(--text-secondary)', fontWeight: 600 }}>
                                            {node.exitRate}% exit rate
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No customer navigation paths recorded in this date range.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ==============================================================
                TAB 10: DEVICE & TECH
               ============================================================== */}
            {activeTab === 'device' && (
                <div>
                    <div className={adminStyles.statGrid}>
                        {(analyticsData.deviceBreakdown || []).map((d: any, idx: number) => (
                            <div key={idx} className={adminStyles.statCard}>
                                <span className={adminStyles.statLabel}>{d.device} Share</span>
                                <span className={adminStyles.statValue} style={{ color: idx === 0 ? '#008080' : idx === 1 ? '#3b82f6' : '#f59e0b' }}>
                                    {d.sharePct}%
                                </span>
                                <div className={styles.compareNeutral}>
                                    <span>{d.users} live visitors ({d.sessions} sessions)</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className={styles.cardSection}>
                        <div className={styles.cardHeader}>
                            <h3><Smartphone size={20} color="var(--primary)" /> Cross-Device Conversion & Activity Discrepancy</h3>
                        </div>
                        <table className={adminStyles.table}>
                            <thead>
                                <tr>
                                    <th>Device Category</th>
                                    <th>Live Visitors</th>
                                    <th>Live Sessions</th>
                                    <th>Traffic Share (%)</th>
                                    <th>Checkout Completion (%)</th>
                                    <th>Conversion Rate (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(analyticsData.deviceBreakdown || []).map((d: any, idx: number) => (
                                    <tr key={idx}>
                                        <td><strong>{d.device}</strong></td>
                                        <td>{d.users}</td>
                                        <td>{d.sessions}</td>
                                        <td>{d.sharePct}%</td>
                                        <td>{d.checkoutCompletion}%</td>
                                        <td><strong>{d.conversionRate}%</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ==============================================================
                TAB 11: PAYMENT ANALYTICS
               ============================================================== */}
            {activeTab === 'payment' && (
                <div>
                    <div className={adminStyles.statGrid}>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Payment Success Rate</span>
                            <span className={adminStyles.statValue} style={{ color: '#10b981' }}>{paymentReportData.successRate}%</span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Payment Failure Rate</span>
                            <span className={adminStyles.statValue} style={{ color: '#ef4444' }}>{paymentReportData.failureRate}%</span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Payment Cancellation Rate</span>
                            <span className={adminStyles.statValue} style={{ color: '#f59e0b' }}>{paymentReportData.cancellationRate}%</span>
                        </div>
                    </div>

                    <div className={styles.cardSection}>
                        <div className={styles.cardHeader}>
                            <h3><CreditCard size={20} color="var(--primary)" /> Payment Method Performance & Gateway Diagnostics</h3>
                        </div>

                        <table className={adminStyles.table}>
                            <thead>
                                <tr>
                                    <th>Payment Method</th>
                                    <th>Initiated</th>
                                    <th>Successful</th>
                                    <th>Failed</th>
                                    <th>Success Rate</th>
                                    <th>Revenue Generated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paymentReportData.methodBreakdown.map((m: any, idx: number) => (
                                    <tr key={idx}>
                                        <td><strong>{m.method}</strong></td>
                                        <td>{m.initiated}</td>
                                        <td style={{ color: '#10b981', fontWeight: 600 }}>{m.successful}</td>
                                        <td style={{ color: '#ef4444' }}>{m.failed}</td>
                                        <td><strong>{m.successRate}%</strong></td>
                                        <td style={{ fontWeight: 700 }}>₹{m.revenue.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <h4 style={{ margin: '2rem 0 1rem', fontSize: '1rem', color: 'var(--text-primary)' }}>Categorized Gateway Failure Reasons</h4>
                        <table className={adminStyles.table}>
                            <thead>
                                <tr>
                                    <th>Failure Reason</th>
                                    <th>Category</th>
                                    <th>Failures</th>
                                    <th>Share (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paymentReportData.failureReasons.map((r: any, idx: number) => (
                                    <tr key={idx}>
                                        <td><strong>{r.reason}</strong></td>
                                        <td><span className={styles.badgeCategory}>{r.category}</span></td>
                                        <td>{r.count}</td>
                                        <td>{r.percentage}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ==============================================================
                TAB 12: PAGE PERFORMANCE
               ============================================================== */}
            {activeTab === 'pages' && (
                <div className={styles.cardSection}>
                    <div className={styles.cardHeader}>
                        <h3><Eye size={20} color="var(--primary)" /> Page-by-Page Traffic, Engagement & Exit Rates</h3>
                    </div>

                    <table className={adminStyles.table}>
                        <thead>
                            <tr>
                                <th>Page Route</th>
                                <th>Views</th>
                                <th>Unique Visitors</th>
                                <th>Avg. Time</th>
                                <th>Bounce Rate</th>
                                <th>Exit Rate</th>
                                <th>Avg. Scroll Depth</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagePerformanceList.map((pg: any, idx: number) => (
                                <tr key={idx}>
                                    <td><code>{pg.path}</code></td>
                                    <td><strong>{pg.views.toLocaleString()}</strong></td>
                                    <td>{pg.uniqueVisitors.toLocaleString()}</td>
                                    <td>{pg.avgTimeOnPageSec}s</td>
                                    <td>{pg.bounceRate}%</td>
                                    <td style={{ color: pg.exitRate > 30 ? '#dc2626' : 'inherit' }}>{pg.exitRate}%</td>
                                    <td>{pg.avgScrollDepthPct}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ==============================================================
                TAB 13: USER BEHAVIOR
               ============================================================== */}
            {activeTab === 'behavior' && (
                <div className={styles.cardSection}>
                    <div className={styles.cardHeader}>
                        <h3><Users size={20} color="var(--primary)" /> Visitor Cohorts & Engagement Dynamics</h3>
                    </div>

                    <div className={adminStyles.statGrid} style={{ marginBottom: '2rem' }}>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>New Visitors</span>
                            <span className={adminStyles.statValue}>
                                {newVisitors.toLocaleString()} ({totalVisitors > 0 ? Math.min(100, Math.max(0, Math.round((newVisitors / totalVisitors) * 100))) : 0}%)
                            </span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Returning Visitors</span>
                            <span className={adminStyles.statValue}>
                                {returningVisitors.toLocaleString()} ({totalVisitors > 0 ? Math.min(100, Math.max(0, Math.round((returningVisitors / totalVisitors) * 100))) : 0}%)
                            </span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Engagement Rate</span>
                            <span className={adminStyles.statValue} style={{ color: '#10b981' }}>{Math.min(100, Math.max(0, engagementRate))}%</span>
                        </div>
                    </div>

                    <h4 style={{ margin: '1rem 0', fontSize: '1rem' }}>Scroll Depth Engagement Milestones</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {(analyticsData?.scrollMilestones || []).map((m: any, idx: number) => (
                            <div key={idx} className={styles.funnelRow}>
                                <div><strong>{m.milestone}</strong></div>
                                <div className={styles.funnelTrack}>
                                    <div className={styles.funnelFill} style={{ width: `${Math.min(100, Math.max(0, m.pct))}%` }}></div>
                                </div>
                                <div style={{ textAlign: 'right', fontWeight: 700 }}>{Math.min(100, Math.max(0, m.pct))}%</div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{m.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ==============================================================
                TAB 14: REVENUE & CONVERSION
               ============================================================== */}
            {activeTab === 'revenue' && (
                <div>
                    <div className={adminStyles.statGrid}>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Total Net Revenue</span>
                            <span className={adminStyles.statValue} style={{ color: 'var(--primary)' }}>₹{totalRevenue.toLocaleString()}</span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Verified Orders</span>
                            <span className={adminStyles.statValue}>{totalPurchases}</span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Average Order Value</span>
                            <span className={adminStyles.statValue}>₹{averageOrderValue}</span>
                        </div>
                        <div className={adminStyles.statCard}>
                            <span className={adminStyles.statLabel}>Revenue per Visitor</span>
                            <span className={adminStyles.statValue} style={{ color: '#10b981' }}>
                                ₹{totalVisitors > 0 ? (totalRevenue / totalVisitors).toFixed(2) : '0'}
                            </span>
                        </div>
                    </div>

                    <div className={styles.cardSection}>
                        <div className={styles.cardHeader}>
                            <h3><Percent size={20} color="var(--primary)" /> Top Revenue Generating Products</h3>
                        </div>
                        <table className={adminStyles.table}>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Units Sold</th>
                                    <th>Gross Revenue</th>
                                    <th>Revenue Contribution</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productPerformanceList.slice(0, 8).map((p: any) => (
                                    <tr key={p.id}>
                                        <td><strong>{p.name}</strong></td>
                                        <td>{p.purchases} units</td>
                                        <td><strong style={{ color: 'var(--primary)' }}>₹{p.revenue.toLocaleString()}</strong></td>
                                        <td>
                                            {totalRevenue > 0 ? Math.min(100, Math.max(0, (p.revenue / totalRevenue) * 100)).toFixed(1) : 0}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ==============================================================
                TAB 15: BUSINESS INSIGHTS & ANOMALIES
               ============================================================== */}
            {activeTab === 'insights' && (
                <div>
                    <div className={styles.cardHeader} style={{ marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ margin: 0 }}><Sparkles size={20} color="var(--primary)" /> Automated Business Insights Engine</h3>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                Explicit separation between Factual Metrics, Analytical Signals, and Actionable Diagnostic Insights
                            </p>
                        </div>
                    </div>

                    {insights.map((ins: any) => (
                        <div
                            key={ins.id}
                            className={`${styles.insightCard} ${
                                ins.type === 'critical' ? styles.insightCritical :
                                ins.type === 'warning' ? styles.insightWarning :
                                ins.type === 'positive' ? styles.insightPositive :
                                styles.insightInfo
                            }`}
                        >
                            <div className={styles.insightHeader}>
                                <h4 className={styles.insightTitle}>{ins.title}</h4>
                                <span className={styles.badgeCategory}>{ins.category}</span>
                            </div>

                            <div className={styles.insightSection}>
                                <span className={styles.insightLabel}>📊 FACTUAL METRIC:</span>
                                <span>{ins.factualMetric}</span>
                            </div>

                            <div className={styles.insightSection}>
                                <span className={styles.insightLabel}>⚡ ANALYTICAL SIGNAL:</span>
                                <span>{ins.analyticalSignal}</span>
                            </div>

                            <div className={styles.insightSection}>
                                <span className={styles.insightLabel}>💡 POSSIBLE EXPLANATION:</span>
                                <span style={{ color: '#475569' }}>{ins.possibleExplanation}</span>
                            </div>

                            <div className={styles.insightSection} style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #e2e8f0' }}>
                                <span className={styles.insightLabel} style={{ color: 'var(--primary)' }}>🎯 ACTION RECOMMENDATION:</span>
                                <strong style={{ color: 'var(--primary)' }}>{ins.actionRecommendation}</strong>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
