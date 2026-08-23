"use client";

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, Trash2, Plus, Minus, ShoppingBag, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import Button from '../Button/Button';
import styles from './cart.module.css';

export default function CartDrawer() {
    const router = useRouter();
    const { isCartOpen, setIsCartOpen, cartItems, updateQuantity, removeFromCart, cartTotal, cartCount } = useCart();
    const drawerRef = useRef<HTMLDivElement>(null);

    const isCustomMixItem = (item: typeof cartItems[0]) => {
        const cat = item.category?.toLowerCase();
        return cat === 'custom mix' || item.name.startsWith('Custom Mix (');
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
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [isCartOpen, setIsCartOpen]);

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
                                                {item.name.startsWith('Custom Mix (') && (
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

                                        <div className={styles.itemActions}>
                                            {!isCustomMixItem(item) ? (
                                                <div className={styles.qtyControls}>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity - (item.category === 'Combos' ? 1 : 50))}
                                                        disabled={item.quantity <= (item.category === 'Combos' ? 1 : 50)}
                                                    ><Minus size={14} /></button>
                                                    <span style={{ minWidth: '40px', textAlign: 'center' }}>
                                                        {item.category === 'Combos' ? `${item.quantity} Unit${item.quantity > 1 ? 's' : ''}` : `${item.quantity}g`}
                                                    </span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity + (item.category === 'Combos' ? 1 : 50))}
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
                        <div className={styles.totals}>
                            <span>Subtotal</span>
                            <span>₹{cartTotal.toFixed(2)}</span>
                        </div>
                        <p className={styles.taxesInfo}>Taxes & shipping calculated at checkout</p>

                        <Link href="/checkout" onClick={() => setIsCartOpen(false)} style={{ textDecoration: 'none' }}>
                            <Button variant="primary" size="lg" className={styles.checkoutBtn}>
                                Checkout Now
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
