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

/**
 * Sorts combo variants / pack options strictly from low to high.
 * Evaluates pack count in title (e.g., "Pack of 1" -> 1), grams weight, and offer price.
 */
export function sortComboVariantsLowToHigh<T extends { title?: string; grams?: number; price?: number; originalPrice?: number }>(
    variants?: T[] | null
): T[] {
    if (!variants || variants.length <= 1) return variants ? [...variants] : [];

    return [...variants].sort((a, b) => {
        // 1. Extract pack number from title (e.g. "Pack of 1", "Pack 2", "Pack of 4")
        const numA = (a.title?.match(/\d+/)?.[0]) ? parseInt(a.title.match(/\d+/)![0], 10) : null;
        const numB = (b.title?.match(/\d+/)?.[0]) ? parseInt(b.title.match(/\d+/)![0], 10) : null;

        if (numA !== null && numB !== null && numA !== numB) {
            return numA - numB;
        }

        // 2. Compare grams if specified
        const gramsA = Number(a.grams) || 0;
        const gramsB = Number(b.grams) || 0;
        if (gramsA > 0 && gramsB > 0 && gramsA !== gramsB) {
            return gramsA - gramsB;
        }

        // 3. Compare offer price (low to high)
        const priceA = Number(a.price) || 0;
        const priceB = Number(b.price) || 0;
        if (priceA !== priceB) {
            return priceA - priceB;
        }

        // 4. Compare original price
        const origA = Number(a.originalPrice) || 0;
        const origB = Number(b.originalPrice) || 0;
        return origA - origB;
    });
}

