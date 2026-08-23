"use client";

export const dynamic = "force-dynamic";

import React from 'react';
import { useCustomers } from '@/hooks/useFirestore';
import styles from '../admin.module.css';

export default function CustomersPage() {
    const { customers, loading } = useCustomers(true);

    return (
        <div>
            <div className={styles.sectionHeader}>
                <h2>Customer Directory</h2>
                <button className={styles.viewBtn}>Notify All</button>
            </div>

            <div className={styles.recentOrders}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Customer Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>City</th>
                            <th>Orders</th>
                            <th>Spent</th>
                            <th>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Loading customers...</td></tr>
                        ) : customers.length > 0 ? (
                            customers.map((row) => (
                                <tr key={row.id}>
                                    <td><strong>{row.name}</strong></td>
                                    <td>{row.email}</td>
                                    <td>{row.phone || <em style={{ color: '#94a3b8' }}>-</em>}</td>
                                    <td>{row.city || <em style={{ color: '#94a3b8' }}>-</em>}</td>
                                    <td>{row.orderCount}</td>
                                    <td>₹{row.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td>{row.joinedDate?.toDate ? new Date(row.joinedDate.toDate()).toLocaleDateString() : 'New'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No customers found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
