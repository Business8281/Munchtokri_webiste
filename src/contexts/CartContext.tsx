"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useMemo,
    useCallback,
    ReactNode,
} from 'react';
import { PRODUCT_STEP_GRAMS, MAX_ORDER_WEIGHT_GRAMS, MAX_COMBO_UNITS } from '@/lib/constants';

export interface CartItem {
    id: string;
    name: string;
    price: number;
    category: string;
    quantity: number;
    imageURL: string;
    maxStock: number;
    /** Base weight in grams for regular items; use 1 for combo (unit-based) */
    baseWeight: number;
    products?: { name: string; grams: number; price?: number; imageURL?: string }[];
}

interface CartContextType {
    cartItems: CartItem[];
    addToCart: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
    removeFromCart: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    updateCartItem: (id: string, item: CartItem) => void;
    clearCart: () => void;
    isCartOpen: boolean;
    setIsCartOpen: (isOpen: boolean) => void;
    cartCount: number;
    cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'munchtokri_cart';

export function CartProvider({ children }: { children: ReactNode }) {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Hydrate from localStorage once on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(CART_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) setCartItems(parsed);
            }
        } catch {
            // Silently ignore — corrupt storage shouldn't break the app
        }
        setIsLoaded(true);
    }, []);

    // Persist whenever cart changes (after initial hydration)
    useEffect(() => {
        if (!isLoaded) return;
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
        } catch {
            // Silently ignore — e.g. private browsing quota exceeded
        }
    }, [cartItems, isLoaded]);

    const addToCart = useCallback(
        (item: Omit<CartItem, 'quantity'>, quantity: number) => {
            setCartItems(prev => {
                const existing = prev.find(i => i.id === item.id);
                if (existing) {
                    const merged = existing.quantity + quantity;
                    const limit = item.maxStock || (item.category === 'Combos' ? MAX_COMBO_UNITS : MAX_ORDER_WEIGHT_GRAMS);
                    return prev.map(i =>
                        i.id === item.id
                            ? { ...i, quantity: Math.min(merged, limit) }
                            : i
                    );
                }
                return [...prev, { ...item, quantity }];
            });
            setIsCartOpen(true);
        },
        []
    );

    const removeFromCart = useCallback((id: string) => {
        setCartItems(prev => prev.filter(item => item.id !== id));
    }, []);

    const updateQuantity = useCallback((id: string, quantity: number) => {
        setCartItems(prev =>
            prev.map(item => {
                if (item.id !== id) return item;
                const step = item.baseWeight || PRODUCT_STEP_GRAMS;
                const limit = item.maxStock || (item.category === 'Combos' ? MAX_COMBO_UNITS : MAX_ORDER_WEIGHT_GRAMS);
                const clamped = Math.max(step, Math.min(quantity, limit));
                return { ...item, quantity: clamped };
            })
        );
    }, []);

    const updateCartItem = useCallback((id: string, newItem: CartItem) => {
        setCartItems(prev => prev.map(item => item.id === id ? newItem : item));
    }, []);

    const clearCart = useCallback(() => {
        setCartItems([]);
    }, []);

    // Memoize derived values so consumers don't re-render on unrelated state changes
    const cartCount = useMemo(() => cartItems.length, [cartItems]);

    const cartTotal = useMemo(
        () =>
            Math.round(
                cartItems.reduce(
                    (total, item) =>
                        total + (item.price / (item.baseWeight || 100)) * item.quantity,
                    0
                ) * 100
            ) / 100,
        [cartItems]
    );

    // Memoize context value to prevent unnecessary re-renders in consumers
    const contextValue = useMemo<CartContextType>(
        () => ({
            cartItems,
            addToCart,
            removeFromCart,
            updateQuantity,
            updateCartItem,
            clearCart,
            isCartOpen,
            setIsCartOpen,
            cartCount,
            cartTotal,
        }),
        [
            cartItems,
            addToCart,
            removeFromCart,
            updateQuantity,
            updateCartItem,
            clearCart,
            isCartOpen,
            cartCount,
            cartTotal,
        ]
    );

    return (
        <CartContext.Provider value={contextValue}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
