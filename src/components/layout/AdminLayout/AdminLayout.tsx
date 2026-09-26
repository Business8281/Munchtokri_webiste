"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { adminAuth, adminDb, adminStorage, adminLogOut } from '@/lib/firebase';
import { FirebaseProvider } from '@/contexts/FirebaseContext';
import { useAdmin } from '@/contexts/AdminContext';
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
    X,
    BarChart3
} from 'lucide-react';
import styles from './AdminLayout.module.css';

const allNavItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, href: '/admin', roles: ['admin', 'manager', 'employee'] },
    { label: 'Analytics & Reports', icon: <BarChart3 size={20} />, href: '/admin/analytics', roles: ['admin', 'manager', 'employee'] },
    { label: 'Orders', icon: <ShoppingBag size={20} />, href: '/admin/orders', roles: ['admin', 'manager', 'employee'] },
    { label: 'Inventory', icon: <Package size={20} />, href: '/admin/inventory', roles: ['admin', 'manager', 'employee'] },
    { label: 'Combos', icon: <Tag size={20} />, href: '/admin/combos', roles: ['admin', 'manager', 'employee'] },
    { label: 'Customers', icon: <Users size={20} />, href: '/admin/customers', roles: ['admin', 'manager', 'employee'] },
    { label: 'Memberships', icon: <Users size={20} />, href: '/admin/memberships', roles: ['admin', 'manager', 'employee'] },
    { label: 'Coupons', icon: <Tag size={20} />, href: '/admin/coupons', roles: ['admin', 'manager', 'employee'] },
    { label: 'Store Settings', icon: <Settings size={20} />, href: '/admin/settings', roles: ['admin', 'manager', 'employee'] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading, authorized } = useAdmin();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Verifying admin access...
            </div>
        );
    }

    if (!authorized || !user) return null;

    const navItems = allNavItems.filter(item => item.roles.includes(user.role));

    // Protect routes based on role
    const isRoot = pathname === '/admin';
    const currentNavItem = allNavItems.find(item => pathname.startsWith(item.href) && item.href !== '/admin');
    
    if (!isRoot && currentNavItem && !currentNavItem.roles.includes(user.role)) {
        router.replace('/admin');
        return null;
    }

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
