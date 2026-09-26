"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from 'react';
import { useOrders } from '@/hooks/useFirestore';
import { ChevronDown, ChevronUp, Truck } from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';
import styles from '../admin.module.css';
import { httpsCallable } from 'firebase/functions';
import { adminFunctions, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { formatOrderDate } from '@/lib/analytics/engine';

export default function OrdersPage() {
    const { orders, loading, updateOrderStatus, updateOrderShipment, updateVelocityShipment } = useOrders(undefined, true);
    const { showNotification } = useNotification();
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [shipping, setShipping] = useState<string | null>(null);
    const [storeSettings, setStoreSettings] = useState<any>(null);

    useEffect(() => {
        const unsubStore = onSnapshot(doc(db, 'settings', 'store'), (snap) => {
            if (snap.exists()) setStoreSettings(snap.data());
        });
        return () => unsubStore();
    }, []);

    const orderStatuses = [
        'Processing',
        'Prepared',
        'Dispatched',
        'Delivered',
        'Cancelled',
        'Refund Requested',
        'Replacement Requested',
        'Return Requested',
        'Returned'
    ];

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleStatusChange = async (id: string, currentStatus: string) => {
        const nextStatusMap: Record<string, string> = {
            'Processing': 'Prepared',
            'Prepared': 'Dispatched',
            'Dispatched': 'Delivered',
            'Delivered': 'Processing',
            'Cancelled': 'Processing',
            'Refund Requested': 'Cancelled',
            'Replacement Requested': 'Prepared',
            'Return Requested': 'Returned',
            'Returned': 'Delivered'
        };
        const nextStatus = nextStatusMap[currentStatus] || 'Processing';
        try {
            await updateOrderStatus(id, nextStatus);
        } catch (error) {
            console.error("Error updating order status:", error);
        }
    };

    const handleShiprocket = async (orderId: string) => {
        setShipping(orderId);
        try {
            const createShiprocketOrder = httpsCallable(adminFunctions, 'createShiprocketOrder');
            const result = await createShiprocketOrder({ orderId });
            const data = result.data as any;
            
            if (data && data.order_id && data.shipment_id) {
                await updateOrderShipment(orderId, {
                    orderId: String(data.order_id),
                    shipmentId: String(data.shipment_id)
                });
                showNotification(`Order shipped successfully! Shiprocket ID: ${data.order_id}`, 'success', { title: 'Shipment Created' });
            } else {
                const errorMessage = data?.message || "Please check administrative logs.";
                showNotification(`Failed to create shipment. ${errorMessage}`, 'error', { title: 'Shipping Error' });
            }
        } catch (error: any) {
            console.error("Shipping failed:", error);
            showNotification(`Error: ${error.message || "Failed to connect to shipping service"}`, 'error', { title: 'System Error' });
        } finally {
            setShipping(null);
        }
    };

    const handleVelocity = async (orderId: string) => {
        setShipping(orderId);
        try {
            const createVelocityOrder = httpsCallable(adminFunctions, 'createVelocityOrder');
            const result = await createVelocityOrder({ orderId });
            const data = result.data as any;
            
            if (data && data.order_id && data.shipment_id) {
                await updateVelocityShipment(orderId, {
                    orderId: String(data.order_id),
                    shipmentId: String(data.shipment_id),
                    awbCode: String(data.awb_code)
                });
                showNotification(`Order shipped successfully! Velocity ID: ${data.order_id}`, 'success', { title: 'Shipment Created' });
            } else {
                const errorMessage = data?.message || "Please check administrative logs.";
                showNotification(`Failed to create Velocity shipment. ${errorMessage}`, 'error', { title: 'Shipping Error' });
            }
        } catch (error: any) {
            console.error("Velocity Shipping failed:", error);
            showNotification(`Error: ${error.message || "Failed to connect to Velocity shipping service"}`, 'error', { title: 'System Error' });
        } finally {
            setShipping(null);
        }
    };

    return (
        <div>
            <div className={styles.sectionHeader}>
                <h2>Orders Management</h2>
                <button className={styles.viewBtn}>Export CSV</button>
            </div>

            <div className={styles.recentOrders}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Status</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Action</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Loading orders...</td></tr>
                        ) : orders.length > 0 ? (
                            orders.map((row) => (
                                <React.Fragment key={row.id}>
                                    <tr>
                                        <td><strong>{row.orderNumber ? `#${row.orderNumber}` : `#${row.id.slice(0, 8).toUpperCase()}`}</strong></td>
                                        <td>{row.customerName}</td>
                                        <td>
                                            <span
                                                className={styles.statusBadge}
                                                onClick={() => handleStatusChange(row.id, row.status)}
                                                style={{ 
                                                    cursor: 'pointer',
                                                    backgroundColor: 
                                                        row.status === 'Cancelled' ? '#fee2e2' : 
                                                        row.status === 'Return Requested' ? '#fef3c7' : 
                                                        row.status === 'Returned' ? '#dcfce7' : 
                                                        row.status === 'Refund Requested' ? '#f8fafc' : 
                                                        row.status === 'Replacement Requested' ? '#e0f2fe' : 
                                                        undefined,
                                                    color: 
                                                        row.status === 'Cancelled' ? '#991b1b' : 
                                                        row.status === 'Return Requested' ? '#92400e' : 
                                                        row.status === 'Returned' ? '#166534' : 
                                                        row.status === 'Refund Requested' ? '#475569' : 
                                                        row.status === 'Replacement Requested' ? '#0369a1' : 
                                                        undefined,
                                                    border: (row.status === 'Cancelled' || row.status === 'Return Requested' || row.status === 'Returned' || row.status === 'Refund Requested' || row.status === 'Replacement Requested') ? '1px solid currentColor' : undefined
                                                }}
                                                title="Click to advance status"
                                            >
                                                {row.status}
                                            </span>
                                        </td>
                                        <td>{row.amount}</td>
                                        <td>{formatOrderDate(row.date || (row as any).createdAt)}</td>
                                        <td>
                                            <select 
                                                className={styles.statusDropdown}
                                                value={row.status}
                                                onChange={(e) => updateOrderStatus(row.id, e.target.value)}
                                            >
                                                {orderStatuses.map(status => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => toggleRow(row.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                            >
                                                {expandedRows.has(row.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedRows.has(row.id) && (
                                        <tr key={`${row.id}-details`} style={{ backgroundColor: '#f8fafc' }}>
                                            <td colSpan={7} style={{ padding: '1rem' }}>
                                                <div className={styles.orderDetailsGrid}>
                                                    <div>
                                                        <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Order Items</h4>
                                                        {row.items && row.items.length > 0 ? (
                                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                                {row.items.map((item, idx) => {
                                                                    const renderItemName = (name: string, quantity: number, category?: string, products?: any[], baseWeight?: number) => {
                                                                        if (name.startsWith('Custom Mix (')) {
                                                                            const match = name.match(/Custom Mix \((.*)\)/);
                                                                            if (match && match[1]) {
                                                                                const ingredients = match[1].split(', ');
                                                                                return (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                        <span><strong>Custom Mix</strong> ({quantity}g)</span>
                                                                                        <ul style={{ listStyle: 'none', padding: 0, margin: '0.35rem 0 0 0.75rem', color: '#64748b', fontSize: '0.85rem' }}>
                                                                                            {ingredients.map((ing, i) => (
                                                                                                <li key={i} style={{ marginBottom: '0.15rem' }}>• {ing}</li>
                                                                                            ))}
                                                                                        </ul>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                        }

                                                                        if (category === 'Combos' || products) {
                                                                            const isCombo = category === 'Combos';
                                                                            return (
                                                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                    <span><strong>{name}</strong> {isCombo ? `(${quantity} Unit${quantity > 1 ? 's' : ''})` : `(${quantity}g)`}</span>
                                                                                    {products && (
                                                                                        <ul style={{ listStyle: 'none', padding: 0, margin: '0.35rem 0 0 0.75rem', color: '#64748b', fontSize: '0.85rem' }}>
                                                                                            {products.map((p: any, i: number) => (
                                                                                                <li key={i} style={{ marginBottom: '0.15rem' }}>• {p.name} ({p.grams}g)</li>
                                                                                            ))}
                                                                                        </ul>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        }

                                                                        const bw = baseWeight || 100;
                                                                        return <span>{name} ({quantity / bw} Units, {quantity}g)</span>;
                                                                    };

                                                                    return (
                                                                        <li key={idx} style={{ padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                            {renderItemName(item.name, item.quantity, (item as any).category, (item as any).products, item.baseWeight)}
                                                                            <span style={{ fontWeight: 500, marginTop: '0.1rem' }}>₹{((item.price * item.quantity) / (item.baseWeight || 100)).toFixed(2)}</span>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        ) : (
                                                            <p style={{ color: '#64748b' }}>No items recorded (legacy order).</p>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Payment Summary</h4>
                                                        <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                                                            {(() => {
                                                                const subtotal = row.items?.reduce((sum, item) => sum + (item.price * item.quantity) / (item.baseWeight || 100), 0) || 0;
                                                                const shippingCost = subtotal < 350 ? 50 : 0;
                                                                const promoDiscount = row.discount || 0;
                                                                const membershipDiscount = row.membershipDiscount || 0;
                                                                const netSubtotal = subtotal - promoDiscount - membershipDiscount;
                                                                const tax = netSubtotal * 0.05;
                                                                
                                                                return (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <span>Subtotal:</span>
                                                                            <span>₹{subtotal.toFixed(2)}</span>
                                                                        </div>
                                                                        {promoDiscount > 0 && (
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                                                                                <span>Promo Discount:</span>
                                                                                <span>-₹{promoDiscount.toFixed(2)}</span>
                                                                            </div>
                                                                        )}
                                                                        {membershipDiscount > 0 && (
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                                                                                <span>Membership Discount:</span>
                                                                                <span>-₹{membershipDiscount.toFixed(2)}</span>
                                                                            </div>
                                                                        )}
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <span>Shipping:</span>
                                                                            <span>₹{shippingCost.toFixed(2)}</span>
                                                                        </div>
                                                                        {(row as any).codPrice > 0 && (
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                                <span>COD Extra Charge:</span>
                                                                                <span>₹{((row as any).codPrice).toFixed(2)}</span>
                                                                            </div>
                                                                        )}
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <span>GST (5%):</span>
                                                                            <span>₹{tax.toFixed(2)}</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: '0.45rem', marginTop: '0.15rem' }}>
                                                                            <span>Net Total:</span>
                                                                            <span>{row.amount}</span>
                                                                        </div>
                                                                        {row.earnedPoints && (
                                                                            <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#fff1f2', borderRadius: '4px', textAlign: 'center', color: '#be123c', fontWeight: 600, fontSize: '0.8rem' }}>
                                                                                Coins Earned: {row.earnedPoints}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>

                                                        <h4 style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600 }}>Delivery Details</h4>
                                                        {row.shippingDetails ? (
                                                            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
                                                                {row.shippingDetails.address},<br />
                                                                {row.shippingDetails.city}, {row.shippingDetails.state} {row.shippingDetails.pincode}<br />
                                                                Mobile: {row.shippingDetails.mobile}
                                                            </p>
                                                        ) : (
                                                            <p style={{ color: '#64748b' }}>No shipping details recorded.</p>
                                                        )}
                                                        {row.method && (
                                                            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
                                                                <strong>Payment:</strong> {row.method.payment} <br />
                                                                <strong>Delivery:</strong> {row.method.delivery}
                                                            </p>
                                                        )}
                                                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            {row.shiprocketShipmentId ? (
                                                                <div style={{ padding: '0.75rem', backgroundColor: '#ecfdf5', borderRadius: '4px', border: '1px solid #10b981' }}>
                                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#065f46' }}>
                                                                        <strong>Shipped via Shiprocket</strong><br />
                                                                        Shipment ID: {row.shiprocketShipmentId}
                                                                    </p>
                                                                </div>
                                                            ) : row.velocityShipmentId ? (
                                                                <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '4px', border: '1px solid #3b82f6' }}>
                                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#1e3a8a' }}>
                                                                        <strong>Shipped via Velocity</strong><br />
                                                                        Shipment ID: {row.velocityShipmentId}<br/>
                                                                        AWB: {row.velocityAWB}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                    {storeSettings?.enableShiprocket !== false && (
                                                                        <button 
                                                                            className={styles.viewBtn}
                                                                            onClick={() => handleShiprocket(row.id)}
                                                                            disabled={shipping === row.id}
                                                                            style={{ 
                                                                                display: 'flex', 
                                                                                alignItems: 'center', 
                                                                                gap: '0.5rem',
                                                                                backgroundColor: shipping === row.id ? '#94a3b8' : '#ef4444',
                                                                                color: 'white',
                                                                                flex: 1,
                                                                                justifyContent: 'center'
                                                                            }}
                                                                        >
                                                                            <Truck size={16} />
                                                                            {shipping === row.id ? 'Shipping...' : 'Shiprocket'}
                                                                        </button>
                                                                    )}
                                                                    {storeSettings?.enableVelocity !== false && (
                                                                        <button 
                                                                            className={styles.viewBtn}
                                                                            onClick={() => handleVelocity(row.id)}
                                                                            disabled={shipping === row.id}
                                                                            style={{ 
                                                                                display: 'flex', 
                                                                                alignItems: 'center', 
                                                                                gap: '0.5rem',
                                                                                backgroundColor: shipping === row.id ? '#94a3b8' : '#3b82f6',
                                                                                color: 'white',
                                                                                flex: 1,
                                                                                justifyContent: 'center'
                                                                            }}
                                                                        >
                                                                            <Truck size={16} />
                                                                            {shipping === row.id ? 'Shipping...' : 'Velocity'}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No orders found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
