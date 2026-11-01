"use client";

import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import styles from './FloatingCart.module.css';

const FloatingCart = () => {
    const { cartCount, setIsCartOpen } = useCart();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || cartCount === 0) return null;

    return (
        <button 
            className={styles.floatingCart} 
            onClick={() => setIsCartOpen(true)}
            aria-label="Open Cart"
        >
            <div className={styles.iconContainer}>
                <ShoppingCart size={24} />
                <span className={styles.badge}>{cartCount}</span>
            </div>
        </button>
    );
};

export default FloatingCart;
