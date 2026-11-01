"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useReviews } from '@/hooks/useFirestore';
import { useCart } from '@/contexts/CartContext';
import Button from '@/components/ui/Button/Button';
import StarRating from '@/components/ui/StarRating/StarRating';
import ReviewForm from '@/components/ui/Review/ReviewForm';
import ReviewList from '@/components/ui/Review/ReviewList';
import { tracker } from '@/lib/analytics/tracker';
import { ShoppingBag, Zap } from 'lucide-react';
import RazorpayMagicCheckoutWidget from '@/components/ui/RazorpayMagicCheckoutWidget/RazorpayMagicCheckoutWidget';
import styles from './product.module.css';

interface Product {
    id: string;
    name: string;
    price: number;
    category: string;
    inventoryStatus: string;
    description?: string;
    fullOverview?: string;
    imageURL?: string;
    imageURLs?: string[];
    basePrice: number;
    originalPrice?: number;
    currentStock: number;
    baseWeight: number;
    stockStr: string;
    features?: string[];
}

export default function ProductDetailsClient({ productId }: { productId: string }) {
    const router = useRouter();
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(0); // Will initialize based on product default
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const { addToCart, setIsCartOpen } = useCart();

    const {
        reviews,
        loading: reviewsLoading,
        averageRating,
        totalReviews,
        addReview
    } = useReviews(productId);

    useEffect(() => {
        const fetchProduct = async () => {
            if (!productId) return;
            try {
                const docRef = doc(db, 'products', productId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setProduct({
                        id: docSnap.id,
                        name: data.name || '',
                        price: data.price || 0,
                        basePrice: data.basePrice || data.price || 0,
                        category: data.category || '',
                        description: data.description || '',
                        fullOverview: data.overview || '',
                        inventoryStatus: data.status || 'In Stock',
                        currentStock: data.stock ? Number(String(data.stock).replace(/[^0-9]/g, '')) || 0 : 0,
                        baseWeight: data.stock ? Number(String(data.stock).replace(/[^0-9]/g, '')) || 100 : 100,
                        stockStr: data.stock || '100g',
                        imageURL: data.imageURL || data.image || '',
                        imageURLs: data.imageURLs || [],
                        originalPrice: data.originalPrice || 0,
                        features: data.features || [],
                    });
                    setQuantity(data.stock ? Number(String(data.stock).replace(/[^0-9]/g, '')) || 100 : 100);
                    setSelectedImage(data.imageURL || data.image || null);

                    tracker.track('product_view', {
                        productId: docSnap.id,
                        productName: data.name || '',
                        category: data.category || '',
                        price: data.price || 0,
                        stock: data.stock || '100g'
                    });
                } else {
                    // Check if it's a combo pack ID and redirect seamlessly
                    const comboRef = doc(db, 'combos', productId);
                    const comboSnap = await getDoc(comboRef);
                    if (comboSnap.exists()) {
                        router.replace(`/combos/${productId}`);
                        return;
                    }
                    setError('Product not found.');
                }
            } catch (err: any) {
                console.error("Error fetching product:", err);
                setError('Failed to load product details.');
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [productId]);

    if (loading) {
        return <div className={styles.loadingContainer}>Loading product details...</div>;
    }

    if (error || !product) {
        return <div className={styles.errorContainer}>{error || 'Product not found.'}</div>;
    }

    const handleAddToCart = (openDrawer = true) => {
        addToCart({
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category,
            imageURL: product.imageURL || '/Logo Munch Tokri.png',
            maxStock: product.currentStock ? product.currentStock * 1000 : 5000, // Convert kg to g or default 5kg
            baseWeight: product.baseWeight
        }, quantity, openDrawer);
    };

    const handleBuyNow = () => {
        if (product.inventoryStatus !== 'In Stock') return;
        handleAddToCart(false);
        setIsCartOpen(false);
        router.push('/checkout?magic=1');
    };

    const allImages = product.imageURLs && product.imageURLs.length > 0
        ? product.imageURLs
        : (product.imageURL ? [product.imageURL] : []);

    return (
        <div className={styles.productPage}>
            <div className={`container ${styles.productContainer}`}>
                {/* Breadcrumbs */}
                <div className={styles.breadcrumbs}>
                    <span>Home</span> / <span>Shop</span> / <span className={styles.activeBreadcrumb}>{product.category}</span>
                </div>

                <div className={styles.contentGrid}>
                    {/* Image Gallery */}
                    <div className={styles.imageColumn}>
                        <div className={styles.mainImageWrapper}>
                            {selectedImage ? (
                                <img
                                    src={selectedImage}
                                    alt={product.name}
                                    className={styles.mainImage}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/logo.png';
                                    }}
                                />
                            ) : (
                                <div className={styles.placeholderImage}>
                                    <img src="/logo.png" alt="Fallback" className={styles.fallbackLogo} />
                                </div>
                            )}
                        </div>
                        {allImages.length > 1 && (
                            <div className={styles.thumbnailGallery}>
                                {allImages.map((img, index) => (
                                    <button
                                        key={index}
                                        className={`${styles.thumbnailBtn} ${selectedImage === img ? styles.activeThumbnail : ''}`}
                                        onClick={() => {
                                            setSelectedImage(img);
                                            tracker.track('product_image_click', {
                                                productId: product.id,
                                                productName: product.name,
                                                imageIndex: index
                                            });
                                        }}
                                    >
                                        <img src={img} alt={`${product.name} thumbnail ${index + 1}`} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product Details */}
                    <div className={styles.infoColumn}>
                        <h1 className={styles.title}>{product.name}</h1>
                        <div className={styles.priceRow}>
                            <div className={styles.priceContainer}>
                                <span className={styles.price}>₹{product.price.toFixed(2)}</span>
                                {product.originalPrice !== undefined && product.originalPrice > product.price && (
                                    <span className={styles.originalPrice}>₹{product.originalPrice.toFixed(2)}</span>
                                )}
                                <span className={styles.weight}>/ {product.stockStr || '100g'}</span>
                            </div>
                        {totalReviews > 0 && (
                            <div className={styles.rating}>
                                <span className={styles.singleStar}>★</span>
                                <span className={styles.ratingText}>{averageRating.toFixed(1)}</span>
                                <span>({totalReviews} Reviews)</span>
                            </div>
                        )}
                        </div>

                        <p className={styles.shortDescription}>{product.description}</p>

                        {/* Inventory Status */}
                        {product.inventoryStatus && (
                            <div className={styles.stockStatus}>
                                <span className={product.inventoryStatus === 'In Stock' ? styles.inStock : styles.outOfStock}>
                                    {product.inventoryStatus}
                                </span>
                            </div>
                        )}

                        {/* Add to Cart Actions */}
                        <div className={styles.actionsBox}>
                            <div className={styles.quantitySelector}>
                                <button
                                    onClick={() => setQuantity(Math.max(product.baseWeight || 50, quantity - (product.baseWeight || 50)))}
                                    className={styles.qtyBtn}
                                    disabled={quantity <= (product.baseWeight || 50)}
                                >
                                    -
                                </button>
                                <span className={styles.qtyValue} style={{ minWidth: '60px' }}>
                                    {quantity / (product.baseWeight || 50)} ({quantity}g)
                                </span>
                                <button
                                    onClick={() => setQuantity(Math.min(5000, quantity + (product.baseWeight || 50)))} // Max 5kg at once
                                    className={styles.qtyBtn}
                                    disabled={product.inventoryStatus !== 'In Stock'}
                                >
                                    +
                                </button>
                            </div>

                            <Button
                                variant="primary"
                                size="lg"
                                className={styles.addToCartBtn}
                                onClick={() => handleAddToCart(true)}
                                disabled={product.inventoryStatus !== 'In Stock'}
                            >
                                <ShoppingBag size={18} style={{ marginRight: '6px' }} />
                                Add to Cart
                            </Button>

                            {/* 1-Click Magic Checkout Widget (as shown in reference image) */}
                            <RazorpayMagicCheckoutWidget
                                onBuyNow={handleBuyNow}
                                disabled={product.inventoryStatus !== 'In Stock'}
                                buttonText="Buy Now"
                                showProtectionBar={true}
                            />
                        </div>

                        {/* Full Overview */}
                        {product.fullOverview && (
                            <div className={styles.overviewSection}>
                                <h3>Product Overview</h3>
                                <p>{product.fullOverview}</p>
                            </div>
                        )}

                        {/* Feature Highlights */}
                        {product.features && product.features.length > 0 && (
                            <div className={styles.featuresList}>
                                {product.features.filter(f => f.trim() !== '').map((feature, index) => (
                                    <div key={index} className={styles.featureItem}>
                                        <div className={styles.featureIcon}>✦</div>
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Reviews Section */}
                <div className={styles.reviewsSection}>
                    <div className={styles.reviewsHeader}>
                        <div className={styles.reviewsTitleRow}>
                            <h2>Customer Reviews</h2>
                            <div className={styles.avgRatingBox}>
                                <span className={styles.avgValue}>{averageRating.toFixed(1)}</span>
                                <StarRating rating={Math.round(averageRating)} />
                                <span className={styles.totalCount}>Based on {totalReviews} reviews</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.reviewsGrid}>
                        <div className={styles.reviewFormCol}>
                            <ReviewForm
                                productId={productId}
                                onSubmit={async (reviewData) => {
                                    const user = auth.currentUser;
                                    if (!user) return;
                                    await addReview({
                                        productId,
                                        userId: user.uid,
                                        userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
                                        userPhoto: user.photoURL || '',
                                        rating: reviewData.rating,
                                        comment: reviewData.comment
                                    });
                                }}
                            />
                        </div>
                        <div className={styles.reviewListCol}>
                            <ReviewList reviews={reviews} loading={reviewsLoading} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
