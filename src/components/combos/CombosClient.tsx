"use client";

import React, { useEffect, useState } from 'react';
import styles from '@/app/(public)/combos/combos.module.css';
import { useCart } from '@/contexts/CartContext';
import { toast, Toaster } from 'react-hot-toast';
import { Combo } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

interface CombosClientProps {
    combos: Combo[];
}

export default function CombosClient({ combos }: CombosClientProps) {
    const [comboList, setComboList] = useState<Combo[]>(combos);
    const { addToCart } = useCart();

    useEffect(() => {
        const q = query(collection(db, "combos"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const updatedCombos = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt ? {
                        seconds: data.createdAt.seconds,
                        nanoseconds: data.createdAt.nanoseconds
                    } : null,
                } as unknown as Combo;
            });
            setComboList(updatedCombos);
        }, (error) => {
            console.error("Error listening to combos:", error);
        });

        return () => unsubscribe();
    }, []);

    const handleAddToCart = (combo: Combo) => {
        addToCart(
            {
                id: combo.id,
                name: combo.name,
                price: combo.price,
                baseWeight: 1,
                category: 'Combos',
                imageURL: combo.imageURL ?? '',
                maxStock: combo.status === 'In Stock' ? 99 : 0,
                products: combo.products,
            },
            1
        );
        toast.success(`${combo.name} added to cart!`, {
            icon: '🎁',
            style: { borderRadius: '10px', background: '#333', color: '#fff' },
        });
    };

    return (
        <main className={styles.combosContainer}>
            <Toaster position="bottom-center" />
            <div className="container">
                <div className={styles.header}>
                    <h1>Combo Bundles</h1>
                    <p>
                        Curated selections of our finest heritage snacks, bundled together
                        for more joy and better value.
                    </p>
                </div>

                <div className={styles.comboGrid}>
                    {comboList.map((combo) => (
                        <div key={combo.id} className={styles.comboCard}>
                            <div className={styles.imageWrapper}>
                                <img
                                    src={combo.imageURL || '/logo.png'}
                                    alt={combo.name}
                                    className={styles.image}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/logo.png';
                                    }}
                                />
                                {combo.price < combo.originalPrice && (
                                    <div className={styles.badge}>
                                        SAVE ₹{combo.originalPrice - combo.price}
                                    </div>
                                )}
                            </div>

                            <div className={styles.content}>
                                <h2 className={styles.name}>{combo.name}</h2>
                                <p className={styles.desc}>{combo.description}</p>

                                {combo.products && combo.products.length > 0 && (
                                    <div className={styles.productSection}>
                                        <h4>Includes:</h4>
                                        <ul className={styles.productList}>
                                            {combo.products.map((p, i) => (
                                                <li key={i}>
                                                    {p.name} — {p.grams}g
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className={styles.priceRow}>
                                    <span className={styles.price}>₹{combo.price.toLocaleString('en-IN')}</span>
                                    {combo.price < combo.originalPrice && (
                                        <span className={styles.originalPrice}>
                                            ₹{combo.originalPrice.toLocaleString('en-IN')}
                                        </span>
                                    )}
                                </div>

                                <button
                                    className={styles.addBtn}
                                    onClick={() => handleAddToCart(combo)}
                                    disabled={combo.status === 'Out of Stock'}
                                >
                                    {combo.status === 'Out of Stock' ? 'Out of Stock' : 'Add to Cart'}
                                </button>
                            </div>
                        </div>
                    ))}

                    {comboList.length === 0 && (
                        <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                            No combo bundles available at the moment. Check back soon!
                        </p>
                    )}
                </div>
            </div>
        </main>
    );
}
