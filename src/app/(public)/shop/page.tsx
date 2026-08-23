import type { Metadata } from 'next';
import ShopClient from '@/components/shop/ShopClient';
import { getProducts } from '@/lib/server/data';

export const metadata: Metadata = {
    title: "Shop Authentic Karnataka Snacks Online",
    description: "Browse our collection of traditional snacks including Hurigalu, Mixtures, and roasted delicacies. Freshly made and delivered from the heart of Malleswaram.",
    alternates: {
        canonical: '/shop',
    },
};

export const revalidate = 60; // ISR each minute

export default async function ShopPage() {
    const allProducts = await getProducts();
    return <ShopClient allProducts={allProducts} />;
}
