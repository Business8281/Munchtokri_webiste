import React from 'react';
import { Metadata } from 'next';
import ShippingClient from './ShippingClient';

export const metadata: Metadata = {
    title: 'Shipping & Delivery | MunchTokri',
    description: 'Learn about our shipping and delivery processes for Hurigalu Angadi (MunchTokri). We ensure fast and safe delivery of your snacks.',
    alternates: {
        canonical: 'https://munchtokri.com/shipping',
    },
};

export default function ShippingPolicyPage() {
    return <ShippingClient />;
}
