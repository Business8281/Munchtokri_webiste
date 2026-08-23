"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button/Button';
import { useProducts } from '@/hooks/useFirestore';
import { useCart } from '@/contexts/CartContext';
import { MIN_CUSTOM_MIX_GRAMS } from '@/lib/constants';
import styles from './build-mixture.module.css';

function roundToTwo(n: number): number {
    return Math.round(n * 100) / 100;
}

export default function BuildMixturePage() {
    return (
        <Suspense fallback={<div style={{ padding: '5rem', textAlign: 'center' }}>Loading Builder...</div>}>
            <BuildMixtureClient />
        </Suspense>
    );
}

function BuildMixtureClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { addToCart, cartItems, updateCartItem } = useCart();
    const { products: ingredients, loading: productsLoading } = useProducts();
    
    const [selections, setSelections] = useState<Record<string, number>>({});
    const [editId, setEditId] = useState<string | null>(null);
    const [initializing, setInitializing] = useState(false);

    // 1. Initialize Edit Mode
    useEffect(() => {
        const idToEdit = searchParams.get('edit');
        if (idToEdit && ingredients.length > 0) {
            const item = cartItems.find(i => i.id === idToEdit);
            if (item && item.products && item.category === 'Custom Mix') {
                setEditId(idToEdit);
                setInitializing(true);
                const newSelections: Record<string, number> = {};
                item.products.forEach(p => {
                    const ing = ingredients.find(i => i.name === p.name || i.id === (p as any).productId);
                    if (ing) newSelections[ing.id] = p.grams;
                });
                setSelections(newSelections);
                setInitializing(false);
            }
        }
    }, [searchParams, ingredients, cartItems]);

    const updateGrams = (ingredientId: string, increment: number) => {
        setSelections(prev => {
            const current = prev[ingredientId] ?? 0;
            const next = Math.max(0, current + increment);
            if (next === 0) {
                const copy = { ...prev };
                delete copy[ingredientId];
                return copy;
            }
            return { ...prev, [ingredientId]: next };
        });
    };

    const removeIngredient = (ingredientId: string) => {
        setSelections(prev => {
            const copy = { ...prev };
            delete copy[ingredientId];
            return copy;
        });
    };

    const totalGrams = Object.values(selections).reduce((s, g) => s + g, 0);

    // Use integer arithmetic to avoid floating-point drift
    const totalPaise = Object.entries(selections).reduce((sum, [id, grams]) => {
        const item = ingredients.find(i => i.id === id);
        if (!item) return sum;
        const pricePerGram = item.price / (item.baseWeight || 100);
        return sum + Math.round(pricePerGram * grams * 100);
    }, 0);
    const total = totalPaise / 100; // exact to 2dp

    const handleAddToCart = () => {
        if (totalGrams < MIN_CUSTOM_MIX_GRAMS) return;

        const ingredientSummary = Object.entries(selections)
            .map(([id, grams]) => {
                const item = ingredients.find(i => i.id === id);
                return item ? `${item.name}: ${grams}g` : null;
            })
            .filter(Boolean)
            .join(', ');

        const mixName = `Custom Mix (${ingredientSummary})`;

        const mixProducts = Object.entries(selections)
            .map(([id, grams]) => {
                const item = ingredients.find(i => i.id === id);
                if (!item) return null;
                return { 
                    productId: item.id,
                    name: item.name, 
                    grams, 
                    price: roundToTwo((item.price / (item.baseWeight || 100)) * grams) 
                };
            })
            .filter(Boolean) as { productId: string; name: string; grams: number; price: number }[];

        if (editId) {
            updateCartItem(editId, {
                id: editId,
                name: mixName,
                price: total,
                baseWeight: totalGrams,
                category: 'Custom Mix',
                imageURL: 'https://munch-tokri.web.app/logo.png',
                maxStock: 10000,
                products: mixProducts,
                quantity: totalGrams
            });
        } else {
            addToCart(
                {
                    id: `custom-mix-${Date.now()}`,
                    name: mixName,
                    price: total,
                    baseWeight: totalGrams,
                    category: 'Custom Mix',
                    imageURL: 'https://munch-tokri.web.app/logo.png',
                    maxStock: 10000,
                    products: mixProducts,
                },
                totalGrams
            );
        }

        router.push('/checkout'); // Redirect back to checkout after edit/add
    };

    const loading = productsLoading || initializing;

    return (
        <div className={styles.buildContainer}>
            <div className="container">
                <header className={styles.header}>
                    <h1>Build your Mix</h1>
                    <p>Handpick your favorite authentic Munch Tokri snacks to craft a blend that&apos;s uniquely yours.</p>
                </header>

                <div className={styles.mainLayout}>
                    <div className={styles.selectionArea}>
                        <div className={styles.selectionHeader}>
                            <h2>Select Ingredients</h2>
                            <div className={styles.progress}>
                                <span>
                                    {totalGrams >= MIN_CUSTOM_MIX_GRAMS
                                        ? `Minimum ${MIN_CUSTOM_MIX_GRAMS}g Reached!`
                                        : `Need ${MIN_CUSTOM_MIX_GRAMS - totalGrams}g more for checkout`}
                                </span>
                                <div className={styles.progressBar}>
                                    <div
                                        className={styles.progressFill}
                                        style={{
                                            width: `${Math.min((totalGrams / MIN_CUSTOM_MIX_GRAMS) * 100, 100)}%`,
                                            backgroundColor: totalGrams >= MIN_CUSTOM_MIX_GRAMS ? '#22c55e' : 'var(--primary)',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                Loading authentic snacks...
                            </div>
                        ) : (
                            <div className={styles.ingredientGrid}>
                                {ingredients.map((item) => (
                                    <div key={item.id} className={styles.ingredientCard}>
                                        <div className={styles.ingredientImage}>
                                            {item.imageURL || item.image ? (
                                                <Image
                                                    src={(item.imageURL || item.image) as string}
                                                    alt={item.name}
                                                    fill
                                                    sizes="(max-width: 480px) 50vw, 20vw"
                                                    style={{ objectFit: 'cover', borderRadius: '8px' }}
                                                />
                                            ) : (
                                                <Image
                                                    src="/logo.png"
                                                    alt="Fallback"
                                                    fill
                                                    style={{ objectFit: 'contain', padding: '10%' }}
                                                />
                                            )}
                                        </div>
                                        <h3 style={{ marginBottom: '4px' }}>{item.name}</h3>
                                        <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#666' }}>
                                            ₹{(item.price ?? 0).toFixed(2)} / {item.stockStr ?? '100g'}
                                        </p>
                                        <div className={styles.ingredientControls}>
                                            <button
                                                onClick={() => updateGrams(item.id, -50)}
                                                disabled={!selections[item.id]}
                                            >
                                                −
                                            </button>
                                            <span style={{ minWidth: '40px', textAlign: 'center' }}>
                                                {selections[item.id] ?? 0}g
                                            </span>
                                            <button onClick={() => updateGrams(item.id, 50)}>+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Summary Panel */}
                    <aside className={styles.summaryPanel}>
                        <h2>Your Mix</h2>
                        {Object.keys(selections).length === 0 ? (
                            <p className={styles.emptyMsg}>
                                Select ingredients to get started.
                            </p>
                        ) : (
                            <ul className={styles.summaryList}>
                                {Object.entries(selections).map(([id, grams]) => {
                                    const item = ingredients.find(i => i.id === id);
                                    if (!item) return null;
                                    const lineTotal = roundToTwo((item.price / (item.baseWeight || 100)) * grams);
                                    return (
                                        <li key={id}>
                                            <div>
                                                <span className={styles.itemName}>{item.name}</span>
                                                <span className={styles.itemDetail}>{grams}g selected</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className={styles.itemPrice}>₹{lineTotal.toFixed(2)}</span>
                                                <button
                                                    onClick={() => removeIngredient(id)}
                                                    className={styles.removeBtn}
                                                    title="Remove"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        <div className={styles.summaryTotal}>
                            <span>Total ({totalGrams}g)</span>
                            <span className={styles.totalAmount}>₹{total.toFixed(2)}</span>
                        </div>
                        
                        <div className={styles.addToCartBtn}>
                            <Button
                                onClick={handleAddToCart}
                                disabled={totalGrams < MIN_CUSTOM_MIX_GRAMS}
                                variant="primary"
                            >
                                {totalGrams < MIN_CUSTOM_MIX_GRAMS
                                    ? `Add ${MIN_CUSTOM_MIX_GRAMS - totalGrams}g more`
                                    : editId ? 'Update Mix in Cart' : 'Add Mix to Cart'}
                            </Button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
