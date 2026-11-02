"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, Trash2, Plus, Minus, ShoppingBag, Pencil, Truck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCart } from '@/contexts/CartContext';
import Button from '../Button/Button';
import RazorpayMagicCheckoutWidget from '../RazorpayMagicCheckoutWidget/RazorpayMagicCheckoutWidget';
import { useMagicCheckout } from '@/hooks/useMagicCheckout';
import { tracker } from '@/lib/analytics/tracker';
import styles from './cart.module.css';

export default function CartDrawer() {
    const router = useRouter();
    const { isCartOpen, setIsCartOpen, cartItems, updateQuantity, removeFromCart, cartTotal, cartCount } = useCart();
    const { openMagicCheckout, isLoading: isMagicCheckoutLoading } = useMagicCheckout();
    const drawerRef = useRef<HTMLDivElement>(null);

    const [storeSettings, setStoreSettings] = useState({
        shippingRate: 80,
        freeShippingThreshold: 450,
        codPrice: 50,
        enableCOD: true,
    });

    useEffect(() => {
        const fetchStoreSettings = async () => {
            try {
                const snap = await getDoc(doc(db, 'settings', 'store'));
                if (snap.exists()) {
                    const data = snap.data();
                    setStoreSettings({
                        shippingRate: data.shippingRate !== undefined ? Number(data.shippingRate) : 80,
                        freeShippingThreshold: data.freeShippingThreshold !== undefined ? Number(data.freeShippingThreshold) : 450,
                        codPrice: data.codPrice !== undefined ? Number(data.codPrice) : 50,
                        enableCOD: data.enableCOD !== false,
                    });
                }
            } catch (err) {
                // Keep default business rules
            }
        };
        fetchStoreSettings();
    }, []);

    const isCustomMixItem = (item: typeof cartItems[0]) => {
        const cat = item.category?.toLowerCase();
        return cat === 'custom mix' || item.name.startsWith('Custom Mix') || (item as any).isCustomMix || item.id?.startsWith('custom-mix');
    };

    // Close on click outside and lock scroll
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isCartOpen && drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
                setIsCartOpen(false);
            }
        };

        if (isCartOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.body.style.overflow = '';
        };
    }, [isCartOpen, setIsCartOpen]);

    useEffect(() => {
        if (isCartOpen) {
            tracker.track('cart_view', {
                itemCount: cartItems.length,
                cartTotal
            });
        }
    }, [isCartOpen]);

    if (!isCartOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.drawer} ref={drawerRef}>
                <div className={styles.header}>
                    <h2>Your Cart ({cartCount})</h2>
                    <button className={styles.closeBtn} onClick={() => setIsCartOpen(false)}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.drawerBody}>
                    <div className={styles.itemsContainer}>
                    {cartItems.length === 0 ? (
                        <div className={styles.emptyCart}>
                            <ShoppingBag size={48} className={styles.emptyIcon} />
                            <h3>Your cart is empty</h3>
                            <p>Looks like you haven&apos;t added anything yet.</p>
                            <div style={{ marginTop: '1rem' }}>
                                <Button variant="primary" onClick={() => setIsCartOpen(false)}>
                                    Continue Shopping
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.itemList}>
                            {cartItems.map((item) => (
                                <div key={item.id} className={styles.cartItem}>
                                    <div className={styles.itemImage}>
                                        <Image
                                            src={item.imageURL || '/logo.png'}
                                            alt={item.name}
                                            width={80}
                                            height={80}
                                            style={{ objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div className={styles.itemInfo}>
                                        <div className={styles.itemRef}>
                                            {item.name.startsWith('Custom Mix (') ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '1rem' }}>
                                                    <h4>Custom Mix</h4>
                                                    <ul style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0 1rem', padding: 0, lineHeight: 1.4 }}>
                                                        {item.name.substring(12, item.name.length - 1).split(', ').map((ing, idx) => {
                                                            const parts = ing.split(':');
                                                            const ingName = parts[0];
                                                            const ingGrams = parts.length > 1 ? parts[1] : '';
                                                            return (
                                                                <li key={idx} style={{ padding: 0, margin: '0 0 2px 0' }}>
                                                                    <strong style={{ color: '#334155' }}>{ingName}</strong> {ingGrams ? `- ${ingGrams}` : ''}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            ) : item.category === 'Combos' && (item as any).products ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '1rem' }}>
                                                    <h4>{item.name}</h4>
                                                    <ul style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0 1rem', padding: 0, lineHeight: 1.4 }}>
                                                        {(item as any).products.map((p: any, idx: number) => (
                                                            <li key={idx} style={{ padding: 0, margin: '0 0 2px 0' }}>
                                                                • {p.name} ({p.grams}g)
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : (
                                                <h4 style={{ flex: 1, marginRight: '1rem' }}>{item.name}</h4>
                                            )}
                                            
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                {isCustomMixItem(item) && (
                                                    <button 
                                                        onClick={() => { setIsCartOpen(false); router.push(`/build-mixture?edit=${item.id}`); }}
                                                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0.25rem' }}
                                                        title="Edit Mix"
                                                    >
                                                        <Pencil size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    className={styles.removeBtn}
                                                    onClick={() => removeFromCart(item.id)}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className={styles.category}>{item.category}</p>

                                        {item.products && item.products.length > 0 && (
                                            <div style={{ margin: '0.4rem 0 0.5rem', padding: '0.4rem 0.6rem', background: '#f8fafc', borderLeft: '3px solid #0d9488', borderRadius: '4px' }}>
                                                <p style={{ margin: '0 0 0.25rem', fontSize: '0.72rem', fontWeight: 700, color: '#0f766e' }}>
                                                    {isCustomMixItem(item) ? 'Ingredients:' : `Pack of ${item.products.length} includes:`}
                                                </p>
                                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.72rem', color: '#334155', lineHeight: 1.4 }}>
                                                    {item.products.map((p: any, i: number) => (
                                                        <li key={i} style={{ marginBottom: '0.15rem' }}>
                                                            <span style={{ color: '#0d9488', fontWeight: 'bold' }}>• </span>
                                                            <span style={{ fontWeight: 600 }}>{p.name}</span> <span style={{ color: '#64748b' }}>({p.grams || 0}g)</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className={styles.itemActions}>
                                            {!isCustomMixItem(item) ? (
                                                <div className={styles.qtyControls}>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity - (item.category === 'Combos' ? 1 : (item.baseWeight || 100)))}
                                                        disabled={item.quantity <= (item.category === 'Combos' ? 1 : (item.baseWeight || 100))}
                                                    ><Minus size={14} /></button>
                                                    <span style={{ minWidth: '40px', textAlign: 'center' }}>
                                                        {item.category === 'Combos' 
                                                            ? (() => {
                                                                const itemGrams = (item as any).grams || (item as any).variantGrams || (item.products?.reduce((s: number, p: any) => s + (p.grams || 0), 0) || 0);
                                                                return `${item.quantity} Pack${item.quantity > 1 ? 's' : ''}${itemGrams > 0 ? ` (${itemGrams * item.quantity}g)` : ''}`;
                                                            })()
                                                            : `${item.quantity / (item.baseWeight || 100)} (${item.quantity}g)`}
                                                    </span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity + (item.category === 'Combos' ? 1 : (item.baseWeight || 100)))}
                                                        disabled={item.quantity >= (item.maxStock || (item.category === 'Combos' ? 50 : 20000))}
                                                    ><Plus size={14} /></button>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '0.9rem', color: '#444', fontWeight: 700 }}>
                                                    {item.quantity}g
                                                </div>
                                            )}
                                            <span className={styles.itemPrice}>₹{((item.price / (item.baseWeight || 100)) * item.quantity).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {cartItems.length > 0 && (
                    <div className={styles.footer}>
                        {(() => {
                            const isFreeShipping = cartTotal >= storeSettings.freeShippingThreshold;
                            const shippingFee = isFreeShipping ? 0 : storeSettings.shippingRate;
                            const onlineTotal = cartTotal + shippingFee;

                            return (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                        <span>Subtotal</span>
                                        <span>₹{cartTotal.toFixed(2)}</span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', color: '#64748b', marginBottom: '0.35rem' }}>
                                        <span>Delivery Fee</span>
                                        <span style={{ color: isFreeShipping ? '#16a34a' : '#0f172a', fontWeight: isFreeShipping ? 700 : 600 }}>
                                            {isFreeShipping ? 'FREE' : `+ ₹${shippingFee.toFixed(2)}`}
                                        </span>
                                    </div>

                                    <div className={styles.totals} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.4rem', marginTop: '0.2rem', marginBottom: '0.35rem' }}>
                                        <span>Total Amount</span>
                                        <span>₹{onlineTotal.toFixed(2)}</span>
                                    </div>

                                    <div style={{
                                        margin: '0.35rem 0 0.6rem 0',
                                        padding: '0.45rem 0.65rem',
                                        backgroundColor: isFreeShipping ? '#f0fdf4' : '#f8fafc',
                                        border: `1px solid ${isFreeShipping ? '#86efac' : '#e2e8f0'}`,
                                        borderRadius: '6px',
                                        fontSize: '0.78rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        color: isFreeShipping ? '#166534' : '#475569',
                                    }}>
                                        <span>🚚 {isFreeShipping ? 'FREE Delivery' : `Delivery: ₹${storeSettings.shippingRate}`}</span>
                                        <span style={{ fontWeight: 600 }}>
                                            {isFreeShipping
                                                ? `Orders above ₹${storeSettings.freeShippingThreshold}`
                                                : `Add ₹${(storeSettings.freeShippingThreshold - cartTotal).toFixed(2)} for FREE`}
                                        </span>
                                    </div>

                                    <RazorpayMagicCheckoutWidget
                                        onBuyNow={() => {
                                            setIsCartOpen(false);
                                            openMagicCheckout();
                                        }}
                                        buttonText={`Pay Online (₹${onlineTotal.toFixed(2)})`}
                                        loading={isMagicCheckoutLoading}
                                        showProtectionBar={false}
                                    />
                                </>
                            );
                        })()}

                        {/* Transparent COD Breakdown & Action */}
                        {(() => {
                            const isFreeShipping = cartTotal >= storeSettings.freeShippingThreshold;
                            const shippingFee = isFreeShipping ? 0 : storeSettings.shippingRate;
                            const codExtra = storeSettings.enableCOD ? storeSettings.codPrice : 0;
                            const totalCodAmount = cartTotal + shippingFee + codExtra;
                            const codAdvance = Math.max(1, Math.round(totalCodAmount * 0.20 * 100) / 100);
                            const codBalance = Math.max(0, Math.round((totalCodAmount - codAdvance) * 100) / 100);

                            return (
                                <>
                                    <div style={{
                                        margin: '0.65rem 0 0.35rem 0',
                                        padding: '0.55rem 0.75rem',
                                        backgroundColor: '#fff7ed',
                                        border: '1px dashed #fb923c',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        color: '#9a3412',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '0.25rem' }}>
                                            <span>📦 Cash on Delivery Breakdown</span>
                                            <span>Total: ₹{totalCodAmount.toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.75rem', marginBottom: '0.15rem' }}>
                                            <span>• Items Subtotal:</span>
                                            <span>₹{cartTotal.toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.75rem', marginBottom: '0.15rem' }}>
                                            <span>• Delivery Fee:</span>
                                            <span style={{ color: isFreeShipping ? '#16a34a' : '#64748b', fontWeight: isFreeShipping ? 700 : 500 }}>
                                                {isFreeShipping ? 'FREE (above ₹' + storeSettings.freeShippingThreshold + ')' : `₹${shippingFee.toFixed(2)}`}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                            <span>• COD Extra Charge:</span>
                                            <span>₹{codExtra.toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ea580c', fontWeight: 700, paddingTop: '0.25rem', borderTop: '1px dashed #fdba74' }}>
                                            <span>• 20% Advance Online:</span>
                                            <span>₹{codAdvance.toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7c2d12', fontWeight: 700, marginTop: '0.15rem' }}>
                                            <span>• 80% Cash on Delivery:</span>
                                            <span>₹{codBalance.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {storeSettings.enableCOD && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCartOpen(false);
                                                openMagicCheckout({ isCod: true });
                                            }}
                                            disabled={isMagicCheckoutLoading}
                                            style={{
                                                width: '100%',
                                                marginTop: '0.25rem',
                                                padding: '0.75rem 1rem',
                                                backgroundColor: '#ffffff',
                                                border: '2px solid #ef4444',
                                                borderRadius: '8px',
                                                color: '#ef4444',
                                                fontWeight: 700,
                                                fontSize: '0.88rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                cursor: isMagicCheckoutLoading ? 'not-allowed' : 'pointer',
                                                opacity: isMagicCheckoutLoading ? 0.7 : 1,
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            <Truck size={18} />
                                            Cash on Delivery (Pay ₹{codAdvance.toFixed(2)} Advance)
                                        </button>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}
