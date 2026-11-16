"use client";

export const dynamic = "force-dynamic";

import React, { useState } from 'react';
import { useCoupons, useProducts, useCombos } from '@/hooks/useFirestore';
import { Coupon } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { useAdmin } from '@/contexts/AdminContext';
import styles from '../admin.module.css';

const STATUS_COLORS: Record<string, string> = {
    active: '#dcfce7',
    expired: '#fee2e2',
    disabled: '#f1f5f9',
};

export default function CouponsPage() {
    const { user } = useAdmin();
    const { coupons, loading, addCoupon, updateCoupon, deleteCoupon } = useCoupons(true);
    const { products } = useProducts();
    const { combos } = useCombos();
    const [productSearch, setProductSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        code: '',
        discountType: 'percentage' as 'percentage' | 'fixed',
        discountValue: '',
        minOrderValue: '',
        maxUses: '',
        expiryDate: '',
        neverExpires: false,
        isInfluencer: false,
        influencerName: '',
        applicableProductIds: [] as string[],
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const resetForm = () => {
        setForm({ code: '', discountType: 'percentage', discountValue: '', minOrderValue: '', maxUses: '', expiryDate: '', neverExpires: false, isInfluencer: false, influencerName: '', applicableProductIds: [] });
        setProductSearch('');
        setEditingId(null);
        setShowForm(false);
        setError('');
    };

    const handleEdit = (coupon: Coupon) => {
        setForm({
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: String(coupon.discountValue),
            minOrderValue: String(coupon.minOrderValue),
            maxUses: String(coupon.maxUses),
            expiryDate: coupon.expiryDate ? coupon.expiryDate.toDate().toISOString().split('T')[0] : '',
            neverExpires: !coupon.expiryDate,
            isInfluencer: !!coupon.isInfluencer,
            influencerName: coupon.influencerName || '',
            applicableProductIds: coupon.applicableProductIds || [],
        });
        setEditingId(coupon.id);
        setShowForm(true);
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async () => {
        setError('');
        const newCode = form.code.trim().toUpperCase();
        if (!newCode) { setError('Coupon code is required'); return; }
        if (!/^[A-Z0-9_-]+$/.test(newCode)) { setError('Code can only contain letters, numbers, - and _'); return; }
        if (form.isInfluencer) {
            if (form.applicableProductIds.length === 0) {
                setError('Select at least one product for the influencer coupon'); return;
            }
        } else if (!form.discountValue || Number(form.discountValue) <= 0) {
            setError('Discount value must be positive'); return;
        }

        setSaving(true);
        try {
            const expiryDate = (form.neverExpires || !form.expiryDate)
                ? null
                : Timestamp.fromDate(new Date(form.expiryDate));
            const couponData = form.isInfluencer
                ? {
                    // Influencer: always 100% off selected products, free shipping, single use
                    code: newCode,
                    discountType: 'percentage' as const,
                    discountValue: 100,
                    minOrderValue: 0,
                    maxUses: 1,
                    expiryDate,
                    isInfluencer: true,
                    influencerName: form.influencerName.trim(),
                    applicableProductIds: form.applicableProductIds,
                    freeShipping: true,
                }
                : {
                    code: newCode,
                    discountType: form.discountType,
                    discountValue: Number(form.discountValue),
                    minOrderValue: Number(form.minOrderValue) || 0,
                    maxUses: Number(form.maxUses) || 0,
                    expiryDate,
                    isInfluencer: false,
                };

            if (editingId) {
                if (editingId !== newCode) {
                    // Code changed: Check for existence of new code
                    if (coupons.some(c => c.code === newCode)) {
                        setError(`Coupon with code ${newCode} already exists.`);
                        setSaving(false);
                        return;
                    }

                    const oldCoupon = coupons.find(c => c.id === editingId);
                    if (oldCoupon) {
                        // Migrate existing data (status, usedCount, createdAt)
                        await addCoupon({
                            ...couponData,
                            status: oldCoupon.status,
                            usedCount: oldCoupon.usedCount,
                            createdAt: oldCoupon.createdAt,
                        });
                        await deleteCoupon(editingId);
                    }
                } else {
                    // Simple update
                    await updateCoupon(editingId, couponData);
                }
            } else {
                // New coupon
                if (coupons.some(c => c.code === newCode)) {
                    setError(`Coupon with code ${newCode} already exists.`);
                    setSaving(false);
                    return;
                }
                await addCoupon({
                    ...couponData,
                    status: 'active',
                });
            }
            resetForm();
        } catch (err) {
            setError('Failed to save coupon. Please try again.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (coupon: Coupon) => {
        const next = coupon.status === 'active' ? 'disabled' : 'active';
        await updateCoupon(coupon.id, { status: next });
    };

    const formatExpiry = (ts: Coupon['expiryDate']) => {
        if (!ts) return 'No expiry';
        const d = ts.toDate();
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div>
            <div className={styles.sectionHeader}>
                <h2>Coupon Management</h2>
                <button className={styles.viewBtn} onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>
                    {showForm ? 'Cancel' : '+ Create Coupon'}
                </button>
            </div>

            {/* Create/Edit Coupon Form */}
            {showForm && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ marginTop: 0 }}>{editingId ? `Edit Coupon: ${form.code}` : 'New Coupon'}</h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', background: form.isInfluencer ? '#fdf4ff' : 'white', border: `1px solid ${form.isInfluencer ? '#e879f9' : '#e2e8f0'}`, borderRadius: '0.5rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={form.isInfluencer}
                            onChange={e => setForm(f => ({ ...f, isInfluencer: e.target.checked }))}
                        />
                        <span>
                            <strong>Influencer coupon</strong>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b' }}>
                                100% off on the products you select + free shipping. Works once; the order costs ₹0.
                            </span>
                        </span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Code *</label>
                            <input
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', textTransform: 'uppercase', backgroundColor: 'white' }}
                                value={form.code}
                                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                                placeholder="SAVE20"
                            />
                        </div>
                        {form.isInfluencer ? (
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Influencer Name</label>
                            <input
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', backgroundColor: 'white' }}
                                value={form.influencerName}
                                onChange={e => setForm(f => ({ ...f, influencerName: e.target.value }))}
                                placeholder="@foodie_priya"
                            />
                        </div>
                        ) : (<>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Type *</label>
                            <select
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
                                value={form.discountType}
                                onChange={e => setForm(f => ({ ...f, discountType: e.target.value as 'percentage' | 'fixed' }))}
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed Amount (₹)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                                Discount {form.discountType === 'percentage' ? '(%)' : '(₹)'} *
                            </label>
                            <input
                                type="number"
                                min="1"
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
                                value={form.discountValue}
                                onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                                placeholder={form.discountType === 'percentage' ? '20' : '50'}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Min Order (₹)</label>
                            <input
                                type="number"
                                min="0"
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
                                value={form.minOrderValue}
                                onChange={e => setForm(f => ({ ...f, minOrderValue: e.target.value }))}
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Max Uses (0 = unlimited)</label>
                            <input
                                type="number"
                                min="0"
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
                                value={form.maxUses}
                                onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                                placeholder="0"
                            />
                        </div>
                        </>)}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Expiry Date</label>
                                <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={form.neverExpires}
                                        onChange={e => setForm(f => ({ ...f, neverExpires: e.target.checked }))}
                                    />
                                    Never Expires
                                </label>
                            </div>
                            <input
                                type="date"
                                disabled={form.neverExpires}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '0.375rem',
                                    opacity: form.neverExpires ? 0.5 : 1,
                                    cursor: form.neverExpires ? 'not-allowed' : 'text'
                                }}
                                value={form.expiryDate}
                                onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                            />
                        </div>
                    </div>
                    {form.isInfluencer && (() => {
                        const q = productSearch.trim().toLowerCase();
                        const options = [
                            ...products.map(p => ({ id: p.id, name: p.name, kind: 'Product', inactive: p.isActive === false })),
                            ...combos.map(c => ({ id: c.id, name: c.name, kind: 'Combo', inactive: false })),
                        ].filter(o => !q || o.name.toLowerCase().includes(q));
                        const toggle = (id: string) => setForm(f => ({
                            ...f,
                            applicableProductIds: f.applicableProductIds.includes(id)
                                ? f.applicableProductIds.filter(x => x !== id)
                                : [...f.applicableProductIds, id],
                        }));
                        return (
                            <div style={{ marginTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                        Free Products * ({form.applicableProductIds.length} selected)
                                    </label>
                                    <input
                                        style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.85rem', backgroundColor: 'white' }}
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                        placeholder="Search products..."
                                    />
                                </div>
                                <div style={{ maxHeight: '240px', overflowY: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.375rem', padding: '0.25rem' }}>
                                    {options.length === 0 && <p style={{ padding: '0.75rem', color: '#94a3b8', margin: 0 }}>No products found.</p>}
                                    {options.map(o => (
                                        <label key={`${o.kind}-${o.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', cursor: 'pointer', fontSize: '0.875rem', borderRadius: '0.25rem', background: form.applicableProductIds.includes(o.id) ? '#fdf4ff' : 'transparent' }}>
                                            <input type="checkbox" checked={form.applicableProductIds.includes(o.id)} onChange={() => toggle(o.id)} />
                                            <span style={{ flex: 1 }}>{o.name}{o.inactive ? ' (inactive)' : ''}</span>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{o.kind}</span>
                                        </label>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.5rem 0 0' }}>
                                    The customer&apos;s cart must contain only these items. Discount: 100% · Shipping: Free · Uses: 1
                                </p>
                            </div>
                        );
                    })()}
                    {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</p>}
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <button
                            className={styles.viewBtn}
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Save Coupon'}
                        </button>
                        {editingId && (
                            <button
                                className={styles.viewBtn}
                                style={{ backgroundColor: 'transparent', color: '#64748b', border: '1px solid #cbd5e1' }}
                                onClick={resetForm}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Coupons Table */}
            {loading ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading coupons...</p>
            ) : coupons.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    <p style={{ fontSize: '1.1rem' }}>No coupons yet.</p>
                    <p>Click &quot;+ Create Coupon&quot; to add your first one.</p>
                </div>
            ) : (
                <div className={styles.recentOrders}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Discount</th>
                                <th>Min Order</th>
                                <th>Usage</th>
                                <th>Status</th>
                                <th>Expiry</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map((c) => (
                                <tr key={c.id}>
                                    <td>
                                        <strong>{c.code}</strong>
                                        {c.isInfluencer && (
                                            <span style={{ display: 'block', fontSize: '0.7rem', color: '#a21caf', fontWeight: 600 }}>
                                                Influencer{c.influencerName ? ` · ${c.influencerName}` : ''}
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {c.isInfluencer
                                            ? <>100% OFF + Free Shipping<span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>{c.applicableProductIds?.length || 0} product(s)</span></>
                                            : c.discountType === 'percentage'
                                                ? `${c.discountValue}% OFF`
                                                : `₹${c.discountValue} OFF`}
                                    </td>
                                    <td>{c.minOrderValue > 0 ? `₹${c.minOrderValue}` : '—'}</td>
                                    <td>
                                        {c.usedCount}/{c.maxUses === 0 ? '∞' : c.maxUses}
                                        {c.redeemedOrderNumber && (
                                            <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>
                                                {c.redeemedOrderNumber}{c.redeemedBy ? ` · ${c.redeemedBy}` : ''}
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <span
                                            className={styles.statusBadge}
                                            style={{ background: STATUS_COLORS[c.status] ?? '#f1f5f9', textTransform: 'capitalize' }}
                                        >
                                            {c.status}
                                        </span>
                                    </td>
                                    <td>{formatExpiry(c.expiryDate)}</td>
                                    <td>
                                        <button
                                            onClick={() => handleEdit(c)}
                                            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem', marginRight: '0.5rem' }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => toggleStatus(c)}
                                            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem', marginRight: '0.5rem' }}
                                        >
                                            {c.status === 'active' ? 'Disable' : 'Enable'}
                                        </button>
                                        {user && user.role.toLowerCase() !== 'employee' && (
                                            <button
                                                onClick={() => window.confirm(`Delete coupon ${c.code}?`) && deleteCoupon(c.id)}
                                                style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem', color: '#ef4444' }}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
