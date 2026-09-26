"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useProducts, useOrders, useCustomers } from '@/hooks/useFirestore';
import { fetchAnalyticsData, subscribeToLiveActiveSessions, formatOrderDate, safeDateObj } from '@/lib/analytics/engine';
import { ActiveSession, DateRangePreset } from '@/types/analytics';
import { BarChart3, ArrowRight, Activity, Users, ShoppingBag, CreditCard } from 'lucide-react';
import styles from './admin.module.css';

export default function AdminDashboard() {
    const { products, loading: productsLoading } = useProducts();
    const { orders, loading: ordersLoading } = useOrders(undefined, true);
    const { customers, loading: customersLoading } = useCustomers(true);

    const [preset, setPreset] = useState<DateRangePreset>('7d');
    const [liveSessions, setLiveSessions] = useState<ActiveSession[]>([]);
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);

    // 1. Subscribe to real-time live active sessions
    useEffect(() => {
        const unsub = subscribeToLiveActiveSessions((sessions) => {
            setLiveSessions(sessions);
        });
        return () => unsub();
    }, []);

    // 2. Fetch analytics KPIs based on date preset
    useEffect(() => {
        if (productsLoading || ordersLoading) return;
        let isMounted = true;
        setLoadingAnalytics(true);

        fetchAnalyticsData(preset, '', '', orders, products)
            .then(data => {
                if (isMounted) {
                    setAnalyticsData(data);
                    setLoadingAnalytics(false);
                }
            })
            .catch(err => {
                console.error("Failed to load dashboard analytics:", err);
                if (isMounted) setLoadingAnalytics(false);
            });

        return () => {
            isMounted = false;
        };
    }, [preset, productsLoading, ordersLoading, orders, products]);

    if (productsLoading || ordersLoading || customersLoading) {
        return (
            <div className={styles.dashboardContent}>
                <h2 className={styles.pageTitle}>Dashboard Overview</h2>
                <div style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard data...</div>
            </div>
        );
    }

    // Helper to get raw amount
    const getOrderAmount = (order: any) => {
        const amountStr = typeof order.amount === 'string' ? order.amount : String(order.amount || '0');
        return parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
    };

    // Calculate temporal stats
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const isToday = (date: any) => {
        const d = safeDateObj(date);
        return d ? d.toLocaleDateString() === todayStr : false;
    };

    const isThisMonth = (date: any) => {
        const d = safeDateObj(date);
        return d ? (d.getMonth() === currentMonth && d.getFullYear() === currentYear) : false;
    };

    const revenueTotal = orders.reduce((sum, o) => sum + getOrderAmount(o), 0);
    const revenueToday = orders.filter(o => isToday(o.date)).reduce((sum, o) => sum + getOrderAmount(o), 0);
    const revenueMonth = orders.filter(o => isThisMonth(o.date)).reduce((sum, o) => sum + getOrderAmount(o), 0);

    const activeOrders = orders.filter(o => !['Delivered', 'Cancelled', 'Returned'].includes(o.status)).length;
    const lowStockItems = products.filter(p => {
        const stockVal = p.stock?.toString() || '0';
        const numericStock = parseInt(stockVal.match(/\d+/)?.[0] || '0');
        return p.status === 'Low Stock' || numericStock < 10;
    }).length;
    const totalCustomers = customers ? customers.length : 0;

    // Operational stats
    const operationalStats = [
        { label: "Total Revenue", val: `₹${revenueTotal.toLocaleString()}`, color: "#008080" },
        { label: "Today's Revenue", val: `₹${revenueToday.toLocaleString()}`, color: "#10b981" },
        { label: "Monthly Revenue", val: `₹${revenueMonth.toLocaleString()}`, color: "#3b82f6" },
        { label: "Active Orders", val: activeOrders.toString(), color: "#e31e24" },
        { label: "Total Customers", val: totalCustomers.toString(), color: "#f4b41a" },
        { label: "Low Stock Items", val: lowStockItems.toString(), color: "#475569" }
    ];

    // Analytics KPIs
    const kpi = analyticsData?.kpis;
    const formatDuration = (seconds: number) => {
        if (!seconds || seconds <= 0) return '0s';
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    const formatRate = (val: number | undefined | null, decimals: number = 1): string => {
        if (val === undefined || val === null || isNaN(val)) return '0.0%';
        const clamped = Math.min(100, Math.max(0, val));
        return `${clamped.toFixed(decimals)}%`;
    };

    // The 19 Recommended Main Dashboard KPIs (All Rates Strictly Clamped to Max 100%)
    const recommendedKpis = [
        { label: "Total Users", val: loadingAnalytics ? '...' : (analyticsData?.totalVisitors ?? kpi?.totalUsers ?? 0).toLocaleString(), color: "#008080" },
        { label: "Active Users (Right Now)", val: liveSessions.length.toString(), color: "#10b981" },
        { label: "New Users", val: loadingAnalytics ? '...' : (analyticsData?.newVisitors ?? kpi?.newUsers ?? 0).toLocaleString(), color: "#3b82f6" },
        { label: "Returning Users", val: loadingAnalytics ? '...' : (analyticsData?.returningVisitors ?? kpi?.returningUsers ?? 0).toLocaleString(), color: "#6366f1" },
        { label: "Sessions", val: loadingAnalytics ? '...' : (analyticsData?.totalSessions ?? kpi?.sessions ?? 0).toLocaleString(), color: "#008080" },
        { label: "Page Views", val: loadingAnalytics ? '...' : (analyticsData?.totalPageViews ?? kpi?.pageViews ?? 0).toLocaleString(), color: "#8b5cf6" },
        { label: "Average Session Duration", val: loadingAnalytics ? '...' : formatDuration(analyticsData?.avgDurationSeconds ?? kpi?.avgSessionDuration ?? 0), color: "#f59e0b" },
        { label: "Pages / Session", val: loadingAnalytics ? '...' : (analyticsData?.pagesPerSession ?? kpi?.pagesPerSession ?? 0).toFixed(1), color: "#06b6d4" },
        { label: "Engagement Rate", val: loadingAnalytics ? '...' : formatRate(analyticsData?.engagementRate ?? kpi?.engagementRate, 1), color: "#10b981" },
        { label: "Add to Cart Events", val: loadingAnalytics ? '...' : (analyticsData?.totalCartAdds ?? kpi?.addToCart ?? 0).toLocaleString(), color: "#f4b41a" },
        { label: "Cart Conversion Rate", val: loadingAnalytics ? '...' : formatRate(analyticsData?.cartConversionRate ?? kpi?.cartConversionRate, 1), color: "#f59e0b" },
        { label: "Checkout Started", val: loadingAnalytics ? '...' : (analyticsData?.totalCheckoutStarts ?? kpi?.checkoutStarted ?? 0).toLocaleString(), color: "#e31e24" },
        { label: "Checkout Conversion Rate", val: loadingAnalytics ? '...' : formatRate(analyticsData?.checkoutConversionRate ?? kpi?.checkoutConversionRate, 1), color: "#10b981" },
        { label: "Purchases", val: loadingAnalytics ? '...' : (analyticsData?.totalPurchases ?? kpi?.purchases ?? 0).toLocaleString(), color: "#10b981" },
        { label: "Overall Conversion Rate", val: loadingAnalytics ? '...' : formatRate(analyticsData?.overallConversionRate ?? kpi?.conversionRate, 2), color: "#008080" },
        { label: "Period Revenue", val: loadingAnalytics ? '...' : `₹${Math.round(analyticsData?.totalRevenue ?? kpi?.revenue ?? 0).toLocaleString()}`, color: "#008080" },
        { label: "Average Order Value (AOV)", val: loadingAnalytics ? '...' : `₹${Math.round(analyticsData?.averageOrderValue ?? kpi?.aov ?? 0).toLocaleString()}`, color: "#3b82f6" },
        { label: "Cart Abandonment Rate", val: loadingAnalytics ? '...' : formatRate(analyticsData?.cartAbandonmentRate ?? kpi?.cartAbandonmentRate, 1), color: "#e31e24" },
        { label: "Checkout Abandonment Rate", val: loadingAnalytics ? '...' : formatRate(analyticsData?.checkoutAbandonmentRate ?? kpi?.checkoutAbandonmentRate, 1), color: "#e31e24" }
    ];

    const recentOrders = orders.slice(0, 5);

    return (
        <div className={styles.dashboardContent}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div>
                    <h2 className={styles.pageTitle} style={{ margin: 0 }}>Dashboard Overview</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className={styles.liveIndicator}>
                        <div className={styles.dot}></div>
                        <span>{liveSessions.length} ACTIVE NOW</span>
                    </div>
                </div>
            </div>

            {/* In-depth Analytics Hub Banner */}
            <div className={styles.analyticsBanner}>
                <div className={styles.analyticsBannerText}>
                    <h4>Custom E-Commerce User Tracking & Funnel Intelligence</h4>
                    <p>Access full 12-stage shopping funnels, cart & checkout abandonment diagnostics, internal search queries, product performance, live sessions, and automated business insights.</p>
                </div>
                <Link href="/admin/analytics" className={styles.analyticsBannerBtn}>
                    <BarChart3 size={16} />
                    <span>View All 15 In-Depth Reports</span>
                    <ArrowRight size={14} />
                </Link>
            </div>

            {/* Operational Overview Cards */}
            <div className={styles.statGrid}>
                {operationalStats.map((stat, i) => (
                    <div key={i} className={styles.statCard}>
                        <span className={styles.statLabel}>{stat.label}</span>
                        <span className={styles.statValue} style={{ color: stat.color }}>{stat.val}</span>
                    </div>
                ))}
            </div>

            {/* 19 Analytics & Tracking KPIs Header with Period Filter */}
            <div className={styles.sectionTitle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Activity size={20} color="var(--primary)" />
                    <span>Key E-Commerce & User Tracking KPIs (19 Core Metrics)</span>
                </div>
                <select
                    className={styles.periodSelect}
                    value={preset}
                    onChange={(e) => setPreset(e.target.value as DateRangePreset)}
                    aria-label="Filter analytics date range"
                >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                    <option value="6m">Last 6 Months</option>
                    <option value="1y">Last 12 Months</option>
                    <option value="ytd">Year to Date</option>
                    <option value="all">All Time (Live Data)</option>
                </select>
            </div>

            {/* 19 Recommended Analytics KPI Grid */}
            <div className={styles.statGrid} style={{ marginBottom: '2.5rem' }}>
                {recommendedKpis.map((kpiItem, idx) => (
                    <div key={idx} className={styles.statCard}>
                        <span className={styles.statLabel}>{kpiItem.label}</span>
                        <span className={styles.statValue} style={{ color: kpiItem.color }}>{kpiItem.val}</span>
                    </div>
                ))}
            </div>

            {/* Recent Orders Section */}
            <div className={styles.recentOrders}>
                <div className={styles.sectionHeader}>
                    <h3>Recent Orders</h3>
                    <Link href="/admin/orders" className={styles.viewBtn}>View All</Link>
                </div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Status</th>
                            <th>Amount</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentOrders.length > 0 ? (
                            recentOrders.map((row) => (
                                <tr key={row.id}>
                                    <td><strong>{row.orderNumber || `#${row.id.slice(-6).toUpperCase()}`}</strong></td>
                                    <td>{row.customerName}</td>
                                    <td><span className={styles.statusBadge}>{row.status}</span></td>
                                    <td>{typeof row.amount === 'string' ? row.amount : `₹${row.amount}`}</td>
                                    <td>{formatOrderDate(row.date || (row as any).createdAt)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No recent orders found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

