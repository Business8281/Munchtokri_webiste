import { collection, getDocs, orderBy, query, limit, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Product, Combo } from "@/types";

export async function getProducts(): Promise<Product[]> {
    try {
        const q = query(collection(db, "products"), orderBy("name"));
        const snapshot = await getDocs(q);
        
        // Fetch all reviews for aggregation
        const reviewsSnapshot = await getDocs(collection(db, "reviews"));
        const allReviews = reviewsSnapshot.docs.map(d => d.data());

        return snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            
            // Robust review matching
            const productReviews = allReviews.filter(r => {
                const rId = r.productId || r.productID;
                if (!rId || !docSnap.id) return false;
                return String(rId).trim() === String(docSnap.id).trim();
            });

            const numReviews = productReviews.length;
            let avgRating = 0;
            
            if (numReviews > 0) {
                const sum = productReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
                avgRating = Math.round((sum / numReviews) * 10) / 10;
            }

            return {
                id: docSnap.id,
                ...data,
                avgRating: numReviews > 0 ? avgRating : (data.avgRating || 0),
                numReviews: numReviews,
                createdAt: data.createdAt ? {
                    seconds: data.createdAt.seconds,
                    nanoseconds: data.createdAt.nanoseconds
                } : null,
            } as unknown as Product;
        });
    } catch (error) {
        console.error("Error fetching products on server:", error);
        return [];
    }
}

export async function getFeaturedProducts(count: number): Promise<Product[]> {
    try {
        const q = query(collection(db, "products"), orderBy("name"), limit(count));
        const snapshot = await getDocs(q);

        // Fetch all reviews for aggregation
        const reviewsSnapshot = await getDocs(collection(db, "reviews"));
        const allReviews = reviewsSnapshot.docs.map(d => d.data());

        return snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            
            // Robust review matching
            const productReviews = allReviews.filter(r => {
                const rId = r.productId || r.productID;
                if (!rId || !docSnap.id) return false;
                return String(rId).trim() === String(docSnap.id).trim();
            });

            const numReviews = productReviews.length;
            let avgRating = 0;
            
            if (numReviews > 0) {
                const sum = productReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
                avgRating = Math.round((sum / numReviews) * 10) / 10;
            }

            return {
                id: docSnap.id,
                ...data,
                avgRating: numReviews > 0 ? avgRating : (data.avgRating || 0),
                numReviews: numReviews,
                createdAt: data.createdAt ? {
                    seconds: data.createdAt.seconds,
                    nanoseconds: data.createdAt.nanoseconds
                } : null,
            } as unknown as Product;
        });
    } catch (error) {
        console.error("Error fetching featured products on server:", error);
        return [];
    }
}

export async function getCombos(): Promise<Combo[]> {
    try {
        const q = query(collection(db, "combos"), orderBy("name"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt ? {
                    seconds: data.createdAt.seconds,
                    nanoseconds: data.createdAt.nanoseconds
                } : null,
            } as unknown as Combo;
        });
    } catch (error) {
        console.error("Error fetching combos on server:", error);
        return [];
    }
}

export async function getCombo(id: string): Promise<Combo | null> {
    try {
        const docRef = doc(db, "combos", id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt ? {
                seconds: data.createdAt.seconds,
                nanoseconds: data.createdAt.nanoseconds
            } : null,
        } as unknown as Combo;
    } catch (error) {
        console.error("Error fetching combo on server:", error);
        return null;
    }
}
