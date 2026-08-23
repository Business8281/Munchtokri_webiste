/**
 * Business constants — single source of truth for pricing rules.
 * Update here to change across the entire app.
 */

/** Orders at or above this value qualify for free shipping (in ₹) - Fallback default */
export const SHIPPING_FREE_THRESHOLD = 350;

/** Flat shipping cost when order is below the free threshold (in ₹) - Fallback default */
export const SHIPPING_RATE = 50;

/** GST rate applied to order subtotal (5%) */
export const TAX_RATE = 0.05;

/** Minimum grams required to check out a custom mix */
export const MIN_CUSTOM_MIX_GRAMS = 250;

/** Gram increment step for regular products in cart */
export const PRODUCT_STEP_GRAMS = 50;

/** Unit increment step for combo products in cart */
export const COMBO_STEP_UNITS = 1;

/** Global maximum limits for single product purchase */
export const MAX_ORDER_WEIGHT_GRAMS = 20000; // 20 Kg
export const MAX_COMBO_UNITS = 50;

/** Compute shipping cost from a subtotal */
export const getShippingCost = (subtotal: number): number =>
    subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_RATE;

/** Compute tax amount from a subtotal */
export const getTax = (subtotal: number): number =>
    Math.round(subtotal * TAX_RATE * 100) / 100;

/** Compute order total: subtotal + shipping + tax, rounded to 2dp */
export const getOrderTotal = (subtotal: number): number => {
    const shipping = getShippingCost(subtotal);
    const tax = getTax(subtotal);
    return Math.round((subtotal + shipping + tax) * 100) / 100;
};
