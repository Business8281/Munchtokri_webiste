"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { adminAuth, adminDb, adminStorage, adminLogOut } from '@/lib/firebase';
import { FirebaseProvider } from '@/contexts/FirebaseContext';
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
    Settings,
    Tag,
    Package,
    Home,
    LogOut as LogOutIcon,
    Menu,
    X
} from 'lucide-react';
import styles from './AdminLayout.module.css';

const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, href: '/admin' },
    { label: 'Orders', icon: <ShoppingBag size={20} />, href: '/admin/orders' },
    { label: 'Inventory', icon: <Package size={20} />, href: '/admin/inventory' },
    { label: 'Combos', icon: <Tag size={20} />, href: '/admin/combos' },
    { label: 'Customers', icon: <Users size={20} />, href: '/admin/customers' },
    { label: 'Memberships', icon: <Users size={20} />, href: '/admin/memberships' },
    { label: 'Coupons', icon: <Tag size={20} />, href: '/admin/coupons' },
    { label: 'Store Settings', icon: <Settings size={20} />, href: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(adminAuth, async (user) => {
            if (user && user.email) {
                const normalizedEmail = user.email.toLowerCase().trim();

                // Check by document ID (email as doc ID)
                const adminDoc = await getDoc(doc(adminDb, 'admins', normalizedEmail));
                let isAuthorized = adminDoc.exists();

                // Fallback: check by email field
                if (!isAuthorized) {
                    const q = query(
                        collection(adminDb, 'admins'),
                        where('email', '==', normalizedEmail)
                    );
                    const querySnapshot = await getDocs(q);
                    isAuthorized = !querySnapshot.empty;
                }

                if (isAuthorized) {
                    setAuthorized(true);
                } else {
                    router.replace('/admin/login');
                }
            } else {
                router.replace('/admin/login');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Verifying admin access...
            </div>
        );
    }

    if (!authorized) return null;

    return (
        <FirebaseProvider 
            authInstance={adminAuth} 
            dbInstance={adminDb}
            storageInstance={adminStorage}
        >
            <div className={styles.adminContainer}>
                {isSidebarOpen && (
                    <div className={styles.overlay} onClick={() => setIsSidebarOpen(false)} />
                )}

                <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
                    <div className={styles.sidebarHeader}>
                        <div className={styles.logoWrapper}>
                            <Image
                                src="/logo.png"
                                alt="Munch Tokri Logo"
                                width={69}
                                height={60}
                                className={styles.logoImage}
                            />
                        </div>
                        <p>Admin Control</p>
                    </div>

                    <nav className={styles.nav}>
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
                                onClick={() => setIsSidebarOpen(false)}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    <div className={styles.sidebarFooter}>
                        <Link href="/" className={styles.backHome}>
                            <Home size={18} />
                            <span>Back to Public Site</span>
                        </Link>
                        <button onClick={adminLogOut} className={styles.logoutBtn}>
                            <LogOutIcon size={18} />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </aside>

                <div className={styles.contentArea}>
                    <header className={styles.header}>
                        <button className={styles.menuToggle} onClick={toggleSidebar}>
                            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                        <div className={styles.search}>
                            <Image
                                src="/MTLogoBR.svg"
                                alt="Search"
                                width={18}
                                height={18}
                                className={styles.searchIcon}
                            />
                            <input type="text" placeholder="Search orders, products, etc..." />
                        </div>
                        <div className={styles.profile}>
                            <span>Admin</span>
                            <div className={styles.avatar}>
                                {adminAuth.currentUser?.email?.[0].toUpperCase() ?? 'A'}
                            </div>
                        </div>
                    </header>
                    <main className={styles.main}>{children}</main>
                </div>
            </div>
        </FirebaseProvider>
    );
}
