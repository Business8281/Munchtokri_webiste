"use client";
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Search, User, ShoppingCart, Menu, LogOut, X } from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, logOut } from '@/lib/firebase';
import { useCart } from '@/contexts/CartContext';
import CartDrawer from '../../ui/Cart/CartDrawer';
import { tracker } from '@/lib/analytics/tracker';
import AnnouncementBar from '../AnnouncementBar/AnnouncementBar';
import styles from './Navbar.module.css';

const Navbar = () => {
    const [user, setUser] = React.useState<FirebaseUser | null>(null);
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const { cartCount, setIsCartOpen } = useCart();
    const pathname = usePathname();
    const isDashboard = pathname === '/dashboard';
    const [isDashboardMenuOpen, setIsDashboardMenuOpen] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    React.useEffect(() => {
        setMounted(true);
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        // Listen for dashboard menu state changes to keep icon in sync
        const handleStateChange = (e: any) => {
            if (e.detail !== undefined) {
                setIsDashboardMenuOpen(e.detail);
            }
        };

        window.addEventListener('munchtokri:dashboardMenuState', handleStateChange);
        
        return () => {
            unsubscribe();
            window.removeEventListener('munchtokri:dashboardMenuState', handleStateChange);
        };
    }, []);

    // Lock scroll when mobile menu is open
    React.useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        } else {
            // Only unset if cart is not also open (though cart and menu probably shouldn't be open at same time)
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [isMenuOpen]);

    // Close menu when clicking a link
    const handleNavLinkClick = () => setIsMenuOpen(false);

    return (
        <header className={styles.header}>
            <AnnouncementBar />
            <nav className={styles.navbar}>
                <div className={`${styles.container} container`}>
                    <div className={styles.logo}>
                    <Link href="/">
                        <div className={styles.logoWrapper}>
                            <Image
                                src="/MTLogoBR.png"
                                alt="Munch Tokri Logo"
                                width={69}
                                height={60}
                                className={styles.logoImage}
                                priority
                                style={{ width: 'auto', height: 'auto' }}
                            />
                        </div>
                    </Link>
                </div>

                <div className={`${styles.navLinks} ${isMenuOpen ? styles.active : ''} ${isDashboard ? styles.dashboardHidden : ''}`}>
                    <Link href="/shop" className={styles.navLink} onClick={() => { tracker.track('nav_click', { link: 'Shop', href: '/shop' }); handleNavLinkClick(); }}>Shop</Link>
                    <Link href="/combos" className={styles.navLink} onClick={() => { tracker.track('nav_click', { link: 'Combos', href: '/combos' }); handleNavLinkClick(); }}>Combos</Link>
                    <Link href="/build-mixture" className={styles.navLink} onClick={() => { tracker.track('nav_click', { link: 'Build your Mix', href: '/build-mixture' }); handleNavLinkClick(); }}>Build your Mix</Link>
                    <Link href="/membership" className={styles.navLink} onClick={() => { tracker.track('nav_click', { link: 'Membership', href: '/membership' }); handleNavLinkClick(); }}>Membership</Link>
                    <Link href="/about" className={styles.navLink} onClick={() => { tracker.track('nav_click', { link: 'About', href: '/about' }); handleNavLinkClick(); }}>About</Link>
                    <Link href="/vendor" className={styles.navLink} onClick={() => { tracker.track('nav_click', { link: 'Vendor', href: '/vendor' }); handleNavLinkClick(); }}>Vendor</Link>
                    <Link href="/contact" className={styles.navLink} onClick={() => { tracker.track('nav_click', { link: 'Contact', href: '/contact' }); handleNavLinkClick(); }}>Contact</Link>
                </div>

                <div className={styles.actions}>

                    {user ? (
                        <div className={styles.userSection}>
                            <Link href="/dashboard" className={styles.avatar} title="My Dashboard" onClick={() => { tracker.track('nav_click', { link: 'Dashboard', href: '/dashboard' }); handleNavLinkClick(); }}>
                                <span>{user.displayName?.[0]?.toUpperCase() || user.email?.[0].toUpperCase()}</span>
                            </Link>
                        </div>
                    ) : (
                        <Link href="/login" className={styles.actionIcon} title="Sign In" onClick={() => { tracker.track('nav_click', { link: 'Sign In', href: '/login' }); handleNavLinkClick(); }}>
                            <User size={22} />
                        </Link>
                    )}

                    <button
                        className={styles.actionIcon}
                        onClick={() => {
                            tracker.track('cart_open', { cartCount });
                            setIsCartOpen(true);
                            handleNavLinkClick();
                        }}
                        title="View Cart"
                    >
                        <ShoppingCart size={22} />
                        {mounted && cartCount > 0 && (
                            <span className={styles.badge}>{cartCount}</span>
                        )}
                    </button>
                    <button 
                        className={styles.mobileMenu} 
                        onClick={() => {
                            if (isDashboard) {
                                // Dispatch event to Dashboard component
                                window.dispatchEvent(new CustomEvent('munchtokri:toggleDashboardMenu'));
                            } else {
                                toggleMenu();
                            }
                        }} 
                        aria-label="Toggle Menu"
                    >
                        {isDashboard 
                            ? (isDashboardMenuOpen ? <X size={24} /> : <Menu size={24} />)
                            : (isMenuOpen ? <X size={24} /> : <Menu size={24} />)
                        }
                    </button>
                </div>
                </div>
            </nav>
            <CartDrawer />
        </header>
    );
};

export default Navbar;
