import { Timestamp } from 'firebase/firestore';

export interface Product {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    category: string;
    stock: string;
    discount: number;
    status: string;
    isActive?: boolean;
    image?: string;
    imageURL?: string;
    imageURLs?: string[];
    description?: string;
    overview?: string;
    features?: string[];
    tags?: string;
    baseWeight?: number;
    stockStr?: string;
    avgRating?: number;
    numReviews?: number;
    isTopProduct?: boolean;
    isLimitedEdition?: boolean;
    isLimitedOffer?: boolean;
    salesCount?: number;
}

export interface ComboProduct {
    productId: string;
    name: string;
    grams: number;
    price: number;
    imageURL?: string;
    description?: string;
    category?: string;
}

export interface ComboVariant {
    id: string;
    title: string;
    grams?: number;
    originalPrice: number;
    price: number;
    status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface Combo {
    id: string;
    name: string;
    price: number;
    originalPrice: number;
    description: string;
    status: 'In Stock' | 'Low Stock' | 'Out of Stock';
    imageURLs: string[];
    imageURL: string;
    images?: string[];
    products: ComboProduct[];
    variants?: ComboVariant[];
    packSize?: number;
    packLabel?: string;
    createdAt: Timestamp | null;
}

export interface Review {
    id: string;
    productId: string;
    userId: string;
    userName: string;
    userPhoto: string;
    rating: number;
    comment: string;
    createdAt: Timestamp | null;
}

export interface OrderItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    imageURL?: string;
    baseWeight?: number;
    category?: string;
    products?: ComboProduct[];
    variant?: string;
    grams?: number;
}

export interface Order {
    id: string;
    orderNumber?: string;
    userId?: string;
    customerName: string;
    customerEmail?: string;
    status: string;
    amount: string;
    date: Timestamp | null;
    items?: OrderItem[];
    shippingDetails?: {
        mobile: string;
        address: string;
        city: string;
        state: string;
        pincode: string;
    };
    method?: {
        payment: string;
        delivery?: string;
    };
    paymentDetails?: {
        razorpayOrderId?: string;
        razorpayPaymentId?: string;
        razorpaySignature?: string;
        method?: string;
        isCod?: boolean;
        advancePaid?: number;
        codBalance?: number;
        [key: string]: any;
    };
    shiprocketOrderId?: string;
    shiprocketShipmentId?: string;
    velocityOrderId?: string;
    velocityShipmentId?: string;
    velocityAWB?: string;
    trackingId?: string;
    courierName?: string;
    couponCode?: string;
    discount?: number;
    membershipDiscount?: number;
    codPrice?: number;
    earnedPoints?: number;
    redeemedPoints?: number;
    redeemDiscount?: number;
}

export interface SavedAddress {
    id: string;
    label: string;
    fullName: string;
    mobile: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    isDefault?: boolean;
}

export interface Customer {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    addresses?: SavedAddress[];
    orderCount: number;
    totalSpent: number;
    joinedDate: Timestamp | null;
    isMember?: boolean;
    loyaltyPoints?: number;
}

export interface Membership {
    id: string; // Subscription ID or ID
    userId: string;
    userEmail?: string;
    status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'pending';
    plan_id?: string;
    planId?: string;
    planName?: string;
    subscription_id: string;
    customer_id?: string;
    current_period_end?: Timestamp | null;
    expiryDate?: Timestamp | null;
    startDate?: Timestamp | null;
    cancel_at_period_end?: boolean;
    updatedAt?: Timestamp | null;
    amount?: number;
    type?: 'razorpay' | 'manual';
}

export interface Coupon {
    id: string;
    code: string;
    discountType: 'fixed' | 'percentage';
    discountValue: number;
    minOrderValue: number;
    maxDiscount?: number;
    expiryDate: Timestamp | null;
    maxUses: number;
    usedCount: number;
    status: 'active' | 'expired' | 'disabled';
    createdAt: Timestamp | null;
}

export * from './analytics';
