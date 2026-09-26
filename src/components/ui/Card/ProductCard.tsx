import React, { useEffect } from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button/Button';
import styles from './ProductCard.module.css';
import { useCart } from '@/contexts/CartContext';
import Link from 'next/link';
import StarRating from '@/components/ui/StarRating/StarRating';
import { tracker } from '@/lib/analytics/tracker';

interface ProductCardProps {
    id: string;
    name: string;
    price: number;
    category: string;
    image?: string;
    imageURL?: string;
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
}

const ProductCard: React.FC<ProductCardProps> = ({ 
    id, name, price, category, image, imageURL, description, discount, stock, baseWeight, status, originalPrice, features,
    avgRating = 0, numReviews = 0, isBestSeller, isTopProduct, isLimitedEdition, isLimitedOffer
}) => {
    const { addToCart } = useCart();
    const displayImage = imageURL || image;

    useEffect(() => {
        tracker.track('product_impression', {
            productId: id,
            productName: name,
            category: category || 'General',
            price
        });
    }, [id, name, category, price]);

    const handleAddToCart = () => {
        // Calculate base weight if not provided
        const finalBaseWeight = baseWeight || (stock ? Number(String(stock).replace(/[^0-9]/g, '')) || 100 : 100);
        
        addToCart({
            id: id,
            name: name,
            price: price,
            category: category || 'General',
            imageURL: displayImage || '/Logo Munch Tokri.png',
            maxStock: 5000, 
            baseWeight: finalBaseWeight
        }, finalBaseWeight);
    };

    return (
        <div className={styles.card}>
            {/* Multi-Badge System */}
            <div className={styles.badgeContainer}>
                {isBestSeller && <div className={`${styles.badge} ${styles.bestSeller}`}>Best Seller</div>}
                {isTopProduct && <div className={`${styles.badge} ${styles.topProduct}`}>Top Product</div>}
                {isLimitedEdition && <div className={`${styles.badge} ${styles.limitedEdition}`}>Limited Edition</div>}
                {isLimitedOffer && <div className={`${styles.badge} ${styles.limitedOffer}`}>Limited Offer</div>}
                {!!discount && discount > 0 && <div className={`${styles.badge} ${styles.discount}`}>-{discount}% OFF</div>}
            </div>

            <Link
                href={`/product/${id}`}
                onClick={() => {
                    tracker.track('product_click', {
                        productId: id,
                        productName: name,
                        category: category || 'General',
                        price
                    });
                }}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', flex: 1 }}
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
                    <h3 className={styles.name}>{name}</h3>
                    <p className={styles.description}>{description}</p>
                    
                    <div className={styles.priceContainer}>
                        <div className={styles.priceLeft}>
                            <div className={styles.priceLine}>
                                <span className={styles.price}>₹{price.toFixed(0)}</span>
                                <span className={styles.weight}>/ {stock || '100g'}</span>
                            </div>
                            {originalPrice !== undefined && originalPrice > price && (
                                <span className={styles.originalPrice}>₹{originalPrice.toFixed(0)}</span>
                            )}
                        </div>
                        
                        <div className={styles.ratingBadge}>
                            <span className={styles.star}>★</span>
                            <span className={styles.ratingValue}>{avgRating.toFixed(1)}</span>
                            <span className={styles.ratingCount}>({numReviews})</span>
                        </div>
                    </div>
                </div>
            </Link>

            <div style={{ padding: '0 1.5rem 1.5rem' }}>
                <Button 
                    variant="primary" 
                    size="sm" 
                    className={styles.addBtn}
                    onClick={handleAddToCart}
                    disabled={status === 'Out of Stock'}
                >
                    {status === 'Out of Stock' ? 'Out of Stock' : 'Add to Cart'}
                </Button>
            </div>
        </div>
    );
};

export default ProductCard;
