"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCart } from '@/contexts/CartContext';
import { Combo, ComboProduct } from '@/types';
import { toast, Toaster } from 'react-hot-toast';
import { tracker } from '@/lib/analytics/tracker';
import { sortComboVariantsLowToHigh } from '@/lib/constants';
import { 
    ChevronRight, 
    ShoppingBag, 
    Check, 
    Sparkles, 
    ShieldCheck, 
    Truck, 
    ArrowLeft,
    PackageCheck,
    Layers,
    ExternalLink,
    Zap
} from 'lucide-react';
import RazorpayMagicCheckoutWidget from '@/components/ui/RazorpayMagicCheckoutWidget/RazorpayMagicCheckoutWidget';
import { useMagicCheckout } from '@/hooks/useMagicCheckout';
import styles from './comboDetails.module.css';

interface ComboDetailsClientProps {
    initialCombo: Combo;
}

export default function ComboDetailsClient({ initialCombo }: ComboDetailsClientProps) {
    const router = useRouter();
    const { addToCart, setIsCartOpen } = useCart();
    const { openMagicCheckout, isLoading: isMagicCheckoutLoading } = useMagicCheckout();
    const [combo, setCombo] = useState<Combo>(initialCombo);
    const [selectedImage, setSelectedImage] = useState<string>(
        initialCombo.imageURL || initialCombo.products?.[0]?.imageURL || '/Logo Munch Tokri.png'
    );
    const [quantity, setQuantity] = useState<number>(1);
    const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);

    // Real-time listener for any admin changes
    useEffect(() => {
        if (!initialCombo.id) return;
        const unsub = onSnapshot(doc(db, "combos", initialCombo.id), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCombo({
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt ? {
                        seconds: data.createdAt.seconds,
                        nanoseconds: data.createdAt.nanoseconds
                    } : null
                } as unknown as Combo);
            }
        }, (err) => {
            console.error("Error listening to combo doc:", err);
        });

        return () => unsub();
    }, [initialCombo.id]);

    useEffect(() => {
        tracker.track('product_view', {
            productId: combo.id,
            productName: combo.name,
            category: 'Combos',
            price: combo.price,
            stock: `${combo.products?.length || 0} items`
        });
    }, [combo.id, combo.name, combo.price, combo.products]);

    const products = combo.products || [];
    const packCount = combo.packSize || products.length;
    const packLabel = combo.packLabel || `Pack of ${packCount}`;
    const totalGrams = products.reduce((sum, p) => sum + (p.grams || 0), 0);

    // Variant calculation (sorted low to high)
    const sortedVariants = useMemo(() => {
        return sortComboVariantsLowToHigh(combo.variants);
    }, [combo.variants]);

    const hasVariants = Boolean(sortedVariants && sortedVariants.length > 0);
    const selectedVariant = hasVariants ? sortedVariants[selectedVariantIndex] || sortedVariants[0] : null;

    const currentPrice = selectedVariant ? selectedVariant.price : combo.price;
    const currentOriginalPrice = selectedVariant ? selectedVariant.originalPrice : (combo.originalPrice || combo.price);
    const currentStatus = selectedVariant ? selectedVariant.status : (combo.status || 'In Stock');
    const comboProductsTotalGrams = (products || []).reduce((acc, p) => acc + (Number(p.grams) || 0), 0);
    const currentGrams = selectedVariant?.grams || (comboProductsTotalGrams > 0 ? comboProductsTotalGrams * (combo.packSize || 1) : 0);
    const variantTitle = selectedVariant ? selectedVariant.title : packLabel;
    const variantLabel = currentGrams > 0 ? `${variantTitle} (${currentGrams}g)` : variantTitle;

    const savingsAmount = Math.max(0, currentOriginalPrice - currentPrice);
    const discountPct = currentOriginalPrice > currentPrice
        ? Math.round(((currentOriginalPrice - currentPrice) / currentOriginalPrice) * 100)
        : 0;

    // Collect all unique preview images
    const allImages: string[] = [];
    if (combo.imageURL) allImages.push(combo.imageURL);
    if (combo.imageURLs && Array.isArray(combo.imageURLs)) {
        combo.imageURLs.forEach(url => {
            if (url && !allImages.includes(url)) allImages.push(url);
        });
    }
    products.forEach(p => {
        if (p.imageURL && !allImages.includes(p.imageURL)) allImages.push(p.imageURL);
    });
    if (allImages.length === 0) allImages.push('/Logo Munch Tokri.png');

    const handleAddToCart = (openDrawer = true) => {
        if (currentStatus === 'Out of Stock') return;

        const cartItemId = selectedVariant 
            ? `${combo.id}_${selectedVariant.id || selectedVariant.title.replace(/\s+/g, '_')}`
            : combo.id;
        const itemName = `${combo.name} (${variantLabel})`;

        const comboImg = combo.imageURL || 
            (combo.imageURLs && combo.imageURLs.length > 0 ? combo.imageURLs[0] : '') || 
            (combo.images && combo.images.length > 0 ? combo.images[0] : '') ||
            (products && products.length > 0 ? (products[0]?.imageURL || (products[0] as any)?.image) : '') || 
            '/Logo Munch Tokri.png';

        addToCart({
            id: cartItemId,
            productId: combo.id,
            name: itemName,
            price: currentPrice,
            originalPrice: currentOriginalPrice,
            baseWeight: 1, // unit based for combos
            category: 'Combos',
            imageURL: comboImg,
            maxStock: 50,
            products: combo.products,
            variant: variantLabel,
            grams: currentGrams,
            variantGrams: currentGrams,
        }, quantity, openDrawer);

        if (openDrawer) {
            toast.success(`${itemName} added to cart!`, {
                icon: '🎁',
                style: { borderRadius: '12px', background: '#1e293b', color: '#fff' }
            });
        }
    };

    const handleBuyNow = () => {
        if (currentStatus === 'Out of Stock') return;
        setIsCartOpen(false);
        const cartItemId = selectedVariant 
            ? `${combo.id}_${selectedVariant.id || selectedVariant.title.replace(/\s+/g, '_')}`
            : combo.id;
        const itemName = `${combo.name} (${variantLabel})`;
        const comboImg = combo.imageURL || 
            (combo.imageURLs && combo.imageURLs.length > 0 ? combo.imageURLs[0] : '') || 
            (products && products.length > 0 ? (products[0]?.imageURL || (products[0] as any)?.image) : '') || 
            '/Logo Munch Tokri.png';

        const item = {
            id: cartItemId,
            productId: combo.id,
            name: itemName,
            price: currentPrice,
            originalPrice: currentOriginalPrice,
            baseWeight: 1,
            category: 'Combos',
            imageURL: comboImg,
            maxStock: 50,
            products: combo.products,
            variant: variantLabel,
            grams: currentGrams,
            variantGrams: currentGrams,
            quantity: quantity,
        };
        openMagicCheckout({
            items: [item],
            total: currentPrice * quantity,
        });
    };

    return (
        <main className={styles.pageWrapper}>
            <Toaster position="bottom-center" />
            <div className="container">
                {/* Breadcrumbs */}
                <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
                    <Link href="/">Home</Link>
                    <ChevronRight size={14} />
                    <Link href="/combos">Combos & Gift Packs</Link>
                    <ChevronRight size={14} />
                    <span className={styles.breadcrumbCurrent}>{combo.name}</span>
                </nav>

                {/* Hero Box */}
                <div className={styles.heroGrid}>
                    {/* Left: Gallery */}
                    <div className={styles.galleryColumn}>
                        <div className={styles.mainImageWrapper}>
                            <img
                                src={selectedImage}
                                alt={combo.name}
                                className={styles.mainImage}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/Logo Munch Tokri.png';
                                }}
                            />
                            <div className={styles.packBadge}>
                                ✨ {packLabel}
                            </div>
                            {savingsAmount > 0 && (
                                <div className={styles.savingsBadge}>
                                    SAVE ₹{savingsAmount} ({discountPct}% OFF)
                                </div>
                            )}
                        </div>

                        {allImages.length > 1 && (
                            <div className={styles.thumbnailsRow}>
                                {allImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={`${styles.thumbnailBtn} ${selectedImage === img ? styles.activeThumb : ''}`}
                                        onClick={() => setSelectedImage(img)}
                                    >
                                        <img
                                            src={img}
                                            alt={`Thumbnail ${idx + 1}`}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/Logo Munch Tokri.png';
                                            }}
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Info */}
                    <div className={styles.infoColumn}>
                        <div className={styles.packHeaderTag}>
                            <Sparkles size={14} />
                            Curated Value Bundle • {packLabel}
                        </div>

                        <h1 className={styles.title}>
                            {combo.name}{selectedVariant && !combo.name.includes(selectedVariant.title) ? ` (${selectedVariant.title})` : ''}
                        </h1>

                        <p className={styles.desc}>
                            {combo.description || `Enjoy our handcrafted Karnataka heritage munchies with this specially curated ${packLabel} bundle. Roasted to authentic perfection.`}
                        </p>

                        {/* Metadata Pills */}
                        <div className={styles.metaGrid}>
                            <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>Pack Contents</span>
                                <span className={styles.metaValue}>{packCount} Snacks</span>
                            </div>
                            <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>Total Weight</span>
                                <span className={styles.metaValue}>{totalGrams}g Total</span>
                            </div>
                            <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>Availability</span>
                                <span className={styles.metaValue} style={{ color: currentStatus === 'Out of Stock' ? '#ef4444' : '#16a34a' }}>
                                    {currentStatus}
                                </span>
                            </div>
                        </div>

                        {/* Interactive Variant / Pack Size Selector */}
                        {hasVariants && sortedVariants.length > 0 && (
                            <div style={{
                                margin: '1.25rem 0 1.5rem',
                                padding: '1.25rem',
                                background: '#f8fafc',
                                border: '1.5px solid #cbd5e1',
                                borderRadius: '16px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '1rem',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem'
                                }}>
                                    <span style={{
                                        fontSize: '0.85rem',
                                        fontWeight: 800,
                                        color: '#1e293b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <Sparkles size={15} color="#0d9488" />
                                        Select Pack Option / Variant:
                                    </span>
                                    {selectedVariant && (
                                        <span style={{
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            color: '#0f766e',
                                            background: '#ccfbf1',
                                            border: '1px solid #99f6e4',
                                            padding: '0.2rem 0.65rem',
                                            borderRadius: '9999px'
                                        }}>
                                            Selected: {selectedVariant.title} {currentGrams > 0 ? `(${currentGrams}g)` : ''}
                                        </span>
                                    )}
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                    gap: '0.85rem'
                                }}>
                                    {sortedVariants.map((v, idx) => {
                                        const isSelected = selectedVariantIndex === idx;
                                        const isOut = v.status === 'Out of Stock';
                                        const vSavings = Math.max(0, (v.originalPrice || 0) - (v.price || 0));
                                        const packNum = (v.title?.match(/\d+/)?.[0]) ? parseInt(v.title.match(/\d+/)![0], 10) : (idx + 1);
                                        const vGrams = v.grams || (comboProductsTotalGrams > 0 ? comboProductsTotalGrams * packNum : 0);
                                        return (
                                            <button
                                                key={v.id || idx}
                                                type="button"
                                                onClick={() => setSelectedVariantIndex(idx)}
                                                disabled={isOut}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'flex-start',
                                                    padding: '0.9rem 1rem',
                                                    background: isSelected ? '#f0fdfa' : '#ffffff',
                                                    border: isSelected ? '2px solid #0d9488' : '2px solid #e2e8f0',
                                                    borderRadius: '12px',
                                                    cursor: isOut ? 'not-allowed' : 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'all 0.2s ease',
                                                    position: 'relative',
                                                    boxShadow: isSelected ? '0 4px 12px rgba(13, 148, 136, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                                                    opacity: isOut ? 0.5 : 1,
                                                    width: '100%'
                                                }}
                                            >
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    width: '100%',
                                                    marginBottom: '0.25rem'
                                                }}>
                                                    <span style={{
                                                        fontSize: '0.92rem',
                                                        fontWeight: 700,
                                                        color: isSelected ? '#0f766e' : '#0f172a'
                                                    }}>
                                                        {v.title}
                                                    </span>
                                                    <div style={{
                                                        width: '18px',
                                                        height: '18px',
                                                        borderRadius: '50%',
                                                        border: isSelected ? '2px solid #0d9488' : '2px solid #cbd5e1',
                                                        background: isSelected ? '#0d9488' : '#ffffff',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                                                    </div>
                                                </div>

                                                {vGrams > 0 && (
                                                    <div style={{
                                                        fontSize: '0.74rem',
                                                        fontWeight: 700,
                                                        color: isSelected ? '#0f766e' : '#0369a1',
                                                        background: isSelected ? '#ccfbf1' : '#f0f9ff',
                                                        border: isSelected ? '1px solid #99f6e4' : '1px solid #bae6fd',
                                                        padding: '1px 7px',
                                                        borderRadius: '6px',
                                                        marginBottom: '0.4rem',
                                                        width: 'fit-content',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '3px'
                                                    }}>
                                                        ⚖️ {vGrams}g
                                                    </div>
                                                )}

                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'baseline',
                                                    gap: '0.45rem',
                                                    marginBottom: '0.35rem'
                                                }}>
                                                    <span style={{
                                                        fontSize: '1.15rem',
                                                        fontWeight: 800,
                                                        color: isSelected ? '#0d9488' : '#1e293b'
                                                    }}>
                                                        ₹{v.price.toLocaleString('en-IN')}
                                                    </span>
                                                    {v.originalPrice > v.price && (
                                                        <span style={{
                                                            fontSize: '0.78rem',
                                                            color: '#94a3b8',
                                                            textDecoration: 'line-through'
                                                        }}>
                                                            ₹{v.originalPrice.toLocaleString('en-IN')}
                                                        </span>
                                                    )}
                                                </div>

                                                {vSavings > 0 && !isOut && (
                                                    <div style={{
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        color: '#059669',
                                                        background: '#ecfdf5',
                                                        border: '1px solid #a7f3d0',
                                                        padding: '2px 7px',
                                                        borderRadius: '6px'
                                                    }}>
                                                        Save ₹{vSavings}
                                                    </div>
                                                )}

                                                {isOut && (
                                                    <div style={{
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        color: '#ef4444',
                                                        background: '#fee2e2',
                                                        padding: '2px 7px',
                                                        borderRadius: '6px'
                                                    }}>
                                                        Out of Stock
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Pricing Header */}
                        <div className={styles.priceBox}>
                            <span className={styles.price}>₹{currentPrice.toLocaleString('en-IN')}</span>
                            {currentOriginalPrice > currentPrice && (
                                <span className={styles.originalPrice}>
                                    ₹{currentOriginalPrice.toLocaleString('en-IN')}
                                </span>
                            )}
                            {savingsAmount > 0 && (
                                <span className={styles.saveText}>
                                    Save ₹{savingsAmount} ({discountPct}% OFF)
                                </span>
                            )}
                        </div>

                        {/* Explicit Price Breakdown Card */}
                        <div className={styles.breakdownCard}>
                            <div className={styles.breakdownHeader}>
                                <Sparkles size={13} color="var(--primary)" />
                                Pricing & Savings Breakdown {selectedVariant ? `(${selectedVariant.title})` : ''}
                            </div>
                            <div className={styles.breakdownRow}>
                                <span>Individual Items Total (MRP)</span>
                                <span>₹{currentOriginalPrice.toLocaleString('en-IN')}</span>
                            </div>
                            {savingsAmount > 0 && (
                                <div className={styles.breakdownRowMinus}>
                                    <span>Combo Discount Applied</span>
                                    <span>- ₹{savingsAmount.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            <div className={styles.breakdownDivider} />
                            <div className={styles.breakdownTotalRow}>
                                <span>Final Combo Pack Price</span>
                                <span style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>₹{currentPrice.toLocaleString('en-IN')}</span>
                            </div>
                            {savingsAmount > 0 && (
                                <div className={styles.breakdownSavingsTag}>
                                    <Check size={14} /> You save ₹{savingsAmount} ({discountPct}% discount on this pack)
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className={styles.actionsRow}>
                            <div className={styles.qtyControl}>
                                <button
                                    type="button"
                                    className={styles.qtyBtn}
                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                    disabled={quantity <= 1 || currentStatus === 'Out of Stock'}
                                >
                                    -
                                </button>
                                <span className={styles.qtyDisplay}>{quantity}</span>
                                <button
                                    type="button"
                                    className={styles.qtyBtn}
                                    onClick={() => setQuantity(q => Math.min(20, q + 1))}
                                    disabled={quantity >= 20 || currentStatus === 'Out of Stock'}
                                >
                                    +
                                </button>
                            </div>

                            <div className={styles.comboBtnGroup}>
                                <button
                                    type="button"
                                    className={styles.addBtn}
                                    onClick={() => handleAddToCart(true)}
                                    disabled={currentStatus === 'Out of Stock'}
                                >
                                    <ShoppingBag size={18} />
                                    {currentStatus === 'Out of Stock' ? 'Out of Stock' : 'Add Pack to Cart'}
                                </button>
                            </div>

                            {/* 1-Click Magic Checkout Widget (as shown in reference image) */}
                            <RazorpayMagicCheckoutWidget
                                onBuyNow={handleBuyNow}
                                disabled={currentStatus === 'Out of Stock'}
                                loading={isMagicCheckoutLoading}
                                buttonText="Buy Now"
                                showProtectionBar={true}
                            />
                        </div>

                        {/* Trust Strip */}
                        <div className={styles.trustStrip}>
                            <div className={styles.trustItem}>
                                <span>🌿</span> 100% Traditional Recipe
                            </div>
                            <div className={styles.trustItem}>
                                <span>🔒</span> Airtight Fresh Packaging
                            </div>
                            <div className={styles.trustItem}>
                                <span>🚚</span> Quick Dispatch
                            </div>
                        </div>
                    </div>
                </div>

                {/* What's Inside This Pack Section */}
                <section className={styles.packBreakdownSection}>
                    <div className={styles.sectionHeader}>
                        <span className={styles.sectionBadge}>Pack Breakdown</span>
                        <h2 className={styles.sectionTitle}>What's Inside This {packLabel}?</h2>
                        <p className={styles.sectionSubtitle}>
                            Each snack in this bundle is crafted in small batches using heritage techniques and individually portioned for ultimate crunch.
                        </p>
                    </div>

                    <div className={styles.productsGrid}>
                        {products.map((item: ComboProduct, index: number) => (
                            <div key={item.productId || index} className={styles.itemCard}>
                                <div className={styles.itemImageWrapper}>
                                    <img
                                        src={item.imageURL || '/Logo Munch Tokri.png'}
                                        alt={item.name}
                                        className={styles.itemImage}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = '/Logo Munch Tokri.png';
                                        }}
                                    />
                                    <div className={styles.itemPortionBadge}>
                                        {item.grams}g Pack
                                    </div>
                                </div>

                                <div className={styles.itemContent}>
                                    <span className={styles.itemIndexTag}>Item #{index + 1} in Pack</span>
                                    <h3 className={styles.itemName}>{item.name}</h3>
                                    <div className={styles.itemPortionText}>
                                        <Layers size={14} color="#64748b" />
                                        <span>Portion: <strong>{item.grams}g</strong> {item.price ? `(Value: ₹${item.price})` : ''}</span>
                                    </div>

                                    <div className={styles.itemCardFooter}>
                                        <span className={styles.itemIncludedTag}>
                                            <Check size={14} /> Included in Pack
                                        </span>
                                        {item.productId && (
                                            <Link 
                                                href={`/product/${item.productId}`} 
                                                className={styles.viewItemBtn}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                View Details
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom reassurance banner */}
                    <div className={styles.bottomBanner}>
                        <div>
                            <div className={styles.bottomBannerTitle}>
                                🎁 Great for Family Snacking or Gifting
                            </div>
                            <div className={styles.bottomBannerText}>
                                You get {packCount} distinct traditional snacks ({totalGrams}g total) for only ₹{combo.price}. Total savings of ₹{savingsAmount}!
                            </div>
                        </div>
                        <div className={styles.bannerBtnGroup}>
                            <button
                                type="button"
                                className={styles.addBtn}
                                onClick={() => handleAddToCart(true)}
                                disabled={currentStatus === 'Out of Stock'}
                            >
                                <ShoppingBag size={18} />
                                Add to Cart (₹{currentPrice})
                            </button>
                            <button
                                type="button"
                                className={styles.buyNowBtn}
                                onClick={handleBuyNow}
                                disabled={currentStatus === 'Out of Stock'}
                            >
                                <Zap size={18} />
                                Buy Now
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
