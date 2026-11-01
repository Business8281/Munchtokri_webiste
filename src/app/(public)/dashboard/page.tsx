"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, logOut, db as defaultDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useOrders, updateCustomerProfile, useCustomer } from '@/hooks/useFirestore';
import { formatOrderDate } from '@/lib/analytics/engine';
import Link from 'next/link';
import { Suspense } from 'react';
import {
    LayoutDashboard,
    UserCircle,
    Package,
    Heart,
    MapPin,
    LogOut,
    ShoppingBag,
    Truck,
    CheckCircle,
    Clock,
    ShoppingCart,
    Star,
    ChevronDown,
    XCircle,
    RotateCcw,
    RefreshCw,
    Undo,
    HelpCircle,
    Menu,
    X,
    CreditCard,
    CheckCircle2,
    Calendar,
    Zap
} from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';
import styles from './dashboard.module.css';
import { useMembership } from '@/hooks/useFirestore';
import MembershipCard from '@/components/membership/MembershipCard';
import { SavedAddress } from '@/types';

interface UserData {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    joinedDate: any;
    orderCount: number;
    totalSpent: string;
}

// Ensure lucide icon sizes match the design (e.g., 20)
const iconSize = 20;

function DashboardContent() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const { showNotification, showConfirm } = useNotification();

    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'membership'>('orders');

    // Handle tab switching from query params
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'membership') {
            setActiveTab('membership');
        } else if (tab === 'orders') {
            setActiveTab('orders');
        } else if (tab === 'profile') {
            setActiveTab('profile');
        }
    }, [searchParams]);

    // Profile Form State
    const [editMode, setEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState({ text: '', type: '' });
    
    // Address Book State
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [addressFormData, setAddressFormData] = useState<SavedAddress>({
        id: '',
        label: 'Home',
        fullName: '',
        mobile: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        isDefault: false
    });
    
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);

    // Sync menu state with Navbar
    useEffect(() => {
        const syncState = () => {
            window.dispatchEvent(new CustomEvent('munchtokri:dashboardMenuState', {
                detail: isMobileMenuOpen
            }));
        };

        syncState();

        const handleRemoteToggle = () => {
            toggleMobileMenu();
        };

        window.addEventListener('munchtokri:toggleDashboardMenu', handleRemoteToggle);
        
        return () => {
            window.removeEventListener('munchtokri:toggleDashboardMenu', handleRemoteToggle);
        };
    }, [isMobileMenuOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (activeDropdown && !(event.target as Element).closest(`.${styles.dropdownContainer}`)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    const [profileFormData, setProfileFormData] = useState({
        name: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
    });

    const [siteMembershipConfig, setSiteMembershipConfig] = useState<any>(null);

    // Fetch site membership config for live benefits
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const snap = await getDoc(doc(defaultDb, 'settings', 'membership'));
                if (snap.exists()) {
                    setSiteMembershipConfig(snap.data());
                }
            } catch (err) {
                console.error("Error fetching membership config:", err);
            }
        };
        fetchConfig();
    }, []);

    // Fetch user profile and orders real-time
    const { customer: realtimeUserData } = useCustomer(user ? user.uid : null);
    const { membership, loading: membershipLoading } = useMembership(user ? user.uid : null);
    const { orders, loading: ordersLoading, error: ordersError, updateOrderStatus } = useOrders(user ? user.uid : null);

    // Sync form with live realtimeUserData when it loads/changes, but ONLY if not in edit mode
    useEffect(() => {
        if (realtimeUserData && !editMode) {
            setProfileFormData({
                name: realtimeUserData.name || user?.displayName || '',
                phone: realtimeUserData.phone || user?.phoneNumber || '',
                address: realtimeUserData.address || '',
                city: realtimeUserData.city || '',
                state: realtimeUserData.state || '',
                pincode: realtimeUserData.pincode || ''
            });
        }
    }, [realtimeUserData, editMode, user]);

    // Get the most recent active order
    const defaultActiveOrder = orders.length > 0 ? orders[0] : null;

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                router.push('/login');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    if (loading) {
        return (
            <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
                <p>Preparing your experience...</p>
            </div>
        );
    }

    if (!user) return null;

    const handleSaveAddress = async () => {
        if (!user || !realtimeUserData) return;
        setIsSaving(true);
        setSaveMessage({ text: '', type: '' });
        
        try {
            const newAddresses = [...(realtimeUserData.addresses || [])];
            
            // If setting as default, remove default from others
            if (addressFormData.isDefault) {
                newAddresses.forEach(a => a.isDefault = false);
            }
            
            if (editingAddressId) {
                const index = newAddresses.findIndex(a => a.id === editingAddressId);
                if (index !== -1) newAddresses[index] = { ...addressFormData };
            } else {
                newAddresses.push({
                    ...addressFormData,
                    id: Date.now().toString()
                });
            }
            
            // If it's the only address, make it default
            if (newAddresses.length === 1) {
                newAddresses[0].isDefault = true;
            }
            
            await updateCustomerProfile(user.uid, { addresses: newAddresses });
            setSaveMessage({ text: 'Address saved successfully!', type: 'success' });
            setIsAddressModalOpen(false);
            
            setTimeout(() => setSaveMessage({ text: '', type: '' }), 3000);
        } catch (error) {
            console.error("Failed to save address:", error);
            setSaveMessage({ text: 'Failed to save address.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteAddress = async (id: string) => {
        if (!user || !realtimeUserData) return;
        if (!window.confirm("Are you sure you want to delete this address?")) return;
        
        try {
            const newAddresses = (realtimeUserData.addresses || []).filter(a => a.id !== id);
            await updateCustomerProfile(user.uid, { addresses: newAddresses });
            setSaveMessage({ text: 'Address deleted.', type: 'success' });
            setTimeout(() => setSaveMessage({ text: '', type: '' }), 3000);
        } catch (error) {
            console.error("Failed to delete address:", error);
            setSaveMessage({ text: 'Failed to delete address.', type: 'error' });
        }
    };

    const handleProfileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProfileFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveProfile = async () => {
        if (!user) return;
        setIsSaving(true);
        setSaveMessage({ text: '', type: '' });

        try {
            await updateCustomerProfile(user.uid, {
                name: profileFormData.name,
                phone: profileFormData.phone,
                address: profileFormData.address,
                city: profileFormData.city,
                state: profileFormData.state,
                pincode: profileFormData.pincode
            });

            setSaveMessage({ text: 'Profile updated successfully!', type: 'success' });
            setEditMode(false);

            // Clear success message after 3 seconds
            setTimeout(() => {
                setSaveMessage({ text: '', type: '' });
            }, 3000);

        } catch (error) {
            console.error("Failed to save profile:", error);
            setSaveMessage({ text: 'Failed to update profile. Please try again.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const firstName = user.displayName?.split(' ')[0] || realtimeUserData?.name?.split(' ')[0] || profileFormData.name?.split(' ')[0] || 'Friend';
    const fullName = user.displayName || realtimeUserData?.name || profileFormData.name || 'Valued Customer';

    // Determine profile visual
    const profileBg = user.photoURL ? { backgroundImage: `url(${user.photoURL})` } : {};
    const initial = !user.photoURL ? firstName[0].toUpperCase() : '';

    // Determine active order step for stepper visualization
    const getOrderStep = (status: string) => {
        switch (status) {
            case 'Processing': return 1;
            case 'Prepared': return 2;
            case 'Dispatched': return 3;
            case 'Delivered': return 4;
            case 'Cancelled': return 0;
            case 'Refund Requested': return 0;
            case 'Replacement Requested': return 2;
            case 'Return Requested': return 5;
            case 'Returned': return 6;
            default: return 1;
        }
    };

    const handleOrderAction = async (orderId: string, status: string) => {
        try {
            await updateOrderStatus(orderId, status);
            setIsActionModalOpen(false);
            setSelectedOrderId(null);
            showNotification(`Your request for ${status} has been submitted successfully.`, 'success', { title: 'Action Submitted' });
        } catch (error) {
            console.error("Failed to update order status:", error);
            showNotification("Failed to submit request. Please try again.", 'error', { title: 'Submission Error' });
        }
    };

    const activeStep = defaultActiveOrder ? getOrderStep(defaultActiveOrder.status) : 0;

    return (
        <div className={styles.dashboardContainer}>
            {/* Overlay for mobile menu */}
            {isMobileMenuOpen && (
                <div className={styles.overlay} onClick={() => setIsMobileMenuOpen(false)}></div>
            )}

            {/* Sidebar Navigation */}
            <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarContent}>

                    {/* User Profile Summary */}
                    <div className={styles.userSummary}>
                        <div className={styles.userAvatarWrapper}>
                            <div className={styles.userAvatar} style={profileBg}>
                                {initial}
                            </div>
                            <div className={styles.statusDot}></div>
                        </div>
                        <div className={styles.userInfo}>
                            <h3>{fullName}</h3>
                            <p>{membership?.status === 'active' ? 'Club Member' : 'Free Account'}</p>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <nav className={styles.navLinks}>
                        <button onClick={() => { setActiveTab('orders'); setIsMobileMenuOpen(false); }} className={`${styles.navLink} ${activeTab === 'orders' ? styles.navLinkActive : styles.navLinkInactive}`}>
                            <Package size={iconSize} />
                            <span>My Orders</span>
                        </button>
                        <button onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }} className={`${styles.navLink} ${activeTab === 'profile' ? styles.navLinkActive : styles.navLinkInactive}`}>
                            <UserCircle size={iconSize} />
                            <span>Profile Info</span>
                        </button>
                        <button onClick={() => { setActiveTab('membership'); setIsMobileMenuOpen(false); }} className={`${styles.navLink} ${activeTab === 'membership' ? styles.navLinkActive : styles.navLinkInactive}`}>
                            <CreditCard size={iconSize} />
                            <span>My Membership</span>
                        </button>
                    </nav>

                    {/* Logout */}
                    <div className={styles.logoutSection}>
                        <button onClick={logOut} className={styles.logoutLink}>
                            <LogOut size={iconSize} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </aside>


            {/* Main Content Area */}
            <main className={styles.mainContent}>
                {/* Header */}
                <header className={styles.header}>
                    <div>
                        <h1>Namaste, {firstName}</h1>
                        <p>Here&apos;s what&apos;s happening with your Munch Tokri favorites today.</p>
                    </div>
                    <button onClick={() => router.push('/shop')} className={styles.shopBtn}>
                        <ShoppingBag size={18} />
                        Shop New Arrivals
                    </button>
                </header>

                <div className={styles.statsRow}>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'rgba(0, 128, 128, 0.1)', color: 'var(--primary)' }}>
                            <Package size={20} />
                        </div>
                        <div>
                            <p className={styles.statLabel}>Total Orders</p>
                            <h4 className={styles.statValue}>{orders.length}</h4>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'rgba(244, 180, 26, 0.1)', color: 'var(--accent)' }}>
                            <Zap size={20} fill="currentColor" />
                        </div>
                        <div>
                            <p className={styles.statLabel}>Munch Coins</p>
                            <h4 className={styles.statValue}>{(realtimeUserData?.loyaltyPoints || 0).toLocaleString()}</h4>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                            <CreditCard size={20} />
                        </div>
                        <div>
                            <p className={styles.statLabel}>Membership</p>
                            <h4 className={styles.statValue} style={{ fontSize: '1rem' }}>{membership?.status === 'active' ? 'Royal Member' : 'Guest'}</h4>
                        </div>
                    </div>
                </div>

                {activeTab === 'orders' && (
                    <section style={{ marginBottom: '3rem' }}>
                        <div className={styles.sectionTitleRow}>
                            <h2 className={styles.sectionTitle}>
                                <Package size={20} />
                                My Orders
                            </h2>
                        </div>
                        {ordersLoading ? (
                            <p>Loading your orders...</p>
                        ) : ordersError ? (
                            <p className={styles.emptyStateText}>Unable to load orders at this time.</p>
                        ) : orders.length === 0 ? (
                            <div className={styles.emptyStateCard} style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
                                <Package size={48} style={{ color: '#94a3b8', margin: '0 auto 1rem' }} />
                                <h3 style={{ margin: '0 0 0.5rem', color: '#1e293b' }}>No orders yet</h3>
                                <p style={{ margin: '0 0 1.5rem', color: '#64748b' }}>Start exploring our traditional snacks!</p>
                                <button onClick={() => router.push('/shop')} className={styles.shopBtn} style={{ margin: '0 auto', display: 'inline-flex' }}>
                                    Start Shopping
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {orders.map(order => (
                                    <div key={order.id} className={styles.orderPreviewCard} style={{ flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                                                <div>
                                                    <span className={styles.statusBadge} style={{ 
                                                        backgroundColor: order.status === 'Cancelled' ? '#fee2e2' : order.status === 'Return Requested' ? '#fef3c7' : undefined,
                                                        color: order.status === 'Cancelled' ? '#991b1b' : order.status === 'Return Requested' ? '#92400e' : undefined
                                                    }}>
                                                        {order.status}
                                                    </span>
                                                    <h3 style={{ margin: '0.5rem 0' }}>Order {order.orderNumber ? `#${order.orderNumber}` : `#${order.id?.slice(-6).toUpperCase()}`}</h3>
                                                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Placed on {formatOrderDate(order.date || (order as any).createdAt)} • Total: {order.amount}</p>
                                                    
                                                    {order.method?.payment && (
                                                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                                                            <strong>Payment:</strong> {order.method.payment}
                                                        </p>
                                                    )}
                                                </div>
                                                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {(['Processing', 'Prepared', 'Dispatched', 'Delivered'].includes(order.status)) && (
                                                        <div className={styles.dropdownContainer}>
                                                            <button 
                                                                className={styles.dropdownBtn}
                                                                onClick={() => setActiveDropdown(activeDropdown === order.id ? null : order.id)}
                                                            >
                                                                Actions <ChevronDown size={16} />
                                                            </button>
                                                            
                                                            {activeDropdown === order.id && (
                                                                <div className={styles.dropdownMenu}>
                                                                    <button 
                                                                        className={styles.dropdownItem}
                                                                        onClick={() => {
                                                                            setSelectedOrderId(order.id);
                                                                            setIsActionModalOpen(true);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                    >
                                                                        <HelpCircle size={16} /> Manage Order
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        <div style={{ padding: '0 1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                            <div>
                                                <h4 style={{ marginBottom: '1rem', color: '#334155' }}>Items</h4>
                                                {order.items && order.items.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                        {order.items.map((item, idx) => {
                                                            const renderItemName = (name: string, products?: any[]) => {
                                                                if (name.startsWith('Custom Mix (')) {
                                                                    const match = name.match(/Custom Mix \((.*)\)/);
                                                                    if (match && match[1]) {
                                                                        const ingredients = match[1].split(', ');
                                                                        return (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Custom Mix</p>
                                                                                <div style={{ paddingLeft: '0.5rem', borderLeft: '2px solid #0d9488' }}>
                                                                                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', fontWeight: 600, color: '#0f766e' }}>Ingredients:</p>
                                                                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#475569', fontSize: '0.8rem', lineHeight: 1.4 }}>
                                                                                        {ingredients.map((ing, i) => (
                                                                                            <li key={i}><span style={{ color: '#0d9488', fontWeight: 'bold' }}>• </span>{ing}</li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }
                                                                }
                                                                if (products && products.length > 0) {
                                                                    return (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{name}</p>
                                                                            <div style={{ marginTop: '0.2rem', paddingLeft: '0.5rem', borderLeft: '2px solid #0d9488' }}>
                                                                                <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', fontWeight: 700, color: '#0f766e' }}>
                                                                                    🎁 Pack of {products.length} includes:
                                                                                </p>
                                                                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#334155', fontSize: '0.8rem', lineHeight: 1.5 }}>
                                                                                    {products.map((p: any, i: number) => (
                                                                                        <li key={i} style={{ marginBottom: '0.15rem' }}>
                                                                                            <span style={{ color: '#0d9488', fontWeight: 'bold' }}>• </span>
                                                                                            <span style={{ fontWeight: 600 }}>{p.name}</span>{' '}
                                                                                            <span style={{ color: '#64748b' }}>({p.grams}g)</span>
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                return <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{name}</p>;
                                                            };

                                                            return (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
                                                                    {item.imageURL ? (
                                                                        <img src={item.imageURL} alt={item.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '0.25rem', marginTop: '0.25rem' }} />
                                                                    ) : (
                                                                        <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0.25rem' }}>
                                                                            <ShoppingBag size={18} color="#94a3b8" />
                                                                        </div>
                                                                    )}
                                                                    <div style={{ flex: 1 }}>
                                                                        {renderItemName(item.name, (item as any).products)}
                                                                        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>
                                                                            {(() => {
                                                                                const cat = (item as any).category?.toLowerCase();
                                                                                const isCombo = cat === 'combos' || cat === 'combo' || item.baseWeight === 1;
                                                                                const isCustomMix = cat === 'custom mix' || item.name.startsWith('Custom Mix (');
                                                                                const comboGrams = (item as any).grams || ((item as any).products ? (item as any).products.reduce((s: number, p: any) => s + (Number(p.grams) || 0), 0) : 0);
                                                                                const comboQtyStr = comboGrams > 0 ? `${item.quantity} Pack(s) (${comboGrams * item.quantity}g)` : `${item.quantity} Pack(s)`;
                                                                                return isCombo && !isCustomMix ? comboQtyStr : isCustomMix ? `${item.quantity}g` : `${item.quantity / (item.baseWeight || 100)} (${item.quantity}g)`;
                                                                            })()} • ₹{((item.price * item.quantity) / (item.baseWeight || 100)).toFixed(2)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No detailed items recorded.</p>
                                                )}
                                            </div>
                                            
                                            {order.shippingDetails && (
                                                <div>
                                                    <h4 style={{ marginBottom: '1rem', color: '#334155' }}>Shipping Address</h4>
                                                    <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
                                                        <p style={{ margin: 0, fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>{order.customerName}</p>
                                                        <p style={{ margin: 0 }}>{order.shippingDetails.address}</p>
                                                        <p style={{ margin: 0 }}>{order.shippingDetails.city}, {order.shippingDetails.state} {order.shippingDetails.pincode}</p>
                                                        <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>Mobile: {order.shippingDetails.mobile}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'profile' && (
                    <section style={{ marginBottom: '3rem' }}>
                        <div className={styles.sectionTitleRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
                                <UserCircle size={20} />
                                Profile Information
                            </h2>
                            {!editMode ? (
                                <button
                                    onClick={() => setEditMode(true)}
                                    style={{ padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    Edit Profile
                                </button>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => {
                                            setEditMode(false);
                                            // Reset form to saved data
                                            setProfileFormData({
                                                name: realtimeUserData?.name || user.displayName || '',
                                                phone: realtimeUserData?.phone || user.phoneNumber || '',
                                                address: realtimeUserData?.address || '',
                                                city: realtimeUserData?.city || '',
                                                state: realtimeUserData?.state || '',
                                                pincode: realtimeUserData?.pincode || ''
                                            });
                                        }}
                                        style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveProfile}
                                        style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 500, opacity: isSaving ? 0.7 : 1 }}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {saveMessage.text && (
                            <div style={{ padding: '1rem', marginBottom: '1.5rem', borderRadius: '0.5rem', backgroundColor: saveMessage.type === 'success' ? '#f0fdf4' : '#fef2f2', color: saveMessage.type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${saveMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
                                {saveMessage.text}
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                            <div className={styles.orderPreviewCard} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', width: '100%', borderBottom: '1px solid #e2e8f0', paddingBottom: '2rem' }}>
                                    <div className={styles.userAvatar} style={{ ...profileBg, width: '100px', height: '100px', fontSize: '2.5rem' }}>
                                        {initial}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        {editMode ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '300px' }}>
                                                <label style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>Full Name</label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={profileFormData.name}
                                                    onChange={handleProfileInputChange}
                                                    style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', width: '100%' }}
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.8rem', color: '#1e293b' }}>{fullName}</h2>
                                                <p style={{ margin: 0, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span className={styles.badge} style={{ backgroundColor: '#f0fdf4', color: '#166534' }}>
                                                        <Star size={14} style={{ marginRight: '0.25rem' }} /> Active Member
                                                    </span>
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

                                    {/* Email (Always Read-Only) */}
                                    <div>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Email Address</p>
                                        <p style={{ fontWeight: 500, color: '#94a3b8' }}>{user.email || 'Not provided'}</p>
                                    </div>

                                    {/* Phone Number */}
                                    <div>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Phone Number</p>
                                        {editMode ? (
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={profileFormData.phone}
                                                onChange={handleProfileInputChange}
                                                style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', width: '100%' }}
                                                placeholder="+91"
                                            />
                                        ) : (
                                            <p style={{ fontWeight: 500, color: '#334155' }}>{realtimeUserData?.phone || user.phoneNumber || 'Not provided'}</p>
                                        )}
                                    </div>

                                    {/* Street Address */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Street Address</p>
                                        {editMode ? (
                                            <input
                                                type="text"
                                                name="address"
                                                value={profileFormData.address}
                                                onChange={handleProfileInputChange}
                                                style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', width: '100%' }}
                                                placeholder="Flat / House No. / Building"
                                            />
                                        ) : (
                                            <p style={{ fontWeight: 500, color: '#334155' }}>{realtimeUserData?.address || 'Not provided'}</p>
                                        )}
                                    </div>

                                    {/* City & State */}
                                    <div>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>City</p>
                                        {editMode ? (
                                            <input
                                                type="text"
                                                name="city"
                                                value={profileFormData.city}
                                                onChange={handleProfileInputChange}
                                                style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', width: '100%' }}
                                                placeholder="City"
                                            />
                                        ) : (
                                            <p style={{ fontWeight: 500, color: '#334155' }}>{realtimeUserData?.city || 'Not provided'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>State</p>
                                        {editMode ? (
                                            <input
                                                type="text"
                                                name="state"
                                                value={profileFormData.state}
                                                onChange={handleProfileInputChange}
                                                style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', width: '100%' }}
                                                placeholder="State"
                                            />
                                        ) : (
                                            <p style={{ fontWeight: 500, color: '#334155' }}>{realtimeUserData?.state || 'Not provided'}</p>
                                        )}
                                    </div>

                                    {/* Pincode & Meta */}
                                    <div>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Pincode</p>
                                        {editMode ? (
                                            <input
                                                type="text"
                                                name="pincode"
                                                value={profileFormData.pincode}
                                                onChange={handleProfileInputChange}
                                                style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', width: '100%' }}
                                                placeholder="e.g. 560001"
                                            />
                                        ) : (
                                            <p style={{ fontWeight: 500, color: '#334155' }}>{realtimeUserData?.pincode || 'Not provided'}</p>
                                        )}
                                    </div>

                                    {!editMode && (
                                        <div>
                                            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Account Created</p>
                                            <p style={{ fontWeight: 500, color: '#334155' }}>{user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Unknown'}</p>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>

                        {/* Address Book Section */}
                        <div style={{ marginTop: '3rem' }}>
                            <div className={styles.sectionTitleRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 className={styles.sectionTitle} style={{ margin: 0, fontSize: '1.5rem' }}>
                                    <MapPin size={20} />
                                    Address Book
                                </h3>
                                <button
                                    onClick={() => {
                                        setAddressFormData({ id: '', label: 'Home', fullName: '', mobile: '', address: '', city: '', state: '', pincode: '', isDefault: false });
                                        setEditingAddressId(null);
                                        setIsAddressModalOpen(true);
                                    }}
                                    style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    + Add Address
                                </button>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                                {(realtimeUserData?.addresses || []).length === 0 ? (
                                    <div style={{ padding: '2rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', gridColumn: '1 / -1' }}>
                                        <MapPin size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                        <p>You haven't saved any addresses yet.</p>
                                    </div>
                                ) : (
                                    (realtimeUserData?.addresses || []).map((addr) => (
                                        <div key={addr.id} style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '0.5rem', border: addr.isDefault ? '2px solid var(--primary)' : '1px solid #e2e8f0', position: 'relative' }}>
                                            {addr.isDefault && (
                                                <span style={{ position: 'absolute', top: '-10px', right: '1.5rem', backgroundColor: 'var(--primary)', color: 'white', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontWeight: 600 }}>DEFAULT</span>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                <div style={{ backgroundColor: '#f1f5f9', padding: '0.4rem 0.7rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>{addr.label}</div>
                                            </div>
                                            <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#1e293b' }}>{addr.fullName}</p>
                                            <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>{addr.address}</p>
                                            <p style={{ margin: '0 0 0.5rem', color: '#475569', fontSize: '0.9rem' }}>{addr.city}, {addr.state} {addr.pincode}</p>
                                            <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>Phone: {addr.mobile}</p>
                                            
                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                                <button onClick={() => {
                                                    setAddressFormData(addr);
                                                    setEditingAddressId(addr.id);
                                                    setIsAddressModalOpen(true);
                                                }} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 500, cursor: 'pointer', padding: 0 }}>Edit</button>
                                                <button onClick={() => handleDeleteAddress(addr.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 500, cursor: 'pointer', padding: 0 }}>Delete</button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'membership' && (
                    <section style={{ marginBottom: '3rem' }}>
                        <div className={styles.sectionTitleRow}>
                            <h2 className={styles.sectionTitle}>
                                <CreditCard size={20} />
                                My Membership
                            </h2>
                        </div>

                        {membershipLoading ? (
                            <p>Loading membership details...</p>
                        ) : membership?.status === 'active' ? (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                {/* Current Status Card */}
                                <div className="lg:col-span-7 bg-white rounded-3xl p-8 shadow-sm border" style={{ borderColor: 'var(--gray-medium)' }}>
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(244, 180, 26, 0.1)', color: 'var(--accent)' }}>
                                                <Star size={32} fill="currentColor" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                                                    {(() => {
                                                        const pId = membership?.plan_id || membership?.planId;
                                                        const plan = siteMembershipConfig?.plans?.find((p: any) => p.razorpayPlanId === pId || p.id === pId);
                                                        return plan?.name || membership?.planName || "Munch Tokri Club";
                                                    })()}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="flex items-center gap-1.5 h-6 px-2.5 rounded-full" style={{ backgroundColor: 'rgba(0, 128, 128, 0.1)', color: 'var(--primary)', border: '1px solid rgba(0, 128, 128, 0.2)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.025em' }}>
                                                        Active Plan
                                                    </span>
                                                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                        {(() => {
                                                            const pId = membership?.plan_id || membership?.planId;
                                                            const plan = siteMembershipConfig?.plans?.find((p: any) => p.razorpayPlanId === pId || p.id === pId);
                                                            return `₹${plan?.price || (membership as any)?.amount || "300"} ${plan?.priceLabel || " / year"}`;
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                                        <div className="p-4 rounded-2xl" style={{ backgroundColor: 'var(--gray-light)', border: '1px solid var(--gray-medium)' }}>
                                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                                                <Calendar size={14} />
                                                Valid Until
                                            </div>
                                            <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
                                                {(() => {
                                                    const rawDate = membership.current_period_end || membership.expiryDate;
                                                    if (!rawDate) return 'Processing...';
                                                    
                                                    // Handle Firestore Timestamp
                                                    if (rawDate && typeof rawDate === 'object' && 'toDate' in rawDate) {
                                                        return (rawDate as any).toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
                                                    }
                                                    
                                                    // Handle Unix Number (Razorpay style)
                                                    if (typeof rawDate === 'number') {
                                                        // Razorpay sends timestamps in seconds if < 10 digits usually? Actually check magnitude
                                                        const dateObj = rawDate > 10000000000 ? new Date(rawDate) : new Date(rawDate * 1000);
                                                        return dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
                                                    }
                                                    
                                                    // Handle String or generic Date
                                                    try {
                                                        return new Date(rawDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
                                                    } catch (e) {
                                                        return 'Active';
                                                    }
                                                })()}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-2xl" style={{ backgroundColor: 'var(--gray-light)', border: '1px solid var(--gray-medium)' }}>
                                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                                                <CheckCircle2 size={14} />
                                                Auto-Renewal
                                            </div>
                                            <p className="text-lg font-black" style={{ color: 'var(--primary)' }}>
                                                {membership.cancel_at_period_end ? 'Disabled' : 'Enabled'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-widest">Active Benefits</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {(siteMembershipConfig?.plans?.find((p: any) => p.razorpayPlanId === membership?.plan_id)?.benefits || 
                                              siteMembershipConfig?.plans?.[0]?.benefits || 
                                              ["Free Shipping on all orders", "Extra 10% Discount applied", "Early access to combos", "VIP Priority Support"]
                                            ).map((benefit: string, i: number) => (
                                                <div key={i} className="flex items-center gap-3 py-2 px-4 rounded-xl text-sm font-medium border" style={{ backgroundColor: 'rgba(0, 128, 128, 0.03)', color: 'var(--text-primary)', borderColor: 'rgba(0, 128, 128, 0.1)' }}>
                                                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: 'var(--primary)' }}>
                                                        <CheckCircle2 size={12} />
                                                    </div>
                                                    {benefit}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800">
                                        <p className="text-xs text-zinc-500 mb-4 italic">
                                            Need to manage your billing or cancel your plan? Please contact our support team at <a href="mailto:support@munchtokri.com" className="text-zinc-900 dark:text-zinc-50 font-bold underline">support@munchtokri.com</a> with your subscription ID: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{membership.subscription_id}</code>
                                        </p>
                                    </div>
                                </div>

                                {/* Plan Preview Card on right */}
                                <div className="lg:col-span-5 flex flex-col gap-6">
                                    <div className="bg-zinc-900 rounded-3xl p-1 shadow-2xl">
                                        <MembershipCard />
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/10 rounded-2xl p-6 border border-orange-100 dark:border-orange-800/30">
                                        <h4 className="font-bold text-orange-800 dark:text-orange-400 flex items-center gap-2 mb-2">
                                            <Zap size={18} />
                                            Did you know?
                                        </h4>
                                        <p className="text-sm text-orange-700/80 dark:text-orange-400/80 leading-relaxed">
                                            Club members save an average of ₹1,200 annually on delivery fees alone. Thank you for being a part of our flavor family!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <div className="max-w-xl">
                                    <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mb-4">Elevate Your Snacking Journey</h3>
                                    <p className="text-zinc-500 mb-10">You're currently on a free account. Join the Munch Tokri Club to unlock premium benefits and exclusive discounts.</p>
                                    <div className="inline-block p-1 bg-zinc-900 dark:bg-zinc-50 rounded-3xl shadow-2xl">
                                        <MembershipCard />
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </main>

                {/* Address Form Modal */}
                {isAddressModalOpen && (
                    <div className={styles.overlay} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={(e) => {
                        if (e.target === e.currentTarget) setIsAddressModalOpen(false);
                    }}>
                        <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0 }}>{editingAddressId ? 'Edit Address' : 'Add New Address'}</h3>
                                <button onClick={() => setIsAddressModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}><X size={20} /></button>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Label</label>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        {['Home', 'Office', 'Other'].map(lbl => (
                                            <label key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                <input type="radio" checked={addressFormData.label === lbl} onChange={() => setAddressFormData(prev => ({ ...prev, label: lbl }))} style={{ accentColor: 'var(--primary)' }} />
                                                {lbl}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Full Name *</label>
                                    <input type="text" value={addressFormData.fullName} onChange={e => setAddressFormData(prev => ({ ...prev, fullName: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Mobile Number *</label>
                                    <input type="tel" value={addressFormData.mobile} onChange={e => setAddressFormData(prev => ({ ...prev, mobile: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Street Address *</label>
                                    <input type="text" value={addressFormData.address} onChange={e => setAddressFormData(prev => ({ ...prev, address: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} placeholder="Flat / House No. / Building" />
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>City *</label>
                                        <input type="text" value={addressFormData.city} onChange={e => setAddressFormData(prev => ({ ...prev, city: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>State *</label>
                                        <input type="text" value={addressFormData.state} onChange={e => setAddressFormData(prev => ({ ...prev, state: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Pincode *</label>
                                    <input type="text" value={addressFormData.pincode} onChange={e => setAddressFormData(prev => ({ ...prev, pincode: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                                </div>
                                <div style={{ marginTop: '0.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#475569' }}>
                                        <input type="checkbox" checked={addressFormData.isDefault} onChange={e => setAddressFormData(prev => ({ ...prev, isDefault: e.target.checked }))} style={{ width: '1rem', height: '1rem', accentColor: 'var(--primary)' }} />
                                        Set as default address
                                    </label>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                    <button onClick={() => setIsAddressModalOpen(false)} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                                    <button onClick={handleSaveAddress} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, opacity: isSaving ? 0.7 : 1 }} disabled={isSaving || !addressFormData.fullName || !addressFormData.mobile || !addressFormData.address || !addressFormData.city || !addressFormData.state || !addressFormData.pincode}>
                                        {isSaving ? 'Saving...' : 'Save Address'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            {/* Action Modal */}
            {isActionModalOpen && selectedOrderId && (
                <div className={styles.modalOverlay} onClick={() => setIsActionModalOpen(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Manage Your Order</h2>
                            <p>How can we help you with order #{orders.find(o => o.id === selectedOrderId)?.orderNumber || selectedOrderId.slice(-6).toUpperCase()}?</p>
                        </div>
                        
                        <div className={styles.modalActionGrid}>
                            {/* Before Delivery Actions */}
                            {['Processing', 'Prepared', 'Dispatched'].includes(orders.find(o => o.id === selectedOrderId)?.status || '') && (
                                <>
                                    <button 
                                        className={styles.modalActionBtn}
                                        onClick={() => {
                                            showConfirm(
                                                "Are you sure you want to request a refund? Your order will be cancelled.",
                                                () => handleOrderAction(selectedOrderId, 'Refund Requested'),
                                                { title: 'Confirm Cancel & Refund' }
                                            );
                                        }}
                                    >
                                        <Undo size={22} className={styles.modalActionIcon} />
                                        <div>
                                            <div style={{ fontSize: '1.1rem' }}>Cancel & Refund</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.7 }}>Cancel order and get money back</div>
                                        </div>
                                    </button>

                                    <button 
                                        className={styles.modalActionBtn}
                                        onClick={() => {
                                            showConfirm(
                                                "Would you like to request a replacement for this order?",
                                                () => handleOrderAction(selectedOrderId, 'Replacement Requested'),
                                                { title: 'Confirm Replacement' }
                                            );
                                        }}
                                    >
                                        <RefreshCw size={22} className={styles.modalActionIcon} />
                                        <div>
                                            <div style={{ fontSize: '1.1rem' }}>Replace Items</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.7 }}>Exchange items for a new one</div>
                                        </div>
                                    </button>
                                </>
                            )}

                            {/* After Delivery Actions */}
                            {orders.find(o => o.id === selectedOrderId)?.status === 'Delivered' && (
                                <>
                                    <button 
                                        className={styles.modalActionBtn}
                                        onClick={() => {
                                            showConfirm(
                                                "Would you like to request a refund?",
                                                () => handleOrderAction(selectedOrderId, 'Refund Requested'),
                                                { title: 'Confirm Refund Request' }
                                            );
                                        }}
                                    >
                                        <Undo size={22} className={styles.modalActionIcon} />
                                        <div>
                                            <div style={{ fontSize: '1.1rem' }}>Request Refund</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.7 }}>Apply for a refund for delivered items</div>
                                        </div>
                                    </button>

                                    <button 
                                        className={styles.modalActionBtn}
                                        onClick={() => {
                                            showConfirm(
                                                "Would you like to request a return?",
                                                () => handleOrderAction(selectedOrderId, 'Return Requested'),
                                                { title: 'Confirm Return' }
                                            );
                                        }}
                                    >
                                        <RotateCcw size={22} className={styles.modalActionIcon} />
                                        <div>
                                            <div style={{ fontSize: '1.1rem' }}>Return Order</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.7 }}>Send items back to us</div>
                                        </div>
                                    </button>
                                </>
                            )}
                        </div>

                        <button 
                            className={styles.modalCloseBtn}
                            onClick={() => setIsActionModalOpen(false)}
                        >
                            Nevermind, keep my order
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}><p>Loading dashboard...</p></div>}>
            <DashboardContent />
        </Suspense>
    );
}
