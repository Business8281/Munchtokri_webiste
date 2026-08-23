"use client";

export const dynamic = "force-dynamic";

import React from 'react';
import { useProducts, useOrders, useCustomers } from '@/hooks/useFirestore';
import styles from './admin.module.css';

export default function AdminDashboard() {
    const { products, loading: productsLoading } = useProducts();
    const { orders, loading: ordersLoading } = useOrders(undefined, true);
    const { customers, loading: customersLoading } = useCustomers(true);

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
        const d = date?.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString() === todayStr;
    };

    const isThisMonth = (date: any) => {
        const d = date?.toDate ? date.toDate() : new Date(date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
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

    const stats = [
        { label: "Total Revenue", val: `₹${revenueTotal.toLocaleString()}`, color: "#008080" },
        { label: "Today's Revenue", val: `₹${revenueToday.toLocaleString()}`, color: "#10b981" },
        { label: "Monthly Revenue", val: `₹${revenueMonth.toLocaleString()}`, color: "#3b82f6" },
        { label: "Active Orders", val: activeOrders.toString(), color: "#e31e24" },
        { label: "Total Customers", val: totalCustomers.toString(), color: "#f4b41a" },
        { label: "Low Stock Items", val: lowStockItems.toString(), color: "#475569" }
    ];

    const recentOrders = orders.slice(0, 5);

    return (
        <div className={styles.dashboardContent}>
            <div className={styles.headerRow}>
                <h2 className={styles.pageTitle}>Dashboard Overview</h2>
                <div className={styles.liveIndicator}>
                    <div className={styles.dot}></div>
                    <span>LIVE DATA</span>
                </div>
            </div>

            <div className={styles.statGrid}>
                {stats.map((stat, i) => (
                    <div key={i} className={styles.statCard}>
                        <span className={styles.statLabel}>{stat.label}</span>
                        <span className={styles.statValue} style={{ color: stat.color }}>{stat.val}</span>
                    </div>
                ))}
            </div>

            <div className={styles.recentOrders}>
                <div className={styles.sectionHeader}>
                    <h3>Recent Orders</h3>
                    <button className={styles.viewBtn}>View All</button>
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
                                    <td>{typeof row.date === 'string' ? new Date(row.date).toLocaleDateString() : (row.date as any)?.toDate ? new Date((row.date as any).toDate()).toLocaleDateString() : 'Just now'}</td>
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
