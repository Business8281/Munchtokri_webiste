"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { adminAuth, adminDb } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export type AdminRole = 'admin' | 'manager' | 'employee';

export interface AdminUserData {
    email: string;
    role: AdminRole;
    name?: string;
    [key: string]: any;
}

interface AdminContextType {
    user: AdminUserData | null;
    loading: boolean;
    authorized: boolean;
}

const AdminContext = createContext<AdminContextType>({
    user: null,
    loading: true,
    authorized: false,
});

export const useAdmin = () => useContext(AdminContext);

export const AdminProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AdminUserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(adminAuth, async (authUser) => {
            if (authUser && authUser.email) {
                const normalizedEmail = authUser.email.toLowerCase().trim();

                // Check by document ID (email as doc ID)
                let adminDocSnap = await getDoc(doc(adminDb, 'admins', normalizedEmail));
                let isAuthorized = adminDocSnap.exists();
                let adminData = adminDocSnap.data();

                // Fallback: check by email field
                if (!isAuthorized) {
                    const q = query(
                        collection(adminDb, 'admins'),
                        where('email', '==', normalizedEmail)
                    );
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        isAuthorized = true;
                        adminData = querySnapshot.docs[0].data();
                    }
                }

                if (isAuthorized && adminData) {
                    const role: AdminRole = adminData.role || 'admin'; // Default to admin if no role is set
                    setUser({
                        email: normalizedEmail,
                        role,
                        name: adminData.name,
                    });
                    setAuthorized(true);
                } else {
                    setUser(null);
                    setAuthorized(false);
                    router.replace('/admin/login');
                }
            } else {
                setUser(null);
                setAuthorized(false);
                router.replace('/admin/login');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    return (
        <AdminContext.Provider value={{ user, loading, authorized }}>
            {children}
        </AdminContext.Provider>
    );
};
