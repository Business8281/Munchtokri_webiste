"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { adminDb } from '@/lib/firebase';
import styles from '../admin.module.css';

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
}

export default function SettingsPage() {
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
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

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
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            const dataToSave = {
                ...settings,
                shippingRate: settings.shippingRate === '' ? 0 : Number(settings.shippingRate),
                freeShippingThreshold: settings.freeShippingThreshold === '' ? 0 : Number(settings.freeShippingThreshold),
                codPrice: settings.codPrice === '' ? 0 : Number(settings.codPrice),
            };
            await setDoc(doc(adminDb, 'settings', 'store'), dataToSave);
            setMessage('Settings saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error saving settings:", error);
            setMessage('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let val: any = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        
        // Convert to number for numeric fields but allow empty string for better UX
        if (name === 'shippingRate' || name === 'freeShippingThreshold' || name === 'codPrice') {
            val = value === '' ? '' : Number(value);
        }
        
        setSettings(prev => ({ ...prev, [name]: val }));
    };

    if (loading) {
        return <div className={styles.statGrid}><div className={styles.statCard}>Loading settings...</div></div>;
    }

    return (
        <div className={styles.dashboardContent}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.pageTitle}>Store Settings</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {message && <span style={{ color: message.includes('failed') ? 'red' : 'green', fontSize: '0.9rem', fontWeight: '500' }}>{message}</span>}
                    <button 
                        className={styles.viewBtn} 
                        onClick={handleSave} 
                        disabled={saving}
                        style={{ background: 'var(--primary)', color: 'white', padding: '0.6rem 1.5rem', borderRadius: '8px' }}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
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
                                onChange={handleChange}
                                placeholder="Store Name"
                            />
                        </div>
                    </div>

                    <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Contact Emails</h4>
                    <div className={styles.inputGrid} style={{ marginBottom: '1.5rem' }}>
                        <div className={styles.inputGroup}>
                            <label>Primary Email</label>
                            <input type="email" name="contactEmail" value={settings.contactEmail} onChange={handleChange} placeholder="contact@munchtokri.com" />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Sales Email</label>
                            <input type="email" name="secondaryEmail" value={settings.secondaryEmail} onChange={handleChange} placeholder="sales@munchtokri.com" />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Bulk Orders</label>
                            <input type="email" name="bulkOrderEmail" value={settings.bulkOrderEmail} onChange={handleChange} placeholder="bulk@munchtokri.com" />
                        </div>
                    </div>

                    <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Contact Numbers</h4>
                    <div className={styles.inputGrid} style={{ marginBottom: '1.5rem' }}>
                        <div className={styles.inputGroup}>
                            <label>Primary Number</label>
                            <input type="text" name="contactNumber" value={settings.contactNumber} onChange={handleChange} placeholder="+91 XXXXX XXXXX" />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Secondary Number</label>
                            <input type="text" name="secondaryNumber" value={settings.secondaryNumber} onChange={handleChange} placeholder="+91 XXXXX XXXXX" />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Store Phone</label>
                            <input type="text" name="storeNumber" value={settings.storeNumber} onChange={handleChange} placeholder="080-XXXXXXXX" />
                        </div>
                    </div>

                    <div className={styles.inputGrid} style={{ gridTemplateColumns: '1fr', marginBottom: '1.5rem' }}>
                        <div className={styles.inputGroup}>
                            <label>Store Address</label>
                            <textarea 
                                name="address"
                                value={settings.address} 
                                onChange={handleChange}
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
                                onChange={handleChange}
                                placeholder="e.g., Mon - Sat: 10:00 AM - 9:00 PM"
                                style={{ minHeight: '60px' }}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.statCard} style={{ gridColumn: 'span 4' }}>
                    <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Shipping & Delivery</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>
                                <input 
                                    type="checkbox" 
                                    name="enableFlatRateShipping"
                                    checked={settings.enableFlatRateShipping} 
                                    onChange={handleChange}
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
                                            onChange={handleChange} 
                                            placeholder="50" 
                                        />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Free Shipping Threshold (₹)</label>
                                        <input 
                                            type="number" 
                                            name="freeShippingThreshold" 
                                            value={settings.freeShippingThreshold === 0 ? '' : settings.freeShippingThreshold} 
                                            onChange={handleChange} 
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
                                    onChange={handleChange}
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
                                            onChange={handleChange} 
                                            placeholder="50" 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
