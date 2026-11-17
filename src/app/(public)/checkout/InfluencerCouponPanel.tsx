"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Loader2, Truck, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useNotification } from '@/contexts/NotificationContext';

export interface AppliedInfluencerCoupon {
    code: string;
    influencerName: string;
    subtotal: number;
}

const toPayloadItems = (items: CartItem[]) =>
    items.map(it => ({
        id: it.id,
        productId: it.productId || it.id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        baseWeight: it.baseWeight,
        category: it.category,
        imageURL: it.imageURL,
        variant: it.variant,
        grams: it.grams,
        products: it.products,
    }));

const callInfluencerFn = async (data: Record<string, unknown>) => {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('@/lib/firebase');
    const fn = httpsCallable(functions, 'placeInfluencerOrder');
    return (await fn(data)).data as any;
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
    backgroundColor: 'white',
};

interface Props {
    applied: AppliedInfluencerCoupon | null;
    onApplied: (c: AppliedInfluencerCoupon | null) => void;
    initialCode?: string;
}

/**
 * Influencer code entry + ₹0 order form. Influencer orders never go through
 * Razorpay; the Cloud Function validates the code and creates the order.
 */
export default function InfluencerCouponPanel({ applied, onApplied, initialCode }: Props) {
    const router = useRouter();
    const { cartItems, clearCart } = useCart();
    const { showNotification } = useNotification();
    const [code, setCode] = useState(initialCode || '');
    const [checking, setChecking] = useState(false);
    const [placing, setPlacing] = useState(false);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(!!initialCode);
    const [form, setForm] = useState({
        fullName: '', mobile: '', email: '', address: '', city: '', state: '', pincode: '',
    });

    const lastCartRef = useRef(cartItems);

    const apply = async (raw: string, silent = false) => {
        const c = raw.trim().toUpperCase();
        if (!c) return;
        setChecking(true);
        setError('');
        try {
            const res = await callInfluencerFn({ code: c, items: toPayloadItems(cartItems), dryRun: true });
            onApplied({ code: c, influencerName: res.influencerName || '', subtotal: Number(res.subtotal) || 0 });
            if (!silent) showNotification(`Code ${c} applied — your order is free!`, 'success', { title: 'Free Order Unlocked' });
        } catch (err: any) {
            setError(err?.message || 'Invalid code');
            onApplied(null);
        } finally {
            setChecking(false);
        }
    };

    // Auto-apply a code passed via ?code=
    useEffect(() => {
        if (initialCode && cartItems.length > 0 && !applied) apply(initialCode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCode]);

    // Re-validate if the cart changes after the code is applied
    useEffect(() => {
        if (lastCartRef.current === cartItems) return;
        lastCartRef.current = cartItems;
        if (!applied || placing || cartItems.length === 0) return;
        const t = setTimeout(() => apply(applied.code, true), 400);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cartItems]);

    const placeOrder = async () => {
        if (!applied || placing) return;
        setError('');
        if (!form.fullName.trim()) return setError('Enter your full name');
        if (form.mobile.replace(/\D/g, '').length < 10) return setError('Enter a valid 10-digit mobile number');
        if (!form.address.trim() || !form.city.trim() || !form.state.trim()) return setError('Enter your full delivery address');
        if (!/^\d{6}$/.test(form.pincode.trim())) return setError('Enter a valid 6-digit pincode');

        setPlacing(true);
        try {
            const res = await callInfluencerFn({
                code: applied.code,
                items: toPayloadItems(cartItems),
                shippingDetails: form,
                userId: auth.currentUser?.uid || undefined,
            });
            if (!res?.orderNumber) throw new Error('Could not place the order');
            clearCart();
            router.push(`/checkout/success?orderNumber=${res.orderNumber}`);
        } catch (err: any) {
            setError(err?.message || 'Could not place the order. Please try again.');
            setPlacing(false);
        }
    };

    const field = (key: keyof typeof form, placeholder: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
        <input
            style={inputStyle}
            placeholder={placeholder}
            value={form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            {...extra}
        />
    );

    if (applied) {
        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.75rem 1rem', background: '#fdf4ff', border: '1px solid #e879f9', borderRadius: '10px', marginBottom: '1rem' }}>
                    <div>
                        <div style={{ fontWeight: 700, color: '#86198f', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Gift size={16} /> {applied.code} applied
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#a21caf' }}>100% off · Free shipping · Pay ₹0</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => { onApplied(null); setError(''); }}
                        disabled={placing}
                        aria-label="Remove code"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86198f', padding: '0.25rem' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#0f172a' }}>Delivery Details</h3>
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                    {field('fullName', 'Full name *', { autoComplete: 'name' })}
                    {field('mobile', 'Mobile number *', { inputMode: 'numeric', maxLength: 13, autoComplete: 'tel' })}
                    {field('email', 'Email (for order confirmation)', { type: 'email', autoComplete: 'email' })}
                    {field('address', 'House no., street, area *', { autoComplete: 'street-address' })}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                        {field('city', 'City *', { autoComplete: 'address-level2' })}
                        {field('state', 'State *', { autoComplete: 'address-level1' })}
                    </div>
                    {field('pincode', 'Pincode *', { inputMode: 'numeric', maxLength: 6, autoComplete: 'postal-code' })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.9rem 0', fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>
                    <Truck size={16} /> Free Shipping on this order
                </div>

                {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{error}</p>}

                <button
                    type="button"
                    onClick={placeOrder}
                    disabled={placing}
                    style={{ width: '100%', padding: '0.9rem 1rem', background: '#a21caf', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem', cursor: placing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                    {placing ? <><Loader2 size={18} className="animate-spin" /> Placing order...</> : 'Place Free Order (₹0)'}
                </button>
            </div>
        );
    }

    return (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            {!open ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    style={{ background: 'none', border: 'none', color: '#a21caf', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0, margin: '0 auto' }}
                >
                    <Gift size={16} /> Have an influencer code?
                </button>
            ) : (
                <>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            style={{ ...inputStyle, textTransform: 'uppercase' }}
                            placeholder="Influencer code"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') apply(code); }}
                        />
                        <button
                            type="button"
                            onClick={() => apply(code)}
                            disabled={checking || !code.trim()}
                            style={{ padding: '0 1rem', background: '#a21caf', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: checking ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                            {checking ? <Loader2 size={16} className="animate-spin" /> : 'Apply'}
                        </button>
                    </div>
                    {error && <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>{error}</p>}
                </>
            )}
        </div>
    );
}
