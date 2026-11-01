"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { adminAuth, adminDb } from '@/lib/firebase';
import styles from '../admin.module.css';
import { useAdmin, AdminUserData } from '@/contexts/AdminContext';

interface StoreSettings {
    storeName: string;
    contactEmail: string;
    secondaryEmail: string;
    bulkOrderEmail: string;
    contactNumber: string;
    secondaryNumber: string;
    storeNumber: string;
    address: string;
    businessHours: string;
    enableFlatRateShipping: boolean;
    enableCOD: boolean;
    codPrice: number | string;
    shippingRate: number | string;
    freeShippingThreshold: number | string;
    enableShiprocket?: boolean;
    enableVelocity?: boolean;
    enableAnnouncementBar?: boolean;
    announcementSpeed?: number;
    announcementText1?: string;
    announcementText2?: string;
    announcementText3?: string;
    announcementText4?: string;
}

export default function SettingsPage() {
    const { user } = useAdmin();
    const [activeTab, setActiveTab] = useState<'general' | 'staff'>('general');

    // General Settings State
    const [settings, setSettings] = useState<StoreSettings>({
        storeName: '',
        contactEmail: '',
        secondaryEmail: '',
        bulkOrderEmail: '',
        contactNumber: '',
        secondaryNumber: '',
        storeNumber: '',
        address: '',
        businessHours: '',
        enableFlatRateShipping: true,
        enableCOD: true,
        codPrice: 0,
        shippingRate: 50,
        freeShippingThreshold: 350,
        enableShiprocket: true,
        enableVelocity: true,
        enableAnnouncementBar: false,
        announcementSpeed: 53,
        announcementText1: 'Welcome to Munch Tokri! Use code NEW10 for 10% off your first order.',
        announcementText2: 'Free shipping on orders above ₹350!',
        announcementText3: 'Join our membership for exclusive discounts.',
        announcementText4: 'Try our new Build Your Mix feature today!',
    });
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsMessage, setSettingsMessage] = useState('');

    // Staff Management State
    const [staffList, setStaffList] = useState<AdminUserData[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [staffMessage, setStaffMessage] = useState('');
    const [addingStaff, setAddingStaff] = useState(false);
    const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'employee' });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(adminDb, 'settings', 'store');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setSettings(docSnap.data() as StoreSettings);
                } else {
                    console.log("No such document! Using defaults.");
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoadingSettings(false);
            }
        };

        fetchSettings();
    }, []);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        if (activeTab === 'staff') {
            setLoadingStaff(true);
            try {
                unsubscribe = onSnapshot(collection(adminDb, 'admins'), (snapshot) => {
                    const list: AdminUserData[] = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        list.push({
                            email: doc.id,
                            role: data.role || 'admin',
                            name: data.name || '',
                            ...data
                        } as AdminUserData);
                    });
                    setStaffList(list);
                    setLoadingStaff(false);
                }, (error) => {
                    console.error("Error fetching staff live:", error);
                    setLoadingStaff(false);
                });
            } catch (error) {
                console.error("Error setting up staff listener:", error);
                setLoadingStaff(false);
            }
        }
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [activeTab]);

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        setSettingsMessage('');
        try {
            const dataToSave = {
                ...settings,
                shippingRate: settings.shippingRate === '' ? 0 : Number(settings.shippingRate),
                freeShippingThreshold: settings.freeShippingThreshold === '' ? 0 : Number(settings.freeShippingThreshold),
                codPrice: settings.codPrice === '' ? 0 : Number(settings.codPrice),
            };
            await setDoc(doc(adminDb, 'settings', 'store'), dataToSave);
            setSettingsMessage('Settings saved successfully!');
            setTimeout(() => setSettingsMessage(''), 3000);
        } catch (error) {
            console.error("Error saving settings:", error);
            setSettingsMessage('Failed to save settings.');
        } finally {
            setSavingSettings(false);
        }
    };

    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let val: any = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

        // Convert to number for numeric fields but allow empty string for better UX
        if (name === 'shippingRate' || name === 'freeShippingThreshold' || name === 'codPrice') {
            val = value === '' ? '' : Number(value);
        }

        setSettings(prev => ({ ...prev, [name]: val }));
    };

    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingStaff(true);
        setStaffMessage('');
        try {
            // Use a temporary secondary app to create the user without signing out the current admin
            const { initializeApp, getApps } = await import('firebase/app');
            const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');

            // Get config from the primary app
            const primaryApp = getApps()[0];
            const tempAppName = 'MT-Staff-Creator-' + Date.now();
            const staffApp = initializeApp(primaryApp.options, tempAppName);
            const staffAuth = getAuth(staffApp);

            // Create user in Auth
            await createUserWithEmailAndPassword(staffAuth, newStaff.email, newStaff.password);
            await signOut(staffAuth);

            // Save to Firestore using the authenticated adminDb instance
            const normalizedEmail = newStaff.email.toLowerCase().trim();
            await setDoc(doc(adminDb, 'admins', normalizedEmail), {
                email: normalizedEmail,
                name: newStaff.name,
                role: newStaff.role,
                createdAt: new Date().toISOString()
            });

            setStaffMessage('Staff member added successfully!');
            setNewStaff({ name: '', email: '', password: '', role: 'employee' });
            setTimeout(() => setStaffMessage(''), 3000);
        } catch (error: any) {
            console.error("Error adding staff:", error);
            setStaffMessage(`Error: ${error.message}`);
        } finally {
            setAddingStaff(false);
        }
    };

    const handleDeleteStaff = async (email: string) => {
        if (!confirm(`Are you sure you want to remove ${email}?`)) return;
        setStaffMessage('');
        try {
            const normalizedEmail = email.toLowerCase().trim();

            // Delete from Firestore to revoke access
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(adminDb, 'admins', normalizedEmail));

            // Also check for any query by email
            const snapshot = await getDocs(collection(adminDb, 'admins'));
            snapshot.forEach(async (docSnapshot) => {
                if (docSnapshot.data().email === normalizedEmail) {
                    await deleteDoc(docSnapshot.ref);
                }
            });

            setStaffMessage('Staff member removed successfully!');
            setTimeout(() => setStaffMessage(''), 3000);
        } catch (error: any) {
            console.error("Error removing staff:", error);
            setStaffMessage(`Error: ${error.message}`);
        }
    };

    if (loadingSettings) {
        return <div className={styles.statGrid}><div className={styles.statCard}>Loading settings...</div></div>;
    }

    return (
        <div className={styles.dashboardContent}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.pageTitle}>Settings</h2>
            </div>

            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid #eee' }}>
                <button
                    onClick={() => setActiveTab('general')}
                    style={{
                        padding: '1rem 0',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'general' ? '2px solid var(--primary)' : '2px solid transparent',
                        color: activeTab === 'general' ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: activeTab === 'general' ? '600' : '500',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    Store Settings
                </button>
                {user?.role === 'admin' && (
                    <button
                        onClick={() => setActiveTab('staff')}
                        style={{
                            padding: '1rem 0',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'staff' ? '2px solid var(--primary)' : '2px solid transparent',
                            color: activeTab === 'staff' ? 'var(--primary)' : 'var(--text-secondary)',
                            fontWeight: activeTab === 'staff' ? '600' : '500',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        Staff Management
                    </button>
                )}
            </div>

            {activeTab === 'general' && (
                <>
                    <div className={styles.sectionHeader} style={{ justifyContent: 'flex-end', marginTop: '-1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {settingsMessage && <span style={{ color: settingsMessage.includes('failed') ? 'red' : 'green', fontSize: '0.9rem', fontWeight: '500' }}>{settingsMessage}</span>}
                            <button
                                className={styles.viewBtn}
                                onClick={handleSaveSettings}
                                disabled={savingSettings}
                                style={{ background: 'var(--primary)', color: 'white', padding: '0.6rem 1.5rem', borderRadius: '8px' }}
                            >
                                {savingSettings ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                    <div className={styles.statGrid}>
                        <div className={styles.statCard} style={{ gridColumn: 'span 4' }}>
                            <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>General Information</h3>
                            <div className={styles.inputGrid} style={{ gridTemplateColumns: '1fr', marginBottom: '1.5rem' }}>
                                <div className={styles.inputGroup}>
                                    <label>Store Name</label>
                                    <input
                                        type="text"
                                        name="storeName"
                                        value={settings.storeName}
                                        onChange={handleSettingsChange}
                                        placeholder="Store Name"
                                    />
                                </div>
                            </div>

                            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Contact Emails</h4>
                            <div className={styles.inputGrid} style={{ marginBottom: '1.5rem' }}>
                                <div className={styles.inputGroup}>
                                    <label>Primary Email</label>
                                    <input type="email" name="contactEmail" value={settings.contactEmail} onChange={handleSettingsChange} placeholder="contact@munchtokri.com" />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Sales Email</label>
                                    <input type="email" name="secondaryEmail" value={settings.secondaryEmail} onChange={handleSettingsChange} placeholder="sales@munchtokri.com" />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Bulk Orders</label>
                                    <input type="email" name="bulkOrderEmail" value={settings.bulkOrderEmail} onChange={handleSettingsChange} placeholder="bulk@munchtokri.com" />
                                </div>
                            </div>

                            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Contact Numbers</h4>
                            <div className={styles.inputGrid} style={{ marginBottom: '1.5rem' }}>
                                <div className={styles.inputGroup}>
                                    <label>Primary Number</label>
                                    <input type="text" name="contactNumber" value={settings.contactNumber} onChange={handleSettingsChange} placeholder="+91 XXXXX XXXXX" />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Secondary Number</label>
                                    <input type="text" name="secondaryNumber" value={settings.secondaryNumber} onChange={handleSettingsChange} placeholder="+91 XXXXX XXXXX" />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Store Phone</label>
                                    <input type="text" name="storeNumber" value={settings.storeNumber} onChange={handleSettingsChange} placeholder="080-XXXXXXXX" />
                                </div>
                            </div>

                            <div className={styles.inputGrid} style={{ gridTemplateColumns: '1fr', marginBottom: '1.5rem' }}>
                                <div className={styles.inputGroup}>
                                    <label>Store Address</label>
                                    <textarea
                                        name="address"
                                        value={settings.address}
                                        onChange={handleSettingsChange}
                                        placeholder="Full Store Address"
                                        style={{ minHeight: '100px' }}
                                    />
                                </div>
                            </div>

                            <div className={styles.inputGrid} style={{ gridTemplateColumns: '1fr' }}>
                                <div className={styles.inputGroup}>
                                    <label>Business Hours</label>
                                    <textarea
                                        name="businessHours"
                                        value={settings.businessHours}
                                        onChange={handleSettingsChange}
                                        placeholder="e.g., Mon - Sat: 10:00 AM - 9:00 PM"
                                        style={{ minHeight: '60px' }}
                                    />
                                </div>
                            </div>

                            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Announcement Bar</h4>
                            <div className={styles.inputGrid} style={{ gridTemplateColumns: '1fr', marginBottom: '1.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>
                                    <input
                                        type="checkbox"
                                        name="enableAnnouncementBar"
                                        checked={settings.enableAnnouncementBar || false}
                                        onChange={handleSettingsChange}
                                        style={{ width: '18px', height: '18px', accentColor: 'var(--secondary)' }}
                                    /> Enable Announcement Bar
                                </label>
                                {settings.enableAnnouncementBar && (
                                    <div className={styles.inputGrid} style={{ marginTop: '1rem' }}>
                                        <div className={styles.inputGroup}>
                                            <label>Announcement Text 1</label>
                                            <input
                                                type="text"
                                                name="announcementText1"
                                                value={settings.announcementText1 || ''}
                                                onChange={handleSettingsChange}
                                                placeholder="e.g., Use code DIWALI20 for 20% off!"
                                            />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label>Announcement Text 2</label>
                                            <input
                                                type="text"
                                                name="announcementText2"
                                                value={settings.announcementText2 || ''}
                                                onChange={handleSettingsChange}
                                                placeholder="e.g., Free Shipping over ₹350"
                                            />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label>Announcement Text 3</label>
                                            <input
                                                type="text"
                                                name="announcementText3"
                                                value={settings.announcementText3 || ''}
                                                onChange={handleSettingsChange}
                                                placeholder="e.g., Premium Memberships available"
                                            />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label>Announcement Text 4</label>
                                            <input
                                                type="text"
                                                name="announcementText4"
                                                value={settings.announcementText4 || ''}
                                                onChange={handleSettingsChange}
                                                placeholder="e.g., Try our new Combos"
                                            />
                                        </div>
                                        <div className={styles.inputGroup} style={{ gridColumn: 'span 2' }}>
                                            <label>Scroll Duration (seconds per cycle — higher is slower and easier to read)</label>
                                            <input
                                                type="number"
                                                name="announcementSpeed"
                                                value={settings.announcementSpeed ?? 53}
                                                onChange={handleSettingsChange}
                                                min={15}
                                                max={120}
                                                placeholder="53"
                                            />
                                            <small style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.8rem' }}>
                                                Currently set to <strong>{settings.announcementSpeed ?? 53} seconds</strong> (recommended: 40s – 60s for smooth, easy reading).
                                            </small>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.statCard} style={{ gridColumn: 'span 4' }}>
                            <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Shipping & Delivery</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>
                                        <input
                                            type="checkbox"
                                            name="enableShiprocket"
                                            checked={settings.enableShiprocket !== false}
                                            onChange={handleSettingsChange}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--secondary)' }}
                                        /> Enable Shiprocket
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>
                                        <input
                                            type="checkbox"
                                            name="enableVelocity"
                                            checked={settings.enableVelocity !== false}
                                            onChange={handleSettingsChange}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--secondary)' }}
                                        /> Enable Velocity Shipping
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>
                                        <input
                                            type="checkbox"
                                            name="enableFlatRateShipping"
                                            checked={settings.enableFlatRateShipping}
                                            onChange={handleSettingsChange}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--secondary)' }}
                                        /> Enable Flat Rate Shipping
                                    </label>

                                    {settings.enableFlatRateShipping && (
                                        <div className={styles.inputGrid}>
                                            <div className={styles.inputGroup}>
                                                <label>Flat Shipping Rate (₹)</label>
                                                <input
                                                    type="number"
                                                    name="shippingRate"
                                                    value={settings.shippingRate === 0 ? '' : settings.shippingRate}
                                                    onChange={handleSettingsChange}
                                                    placeholder="50"
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>Free Shipping Threshold (₹)</label>
                                                <input
                                                    type="number"
                                                    name="freeShippingThreshold"
                                                    value={settings.freeShippingThreshold === 0 ? '' : settings.freeShippingThreshold}
                                                    onChange={handleSettingsChange}
                                                    placeholder="350"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>
                                        <input
                                            type="checkbox"
                                            name="enableCOD"
                                            checked={settings.enableCOD}
                                            onChange={handleSettingsChange}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--secondary)' }}
                                        /> Enable Cash on Delivery (COD)
                                    </label>

                                    {settings.enableCOD && (
                                        <div className={styles.inputGrid}>
                                            <div className={styles.inputGroup}>
                                                <label>COD Extra Charge (₹)</label>
                                                <input
                                                    type="number"
                                                    name="codPrice"
                                                    value={settings.codPrice === 0 ? '' : settings.codPrice}
                                                    onChange={handleSettingsChange}
                                                    placeholder="50"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'staff' && user?.role === 'admin' && (
                <div className={styles.statGrid}>
                    <div className={styles.statCard} style={{ gridColumn: 'span 4' }}>
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Add New Staff</h3>
                        <form onSubmit={handleAddStaff}>
                            <div className={styles.inputGrid}>
                                <div className={styles.inputGroup}>
                                    <label>Full Name</label>
                                    <input
                                        type="text"
                                        value={newStaff.name}
                                        onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        value={newStaff.email}
                                        onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                                        placeholder="john@example.com"
                                        required
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Password</label>
                                    <input
                                        type="password"
                                        value={newStaff.password}
                                        onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                                        placeholder="Secure password"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Role</label>
                                    <select
                                        value={newStaff.role}
                                        onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.95rem' }}
                                    >
                                        <option value="admin">Admin (Full Access)</option>
                                        <option value="manager">Manager</option>
                                        <option value="employee">Employee</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                                <button
                                    type="submit"
                                    disabled={addingStaff}
                                    style={{ background: 'var(--primary)', color: 'white', padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500' }}
                                >
                                    {addingStaff ? 'Adding...' : 'Add Staff'}
                                </button>
                                {staffMessage && (
                                    <span style={{ color: staffMessage.includes('Error') ? 'red' : 'green', fontSize: '0.9rem', fontWeight: '500' }}>
                                        {staffMessage}
                                    </span>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className={styles.statCard} style={{ gridColumn: 'span 4' }}>
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Current Staff</h3>
                        {loadingStaff ? (
                            <p>Loading staff...</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #eee' }}>
                                        <th style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>Name</th>
                                        <th style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>Email</th>
                                        <th style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>Role</th>
                                        <th style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffList.map((staff) => (
                                        <tr key={staff.email} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '1rem 0.5rem', fontWeight: '500' }}>{staff.name || 'N/A'}</td>
                                            <td style={{ padding: '1rem 0.5rem' }}>{staff.email}</td>
                                            <td style={{ padding: '1rem 0.5rem' }}>
                                                <span style={{
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.8rem',
                                                    background: staff.role === 'admin' ? '#ffebee' : staff.role === 'manager' ? '#e3f2fd' : '#e8f5e9',
                                                    color: staff.role === 'admin' ? '#c62828' : staff.role === 'manager' ? '#1565c0' : '#2e7d32',
                                                    textTransform: 'uppercase',
                                                    fontWeight: '600'
                                                }}>
                                                    {staff.role}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem' }}>
                                                {staff.email !== user?.email && (
                                                    <button
                                                        onClick={() => handleDeleteStaff(staff.email)}
                                                        style={{ color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {staffList.length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '1rem 0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No staff members found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
