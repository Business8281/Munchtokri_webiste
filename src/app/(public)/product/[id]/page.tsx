import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ProductDetailsClient from './ProductDetailsClient';

export const revalidate = 60; // ISR each minute

// For Next.js static export
export async function generateStaticParams() {
    try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id
        }));
    } catch (error) {
        console.error("Error generating static params for products:", error);
        return [];
    }
}

export default async function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <ProductDetailsClient productId={id} />;
}
