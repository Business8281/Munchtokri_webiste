"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import ProductCard from '@/components/ui/Card/ProductCard';
import { Product } from '@/types';
import styles from '@/app/(public)/shop/shop.module.css';
import { useProducts } from '@/hooks/useFirestore';
import { tracker } from '@/lib/analytics/tracker';

type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'name-asc';

const SORT_LABELS: Record<SortOption, string> = {
    newest: 'Newest First',
    'price-asc': 'Price: Low to High',
    'price-desc': 'Price: High to Low',
    'name-asc': 'Name: A–Z',
};

interface ShopClientProps {
    allProducts: Product[];
}

export default function ShopClient({ allProducts }: ShopClientProps) {
    const { products: liveProducts, loading } = useProducts();
    const [products, setProducts] = useState<Product[]>(allProducts);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [priceRange, setPriceRange] = useState(1000);
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const searchDebounceRef = useRef<any>(null);

    useEffect(() => {
        if (!loading && liveProducts.length > 0) {
            setProducts(liveProducts);
        }
    }, [liveProducts, loading]);

    const categories = useMemo(
        () => Array.from(new Set(products.map(p => p.category))).sort(),
        [products]
    );

    const filteredProducts = useMemo(() => {
        let list = products.filter(p => {
            const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
            const matchesPrice = (p.price ?? 0) <= priceRange;
            const matchesSearch = !searchQuery.trim() ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.description?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesPrice && matchesSearch;
        });

        switch (sortBy) {
            case 'price-asc':
                list = [...list].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
                break;
            case 'price-desc':
                list = [...list].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
                break;
            case 'name-asc':
                list = [...list].sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'newest':
            default:
                // Products are already ordered by name/server order
                break;
        }
        return list;
    }, [products, selectedCategory, priceRange, sortBy, searchQuery]);

    // Debounced search query analytics
    const handleSearchChange = (query: string) => {
        setSearchQuery(query);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (query.trim().length >= 2) {
            searchDebounceRef.current = setTimeout(() => {
                const count = products.filter(p =>
                    p.name.toLowerCase().includes(query.toLowerCase()) ||
                    p.category?.toLowerCase().includes(query.toLowerCase())
                ).length;
                tracker.track('search', {
                    query: query.trim(),
                    resultCount: count,
                    isZeroResult: count === 0
                });
            }, 800);
        }
    };

    return (
        <div className={styles.shopContainer}>
            <div className={`${styles.content} container`}>
                {/* Sidebar Filters */}
                <aside className={styles.sidebar}>
                    <div className={styles.filterSection}>
                        <h3>Categories</h3>
                        <ul className={styles.categoryList}>
                            <li
                                className={selectedCategory === 'All' ? styles.active : ''}
                                onClick={() => {
                                    setSelectedCategory('All');
                                    tracker.track('category_click', { category: 'All' });
                                }}
                            >
                                All Snacks
                            </li>
                            {categories.map((cat) => (
                                <li
                                    key={cat}
                                    className={selectedCategory === cat ? styles.active : ''}
                                    onClick={() => {
                                        setSelectedCategory(cat);
                                        tracker.track('category_click', { category: cat });
                                    }}
                                >
                                    {cat}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className={styles.filterSection}>
                        <h3>Price Range</h3>
                        <div className={styles.rangeWrapper}>
                            <input
                                type="range"
                                min="0"
                                max="1000"
                                value={priceRange}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setPriceRange(val);
                                    tracker.track('filter_change', { filterType: 'price', value: val });
                                }}
                            />
                            <div className={styles.rangeLabels}>
                                <span>₹0</span>
                                <span>₹{priceRange.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Product Grid */}
                <main className={styles.mainContent}>
                    <div className={styles.gridHeader}>
                        <h1>Shop</h1>
                        <div className={styles.gridControls}>
                            <div className={styles.searchWrapper}>
                                <input
                                    type="text"
                                    placeholder="Search snacks..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    className={styles.searchInput}
                                />
                            </div>
                            <div className={styles.filterSubRow}>
                                <span className={styles.resultsCount}>
                                    {filteredProducts.length} {filteredProducts.length === 1 ? 'Result' : 'Results'}
                                </span>
                                <div className={styles.sortWrapper}>
                                    <select
                                        className={styles.headerSortSelect}
                                        value={sortBy}
                                        onChange={(e) => {
                                            const opt = e.target.value as SortOption;
                                            setSortBy(opt);
                                            tracker.track('sort_change', { sortBy: opt });
                                        }}
                                    >
                                        {(Object.keys(SORT_LABELS) as SortOption[]).map(key => (
                                            <option key={key} value={key}>{SORT_LABELS[key]}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.productGrid}>
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map((product) => (
                                <ProductCard key={product.id} {...product} />
                            ))
                        ) : (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                No snacks found. Try adjusting your filters.
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
