"use client";

export const dynamic = "force-dynamic";

import React, { useState, useRef, useEffect } from 'react';
import { useProducts, useCombos } from '@/hooks/useFirestore';
import { Product, Combo, ComboProduct } from '@/types';
import { useAdmin } from '@/contexts/AdminContext';
import { useFirebase } from '@/contexts/FirebaseContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '@/lib/image-utils';
import {
    Plus,
    X,
    Upload,
    Save,
    Package,
    Tag,
    Edit2,
    Trash2,
    Loader2,
    Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'react-hot-toast';
import { useNotification } from '@/contexts/NotificationContext';
import styles from './combos.module.css';

export default function CombosPage() {
    const { user } = useAdmin();
    const { products, loading: productsLoading } = useProducts();
    const { combos, loading: combosLoading, addCombo, updateCombo, deleteCombo } = useCombos();
    const { storage } = useFirebase();
    const { showConfirm } = useNotification();
    
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [newCombo, setNewCombo] = useState<Omit<Combo, 'id' | 'createdAt'>>({
        name: '',
        price: 0,
        originalPrice: 0,
        description: '',
        status: 'In Stock',
        imageURL: '',
        imageURLs: [],
        products: []
    });

    // Helper state for adding products to combo
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedProductGrams, setSelectedProductGrams] = useState(100);

    const handleAddProductToCombo = () => {
        if (!selectedProductId) return;
        const product = products.find(p => p.id === selectedProductId);
        if (!product) return;

        const alreadyExists = newCombo.products.find(p => p.productId === selectedProductId);
        if (alreadyExists) {
            toast.error("Product already added to combo");
            return;
        }

        const comboProd: ComboProduct = {
            productId: product.id,
            name: product.name,
            grams: selectedProductGrams,
            price: (product.price / (product.baseWeight || 100)) * selectedProductGrams,
            imageURL: product.imageURL || product.image || ''
        };

        const updatedProducts = [...newCombo.products, comboProd];
        const newOriginalPrice = updatedProducts.reduce((sum, p) => sum + p.price, 0);

        setNewCombo({
            ...newCombo,
            products: updatedProducts,
            originalPrice: Math.round(newOriginalPrice),
            imageURL: updatedProducts[0]?.imageURL || '',
            imageURLs: updatedProducts.map(p => p.imageURL || '').filter(Boolean)
        });
        setSelectedProductId('');
    };

    const removeProductFromCombo = (productId: string) => {
        const updatedProducts = newCombo.products.filter(p => p.productId !== productId);
        const newOriginalPrice = updatedProducts.reduce((sum, p) => sum + p.price, 0);
        setNewCombo({
            ...newCombo,
            products: updatedProducts,
            originalPrice: Math.round(newOriginalPrice),
            imageURL: updatedProducts[0]?.imageURL || '',
            imageURLs: updatedProducts.map(p => p.imageURL || '').filter(Boolean)
        });
    };

    // Simplified: Image logic is now tied to selected products

    const handleSaveCombo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newCombo.products.length === 0) {
            toast.error("Please add at least one product to the combo");
            return;
        }

        const toastId = toast.loading("Saving combo...");
        try {
            setSaving(true);
            const comboData = { ...newCombo };

            if (editingId) {
                await updateCombo(editingId, comboData);
                toast.success("Combo updated!", { id: toastId });
            } else {
                await addCombo(comboData);
                toast.success("Combo created!", { id: toastId });
            }

            setIsAdding(false);
            resetForm();
        } catch (error: any) {
            toast.error(error.message || "Failed to save combo", { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setNewCombo({
            name: '',
            price: 0,
            originalPrice: 0,
            description: '',
            status: 'In Stock',
            imageURL: '',
            imageURLs: [],
            products: []
        });
        setEditingId(null);
    };

    function renderComboForm() {
        return (
            <form onSubmit={handleSaveCombo} className={styles.formGrid}>
                {/* Visual Preview Column */}
                <div className={styles.imageUploadSection}>
                    <div className={styles.imageGrid}>
                        {newCombo.products.map((p, idx) => (
                            <div key={idx} className={styles.imagePreviewBox}>
                                <img src={p.imageURL || '/logo.png'} alt={p.name} />
                                <div className={styles.primaryBadge}>{p.grams}g</div>
                            </div>
                        ))}
                        {newCombo.products.length === 0 && (
                            <div className={styles.addMoreImages} style={{ cursor: 'default', borderStyle: 'solid' }}>
                                <Package size={32} opacity={0.3} />
                                <span style={{ opacity: 0.5 }}>Add products to preview</span>
                            </div>
                        )}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '1rem' }}>
                        * The combo will automatically use the first product's image as the main display.
                    </p>
                </div>

            <div className={styles.fieldsSection}>
                <div className={styles.inputGroup}>
                    <label>Combo Name</label>
                    <input 
                        type="text" 
                        value={newCombo.name} 
                        onChange={e => setNewCombo({...newCombo, name: e.target.value})}
                        placeholder="e.g. Tea Time Classic Combo"
                        required 
                    />
                </div>

                <div className={styles.productSelection}>
                    <label style={{fontWeight: 600, display: 'block', marginBottom: '1rem'}}>Add Products</label>
                    <div className={styles.selectedProductsList}>
                        {newCombo.products.map(p => (
                            <div key={p.productId} className={styles.selectedProductItem}>
                                <span>{p.name} ({p.grams}g)</span>
                                <button type="button" onClick={() => removeProductFromCombo(p.productId)}>
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className={styles.productPicker}>
                        <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                            <option value="">Select a product...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input 
                            type="text" 
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={selectedProductGrams} 
                            onChange={e => setSelectedProductGrams(Number(e.target.value.replace(/\D/g, '')))}
                            placeholder="Grams" 
                        />
                        <button type="button" className={styles.addProdBtn} onClick={handleAddProductToCombo}>Add</button>
                    </div>
                </div>

                <div className={styles.row}>
                    <div className={styles.inputGroup}>
                        <label>Base Price (₹)</label>
                        <input 
                            type="text" 
                            inputMode="decimal"
                            value={newCombo.originalPrice || ''} 
                            onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                    setNewCombo({...newCombo, originalPrice: val ? Number(val) : 0});
                                }
                            }}
                            placeholder="0.00"
                            required 
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>Combo Offer Price (₹)</label>
                        <input 
                            type="text" 
                            inputMode="decimal"
                            value={newCombo.price || ''} 
                            onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                    setNewCombo({...newCombo, price: val ? Number(val) : 0});
                                }
                            }}
                            placeholder="0.00"
                            required 
                        />
                    </div>
                </div>

                <div className={styles.row}>
                    <div className={styles.inputGroup}>
                        <label>Status</label>
                        <select value={newCombo.status} onChange={e => setNewCombo({...newCombo, status: e.target.value as any})}>
                            <option>In Stock</option>
                            <option>Low Stock</option>
                            <option>Out of Stock</option>
                        </select>
                    </div>
                    <div className={styles.inputGroup}>
                        <label>Save Amount (Auto)</label>
                        <div style={{ 
                            padding: '1rem', 
                            background: '#e6fcf5', 
                            borderRadius: '14px', 
                            color: '#099268', 
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            height: '100%'
                        }}>
                            ₹{Math.max(0, newCombo.originalPrice - newCombo.price)} Discount
                        </div>
                    </div>
                </div>

                <div className={styles.inputGroup}>
                    <label>Description</label>
                    <textarea 
                        value={newCombo.description} 
                        onChange={e => setNewCombo({...newCombo, description: e.target.value})}
                        rows={3} 
                    />
                </div>

                <div className={styles.submitActions}>
                    <button type="button" className={styles.cancelBtn} onClick={() => { setIsAdding(false); resetForm(); }}>Discard</button>
                    <button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? 'Saving...' : 'Save Combo'}</button>
                </div>
            </div>
        </form>
    );
}

    return (
        <div className={styles.container}>
            <Toaster position="top-right" />
            <div className={styles.header}>
                <h1>Combo Bundles</h1>
                <button className={styles.addBtn} onClick={() => setIsAdding(!isAdding)}>
                    {isAdding ? <X size={20} /> : <Plus size={20} />}
                    {isAdding ? 'Cancel' : 'Create New Combo'}
                </button>
            </div>

            <AnimatePresence>
                {isAdding && !editingId && (
                    <motion.div initial={{height: 0, opacity: 0}} animate={{height: 'auto', opacity: 1}} exit={{height: 0, opacity: 0}} className={styles.formCard}>
                        {renderComboForm()}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={styles.tableCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Combo</th>
                            <th>Products Included</th>
                            <th>Total Weight</th>
                            <th>Price</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {combosLoading ? (
                            <tr><td colSpan={6} style={{textAlign: 'center', padding: '3rem'}}><Loader2 className="animate-spin" /></td></tr>
                        ) : combos.map(combo => (
                            <React.Fragment key={combo.id}>
                                <tr>
                                    <td>
                                        <div className={styles.comboCell}>
                                            <img src={combo.imageURL || '/Logo Munch Tokri.png'} className={styles.comboThumb} alt="" />
                                            <div className={styles.comboInfo}>
                                                <h4>{combo.name}</h4>
                                                <p>{combo.description.slice(0, 50)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{combo.products.length} Products</td>
                                    <td>{combo.products.reduce((sum, p) => sum + p.grams, 0)}g</td>
                                    <td><span className={styles.originalPrice}>₹{combo.originalPrice}</span> ₹{combo.price}</td>
                                    <td><span className={`${styles.statusBadge} ${styles.inStock}`}>{combo.status}</span></td>
                                    <td className={styles.actionsCell}>
                                        <button className={styles.editActionBtn} onClick={() => {
                                            setEditingId(combo.id);
                                            setNewCombo({...combo});
                                            setIsAdding(false);
                                        }}><Edit2 size={16} /></button>
                                        {user && user.role.toLowerCase() !== 'employee' && (
                                            <button className={styles.deleteActionBtn} onClick={() => {
                                                showConfirm(`Delete combo "${combo.name}"?`, () => deleteCombo(combo.id));
                                            }}><Trash2 size={16} /></button>
                                        )}
                                    </td>
                                </tr>
                                {editingId === combo.id && (
                                    <tr>
                                        <td colSpan={6}>
                                            <div className={styles.inlineFormContainer}>
                                                <div className={styles.inlineHeader}>
                                                    <h3>Edit Combo</h3>
                                                    <button onClick={() => setEditingId(null)}><X size={18} /></button>
                                                </div>
                                                {renderComboForm()}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
