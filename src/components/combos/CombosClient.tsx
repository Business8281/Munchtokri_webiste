"use client";

import React, { useEffect, useState } from 'react';
import styles from '@/app/(public)/combos/combos.module.css';
import { Combo } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import ProductCard from '@/components/ui/Card/ProductCard';
import { Sparkles } from 'lucide-react';
import { sortComboVariantsLowToHigh } from '@/lib/constants';

interface CombosClientProps {
    combos: Combo[];
}

export default function CombosClient({ combos }: CombosClientProps) {
    const [comboList, setComboList] = useState<Combo[]>(combos);

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

    return (
        <main className={styles.combosContainer}>
            <div className="container">
                <div className={styles.header}>
                    <span className={styles.headerBadge}>
                        <Sparkles size={13} />
                        Special Value Bundles
                    </span>
                    <h1>Curated Snack Combos</h1>
                    <p>
                        Discover our specially bundled heritage snack packs. Premium traditional taste, handcrafted with care and bundled for extra savings.
                    </p>
                </div>

                <div className={styles.comboGrid}>
                    {comboList.map((combo) => {
                        const sortedVariants = sortComboVariantsLowToHigh(combo.variants);
                        const hasVariants = Boolean(sortedVariants && sortedVariants.length > 0);
                        const packCount = combo.packSize || combo.products?.length || 0;
                        const defaultVariant = hasVariants ? sortedVariants[0] : null;
                        const displayPrice = defaultVariant ? defaultVariant.price : combo.price;
                        const displayOriginalPrice = defaultVariant ? defaultVariant.originalPrice : combo.originalPrice;
                        const packLabel = defaultVariant ? defaultVariant.title : (combo.packLabel || `Pack of ${packCount}`);
                        const badgeText = hasVariants && sortedVariants.length > 1 
                            ? `${sortedVariants.length} Options Available` 
                            : packLabel;
                        const discountPct = displayOriginalPrice && displayOriginalPrice > displayPrice
                            ? Math.round(((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100)
                            : 0;

                        return (
                            <ProductCard
                                key={combo.id}
                                id={combo.id}
                                name={combo.name}
                                price={displayPrice}
                                originalPrice={displayOriginalPrice}
                                discount={discountPct}
                                category="Combos"
                                imageURL={combo.imageURL || (combo.imageURLs && combo.imageURLs[0]) || (combo.images && combo.images[0]) || combo.products?.[0]?.imageURL}
                                description={combo.description}
                                stock={packLabel}
                                badgeText={badgeText}
                                href={`/combos/${combo.id}`}
                                status={defaultVariant ? defaultVariant.status : combo.status}
                                products={combo.products}
                                variants={sortedVariants}
                            />
                        );
                    })}

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
