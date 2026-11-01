import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button/Button';
import styles from './ProductCard.module.css';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useMagicCheckout } from '@/hooks/useMagicCheckout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Zap, Loader2 } from 'lucide-react';
import StarRating from '@/components/ui/StarRating/StarRating';
import { tracker } from '@/lib/analytics/tracker';
import { sortComboVariantsLowToHigh } from '@/lib/constants';

interface ProductCardProps {
    id: string;
    name: string;
    price: number;
    category: string;
    image?: string;
    imageURL?: string;
    imageURLs?: string[];
    images?: string[];
    description?: string;
    discount?: number;
    stock?: string;
    baseWeight?: number;
    status?: string;
    originalPrice?: number;
    features?: string[];
    avgRating?: number;
    numReviews?: number;
    isBestSeller?: boolean;
    isTopProduct?: boolean;
    isLimitedEdition?: boolean;
    isLimitedOffer?: boolean;
    href?: string;
    badgeText?: string;
    products?: any[];
    maxStock?: number;
    variants?: any[];
}

const ProductCard: React.FC<ProductCardProps> = ({ 
    id, name, price, category, image, imageURL, imageURLs, images, description, discount, stock, baseWeight, status, originalPrice, features,
    avgRating = 0, numReviews = 0, isBestSeller, isTopProduct, isLimitedEdition, isLimitedOffer,
    href, badgeText, products, maxStock, variants
}) => {
    const { addToCart, setIsCartOpen } = useCart();
    const { openMagicCheckout, isLoading: isMagicLoading } = useMagicCheckout();
    const router = useRouter();
    const sortedVariants = useMemo(() => sortComboVariantsLowToHigh(variants), [variants]);
    const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(0);
    const hasMultipleVariants = Boolean(sortedVariants && sortedVariants.length > 1);
    const activeVariant = sortedVariants && sortedVariants.length > 0 ? sortedVariants[selectedVariantIdx] || sortedVariants[0] : null;
    const activeVariantGrams = activeVariant?.grams || 0;
    const cardPrice = activeVariant ? activeVariant.price : price;
    const cardOriginalPrice = activeVariant ? activeVariant.originalPrice : originalPrice;
    const cardStatus = activeVariant ? activeVariant.status : status;
    const variantTitle = activeVariant ? activeVariant.title : undefined;
    const variantLabelWithGrams = variantTitle ? (activeVariantGrams > 0 ? `${variantTitle} (${activeVariantGrams}g)` : variantTitle) : undefined;
    const cardStock = variantLabelWithGrams || stock;
    const cardName = variantLabelWithGrams && !name.includes(variantLabelWithGrams) ? `${name} (${variantLabelWithGrams})` : name;

    const displayImage = imageURL || image || (imageURLs && imageURLs.length > 0 ? imageURLs[0] : '') || (images && images.length > 0 ? images[0] : '');

    useEffect(() => {
        tracker.track('product_impression', {
            productId: id,
            productName: name,
            category: category || 'General',
            price: cardPrice
        });
    }, [id, name, category, cardPrice]);

    const handleAddToCart = (e?: React.MouseEvent, openDrawer = true) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (cardStatus === 'Out of Stock') return;
        const isCombo = category === 'Combos';
        const finalBaseWeight = isCombo ? 1 : (baseWeight || (stock ? Number(String(stock).replace(/[^0-9]/g, '')) || 100 : 100));
        const finalId = activeVariant ? `${id}_${activeVariant.id || activeVariant.title.replace(/\s+/g, '_')}` : id;
        const finalName = variantLabelWithGrams && !name.includes(variantLabelWithGrams) ? `${name} (${variantLabelWithGrams})` : name;
        
        addToCart({
            id: finalId,
            productId: id,
            name: finalName,
            price: cardPrice,
            originalPrice: cardOriginalPrice,
            category: category || (isCombo ? 'Combos' : 'General'),
            imageURL: displayImage || '/Logo Munch Tokri.png',
            maxStock: maxStock || (isCombo ? 50 : 5000), 
            baseWeight: finalBaseWeight,
            products: products,
            variant: variantLabelWithGrams,
            grams: activeVariantGrams,
            variantGrams: activeVariantGrams
        }, isCombo ? 1 : finalBaseWeight, openDrawer);
    };

    const handleBuyNow = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (cardStatus === 'Out of Stock' || isMagicLoading) return;

        const isCombo = category === 'Combos';
        const finalBaseWeight = isCombo ? 1 : (baseWeight || (stock ? Number(String(stock).replace(/[^0-9]/g, '')) || 100 : 100));
        const finalId = activeVariant ? `${id}_${activeVariant.id || activeVariant.title.replace(/\s+/g, '_')}` : id;
        const finalName = variantLabelWithGrams && !name.includes(variantLabelWithGrams) ? `${name} (${variantLabelWithGrams})` : name;
        const targetQty = isCombo ? 1 : finalBaseWeight;
        const targetTotal = cardPrice;

        const buyItem: CartItem = {
            id: finalId,
            productId: id,
            name: finalName,
            price: cardPrice,
            originalPrice: cardOriginalPrice,
            category: category || (isCombo ? 'Combos' : 'General'),
            imageURL: displayImage || '/Logo Munch Tokri.png',
            maxStock: maxStock || (isCombo ? 50 : 5000), 
            baseWeight: finalBaseWeight,
            products: products,
            variant: variantLabelWithGrams,
            grams: activeVariantGrams,
            variantGrams: activeVariantGrams,
            quantity: targetQty,
        };

        addToCart(buyItem, targetQty, false);
        setIsCartOpen(false);

        openMagicCheckout({
            items: [buyItem],
            total: targetTotal,
        });
    };

    return (
        <div className={styles.card}>
            {/* Multi-Badge System */}
            <div className={styles.badgeContainer}>
                {badgeText && <div className={`${styles.badge} ${styles.bestSeller}`}>{badgeText}</div>}
                {isBestSeller && <div className={`${styles.badge} ${styles.bestSeller}`}>Best Seller</div>}
                {isTopProduct && <div className={`${styles.badge} ${styles.topProduct}`}>Top Product</div>}
                {isLimitedEdition && <div className={`${styles.badge} ${styles.limitedEdition}`}>Limited Edition</div>}
                {isLimitedOffer && <div className={`${styles.badge} ${styles.limitedOffer}`}>Limited Offer</div>}
                {!!discount && discount > 0 && <div className={`${styles.badge} ${styles.discount}`}>-{discount}% OFF</div>}
            </div>

            <Link
                href={href || `/product/${id}`}
                onClick={() => {
                    tracker.track('product_click', {
                        productId: id,
                        productName: name,
                        category: category || 'General',
                        price
                    });
                }}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}
            >
                <div className={styles.imageWrapper}>
                    {displayImage && displayImage.trim() !== '' ? (
                        <Image
                            src={displayImage}
                            alt={name}
                            fill
                            sizes="(max-width: 768px) 50vw, 25vw"
                            className={styles.productImage}
                            style={{ objectFit: 'cover' }}
                        />
                    ) : (
                        <div className={styles.placeholderImage}>
                            <Image 
                                src="/logo.png" 
                                alt="Fallback" 
                                fill
                                style={{ objectFit: 'contain', padding: '20%' }}
                            />
                        </div>
                    )}
                </div>
                <div className={styles.info}>
                    <h3 className={styles.name}>{cardName}</h3>
                    <p className={styles.description}>{description}</p>
                    
                    <div className={styles.priceContainer}>
                        <div className={styles.priceLeft}>
                            <div className={styles.priceLine}>
                                <span className={styles.price}>₹{cardPrice.toFixed(0)}</span>
                                <span className={styles.weight}>/ {cardStock || (category === 'Combos' ? 'Pack' : '100g')}</span>
                            </div>
                            {cardOriginalPrice !== undefined && cardOriginalPrice > cardPrice && (
                                <span className={styles.originalPrice}>₹{cardOriginalPrice.toFixed(0)}</span>
                            )}
                        </div>
                        
                        {numReviews > 0 ? (
                            <div className={styles.ratingBadge}>
                                <span className={styles.star}>★</span>
                                <span className={styles.ratingValue}>{avgRating.toFixed(1)}</span>
                                <span className={styles.ratingCount}>({numReviews})</span>
                            </div>
                        ) : category === 'Combos' ? (
                            <div className={styles.ratingBadge} style={{ background: '#e0f2fe', borderColor: '#bae6fd' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1' }}>🎁 Pack</span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </Link>

            <div style={{ padding: '0 1.25rem 1.25rem', marginTop: 'auto', width: '100%' }}>
                {hasMultipleVariants && (
                    <div 
                        style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }} 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    >
                        {sortedVariants?.map((v, idx) => (
                            <button
                                key={v.id || idx}
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedVariantIdx(idx);
                                }}
                                style={{
                                    padding: '0.25rem 0.6rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    border: selectedVariantIdx === idx ? '1.5px solid #005A36' : '1px solid #d1d5db',
                                    background: selectedVariantIdx === idx ? '#ecfdf5' : '#ffffff',
                                    color: selectedVariantIdx === idx ? '#005A36' : '#4b5563',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {v.title}{v.grams ? ` (${v.grams}g)` : ''}
                            </button>
                        ))}
                    </div>
                )}
                {cardStatus === 'Out of Stock' ? (
                    <Button 
                        variant="primary" 
                        size="sm" 
                        className={styles.addBtn}
                        disabled
                    >
                        Out of Stock
                    </Button>
                ) : (
                    <div className={styles.btnRow} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <button
                            type="button"
                            className={styles.cartBtn}
                            onClick={(e) => handleAddToCart(e, true)}
                            title="Add to Cart"
                        >
                            <ShoppingBag size={14} />
                            <span>Add to Cart</span>
                        </button>
                        <button
                            type="button"
                            className={styles.buyNowBtn}
                            onClick={handleBuyNow}
                            title="Buy Now"
                            disabled={isMagicLoading}
                        >
                            {isMagicLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
                            <span>{isMagicLoading ? 'Opening...' : 'Buy Now'}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductCard;
