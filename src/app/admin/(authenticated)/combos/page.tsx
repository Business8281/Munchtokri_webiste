"use client";

export const dynamic = "force-dynamic";

import React, { useState, useRef } from 'react';
import { useProducts, useCombos } from '@/hooks/useFirestore';
import { Product, Combo, ComboProduct, ComboVariant } from '@/types';
import { useAdmin } from '@/contexts/AdminContext';
import { useFirebase } from '@/contexts/FirebaseContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '@/lib/image-utils';
import {
    Plus,
    X,
    Upload,
    Package,
    Edit2,
    Trash2,
    Loader2,
    Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'react-hot-toast';
import { useNotification } from '@/contexts/NotificationContext';
import { sortComboVariantsLowToHigh } from '@/lib/constants';
import styles from './combos.module.css';

export default function CombosPage() {
    const { user } = useAdmin();
    const { products } = useProducts();
    const { combos, loading: combosLoading, addCombo, updateCombo, deleteCombo } = useCombos();
    const { storage } = useFirebase();
    const { showConfirm } = useNotification();
    
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Image upload state (max 8 images, identical to inventory system)
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [newCombo, setNewCombo] = useState<Omit<Combo, 'id' | 'createdAt'>>({
        name: '',
        price: 0,
        originalPrice: 0,
        description: '',
        status: 'In Stock',
        imageURL: '',
        imageURLs: [],
        products: [],
        variants: []
    });

    const handleAddVariant = () => {
        const nextPackNum = (newCombo.variants?.length || 0) + 1;
        const totalProductGrams = (newCombo.products || []).reduce((acc, p) => acc + (Number(p.grams) || 0), 0);
        const newV: ComboVariant = {
            id: 'v_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            title: `Pack of ${nextPackNum}`,
            grams: totalProductGrams > 0 ? totalProductGrams * nextPackNum : 0,
            originalPrice: newCombo.originalPrice || 0,
            price: newCombo.price || 0,
            status: 'In Stock'
        };
        setNewCombo(prev => ({
            ...prev,
            variants: [...(prev.variants || []), newV]
        }));
    };

    const handleUpdateVariant = (index: number, field: keyof ComboVariant, value: any) => {
        setNewCombo(prev => {
            const updated = [...(prev.variants || [])];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, variants: updated };
        });
    };

    const handleRemoveVariant = (index: number) => {
        setNewCombo(prev => ({
            ...prev,
            variants: (prev.variants || []).filter((_, i) => i !== index)
        }));
    };

    // Helper state for adding products to combo
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedProductGrams, setSelectedProductGrams] = useState(100);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        if (imagePreviews.length + files.length > 8) {
            toast.error("You can upload a maximum of 8 images.");
            return;
        }

        const validFiles: File[] = [];
        files.forEach(file => {
            if (file.size > 5 * 1024 * 1024) {
                toast.error(`Image ${file.name} is larger than 5MB`);
                return;
            }
            validFiles.push(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviews(prev => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });

        setSelectedFiles(prev => [...prev, ...validFiles]);
    };

    const removeImage = (index: number) => {
        setImagePreviews(prev => prev.filter((_, i) => i !== index));

        const existingCount = newCombo.imageURLs?.length || 0;
        if (index < existingCount) {
            const updatedURLs = [...(newCombo.imageURLs || [])];
            updatedURLs.splice(index, 1);
            setNewCombo(prev => ({ 
                ...prev, 
                imageURLs: updatedURLs, 
                imageURL: updatedURLs[0] || '' 
            }));
        } else {
            const fileIndex = index - existingCount;
            setSelectedFiles(prev => prev.filter((_, i) => i !== fileIndex));
        }
    };

    const handleAddProductToCombo = () => {
        if (!selectedProductId) return;
        const product = products.find(p => p.id === selectedProductId);
        if (!product) return;

        const alreadyExists = newCombo.products.find(p => p.productId === selectedProductId);
        if (alreadyExists) {
            toast.error("Product already added to combo");
            return;
        }

        const productImg = product.imageURL || product.image || (product.imageURLs && product.imageURLs[0]) || '';
        const comboProd: ComboProduct = {
            productId: product.id,
            name: product.name,
            grams: selectedProductGrams,
            price: Math.round((product.price / (product.baseWeight || 100)) * selectedProductGrams),
            imageURL: productImg
        };

        const updatedProducts = [...newCombo.products, comboProd];
        const newOriginalPrice = updatedProducts.reduce((sum, p) => sum + p.price, 0);

        // Auto-fill fallback image if none uploaded yet
        let updatedImagePreviews = [...imagePreviews];
        let mainImg = newCombo.imageURL;
        let allImgs = newCombo.imageURLs || [];

        if (updatedImagePreviews.length === 0 && productImg) {
            updatedImagePreviews = [productImg];
            mainImg = productImg;
            allImgs = [productImg];
            setImagePreviews(updatedImagePreviews);
        }

        setNewCombo({
            ...newCombo,
            products: updatedProducts,
            originalPrice: Math.round(newOriginalPrice),
            imageURL: mainImg,
            imageURLs: allImgs
        });
        setSelectedProductId('');
    };

    const removeProductFromCombo = (productId: string) => {
        const updatedProducts = newCombo.products.filter(p => p.productId !== productId);
        const newOriginalPrice = updatedProducts.reduce((sum, p) => sum + p.price, 0);
        setNewCombo({
            ...newCombo,
            products: updatedProducts,
            originalPrice: Math.round(newOriginalPrice)
        });
    };

    const handleSaveCombo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newCombo.products.length === 0) {
            toast.error("Please add at least one product to the combo");
            return;
        }

        if (!newCombo.name.trim()) {
            toast.error("Please enter a combo name");
            return;
        }

        const toastId = toast.loading("Saving combo...");
        try {
            setSaving(true);
            const uploadedURLs: string[] = [...(newCombo.imageURLs || [])];

            if (selectedFiles.length > 0) {
                toast.loading(`Optimizing and uploading ${selectedFiles.length} image(s)...`, { id: toastId });

                const uploadPromises = selectedFiles.map(async (file, index) => {
                    const compressedBlob = await compressImage(file, 800, 0.6);
                    const storagePath = `combos/${Date.now()}_${index}_${file.name.split('.')[0]}.jpg`;
                    const storageRef = ref(storage, storagePath);
                    const snapshot = await uploadBytes(storageRef, compressedBlob, { contentType: 'image/jpeg' });
                    return getDownloadURL(snapshot.ref);
                });

                const newURLs = await Promise.all(uploadPromises);
                uploadedURLs.push(...newURLs);
            }

            // Fallback to included products' images if no custom image was uploaded
            if (uploadedURLs.length === 0 && newCombo.products.length > 0) {
                const prodImgs = newCombo.products.map(p => p.imageURL).filter(Boolean) as string[];
                uploadedURLs.push(...prodImgs);
            }

            const rawVariants = (newCombo.variants || []).map(v => ({
                ...v,
                grams: Number(v.grams) || 0
            }));
            // Validate variants if any
            for (let i = 0; i < rawVariants.length; i++) {
                if (!rawVariants[i].title?.trim()) {
                    toast.error(`Please enter a title for Variant #${i + 1}`, { id: toastId });
                    setSaving(false);
                    return;
                }
                if (rawVariants[i].price <= 0) {
                    toast.error(`Please enter an offer price for Variant #${i + 1} (${rawVariants[i].title})`, { id: toastId });
                    setSaving(false);
                    return;
                }
            }

            const variants = sortComboVariantsLowToHigh(rawVariants);

            // Sync main price and originalPrice from first variant if default is 0
            const mainPrice = newCombo.price > 0 ? newCombo.price : (variants[0]?.price || 0);
            const mainOriginalPrice = newCombo.originalPrice > 0 ? newCombo.originalPrice : (variants[0]?.originalPrice || 0);
            const mainStatus = variants.length > 0 && newCombo.status === 'In Stock' && variants[0]?.status ? variants[0].status : newCombo.status;

            const comboData = {
                ...newCombo,
                price: mainPrice,
                originalPrice: mainOriginalPrice,
                status: mainStatus,
                variants: variants,
                imageURL: uploadedURLs[0] || '/Logo Munch Tokri.png',
                imageURLs: uploadedURLs.length > 0 ? uploadedURLs : ['/Logo Munch Tokri.png']
            };

            if (editingId) {
                await updateCombo(editingId, comboData);
                toast.success("Combo updated successfully!", { id: toastId });
            } else {
                await addCombo(comboData);
                toast.success("Combo created successfully!", { id: toastId });
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
            products: [],
            variants: []
        });
        setImagePreviews([]);
        setSelectedFiles([]);
        setEditingId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEditCombo = (combo: Combo) => {
        setNewCombo({
            name: combo.name || '',
            price: combo.price || 0,
            originalPrice: combo.originalPrice || 0,
            description: combo.description || '',
            status: combo.status || 'In Stock',
            imageURL: combo.imageURL || '',
            imageURLs: combo.imageURLs || (combo.imageURL ? [combo.imageURL] : []),
            products: combo.products || [],
            variants: (combo.variants || []).map(v => ({
                ...v,
                grams: v.grams !== undefined ? Number(v.grams) : 0
            }))
        });
        setEditingId(combo.id);
        setImagePreviews(combo.imageURLs && combo.imageURLs.length > 0 ? combo.imageURLs : (combo.imageURL ? [combo.imageURL] : []));
        setSelectedFiles([]);
        setIsAdding(false);
    };

    function renderComboForm() {
        return (
            <form onSubmit={handleSaveCombo} className={styles.formGrid}>
                {/* Standard Combo Image Upload Section */}
                <div className={styles.imageUploadSection}>
                    <label style={{ fontWeight: 600, color: '#495057', fontSize: '0.9rem' }}>
                        Combo Card Images (Max 8)
                    </label>

                    <div className={styles.imageGrid}>
                        {imagePreviews.map((preview, idx) => (
                            <div key={idx} className={styles.imagePreviewBox}>
                                <img src={preview} alt={`Combo Preview ${idx + 1}`} />
                                <button
                                    type="button"
                                    className={styles.removeImageBtn}
                                    onClick={() => removeImage(idx)}
                                    title="Remove image"
                                >
                                    <X size={14} />
                                </button>
                                {idx === 0 && <span className={styles.primaryBadge}>Primary</span>}
                            </div>
                        ))}

                        {imagePreviews.length < 8 && (
                            <div
                                className={styles.addMoreImages}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload size={24} />
                                <span>{imagePreviews.length === 0 ? 'Upload Images' : 'Add More'}</span>
                                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>max 8</span>
                            </div>
                        )}
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                    />

                    <p style={{ fontSize: '0.8rem', color: '#666', lineHeight: 1.4 }}>
                        * The primary image will be displayed on the Combo Card. Upload custom combo bundle packaging or photos.
                    </p>
                </div>

                {/* Form Fields Section */}
                <div className={styles.fieldsSection}>
                    <div className={styles.inputGroup}>
                        <label>Combo Name *</label>
                        <input 
                            type="text" 
                            value={newCombo.name} 
                            onChange={e => setNewCombo({...newCombo, name: e.target.value})}
                            placeholder="e.g. Tea Time Classic Combo"
                            required 
                        />
                    </div>

                    {/* Products Selection Box */}
                    <div className={styles.productSelection}>
                        <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.75rem' }}>
                            Included Products in Combo ({newCombo.products.length})
                        </label>

                        {newCombo.products.length > 0 ? (
                            <div className={styles.selectedProductsList}>
                                {newCombo.products.map(p => (
                                    <div key={p.productId} className={styles.selectedProductItem}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            {p.imageURL && (
                                                <img 
                                                    src={p.imageURL} 
                                                    alt={p.name} 
                                                    style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} 
                                                />
                                            )}
                                            <div>
                                                <span style={{ fontWeight: 600 }}>{p.name}</span>
                                                <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                                                    ({p.grams}g - ₹{p.price})
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeProductFromCombo(p.productId)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fa5252' }}
                                            title="Remove product"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '1rem', textAlign: 'center', color: '#888', background: '#fff', borderRadius: 10, marginBottom: '1rem', fontSize: '0.9rem' }}>
                                No products added yet. Select products from the dropdown below.
                            </div>
                        )}

                        <div className={styles.productPicker}>
                            <select 
                                value={selectedProductId} 
                                onChange={e => setSelectedProductId(e.target.value)}
                                style={{ flex: 2 }}
                            >
                                <option value="">Select a product to add...</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.stock || '100g'}) - ₹{p.price}</option>
                                ))}
                            </select>
                            <input 
                                type="text" 
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={selectedProductGrams} 
                                onChange={e => setSelectedProductGrams(Number(e.target.value.replace(/\D/g, '')) || 0)}
                                placeholder="Grams" 
                                style={{ flex: 1, minWidth: '90px' }}
                            />
                            <button type="button" className={styles.addProdBtn} onClick={handleAddProductToCombo}>
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className={styles.row}>
                        <div className={styles.inputGroup}>
                            <label>Base Price / MRP (₹)</label>
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
                            <label>Customer Savings (Auto)</label>
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

                    {/* Combo Variants Section */}
                    <div style={{ border: '1.5px solid #ccfbf1', background: '#f0fdfa', borderRadius: '16px', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Layers size={18} /> Combo Variants / Pack Options ({newCombo.variants?.length || 0})
                                </h4>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                    Add pack options (e.g. Pack of 1, Pack of 2, Family Box) with custom Base Price, Offer Price, and Status.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddVariant}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '0.55rem 0.9rem',
                                    background: '#0d9488',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer'
                                }}
                            >
                                <Plus size={16} /> Add Variant
                            </button>
                        </div>

                        {newCombo.variants && newCombo.variants.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {newCombo.variants.map((v, vIdx) => {
                                    const savings = Math.max(0, (v.originalPrice || 0) - (v.price || 0));
                                    return (
                                        <div 
                                            key={v.id || vIdx} 
                                            style={{ 
                                                background: '#fff', 
                                                border: '1px solid #99f6e4', 
                                                borderRadius: '12px', 
                                                padding: '1rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.75rem',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f766e' }}>
                                                    Variant #{vIdx + 1}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveVariant(vIdx)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                    title="Remove Variant"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                                                <div className={styles.inputGroup}>
                                                    <label style={{ fontSize: '0.78rem' }}>Variant Name / Title *</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Pack of 1, Pack of 2"
                                                        value={v.title}
                                                        onChange={(e) => handleUpdateVariant(vIdx, 'title', e.target.value)}
                                                        required
                                                    />
                                                </div>

                                                <div className={styles.inputGroup}>
                                                    <label style={{ fontSize: '0.78rem' }}>Weight / Grams (g) *</label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="e.g. 400"
                                                        value={v.grams || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === '' || /^\d*$/.test(val)) {
                                                                handleUpdateVariant(vIdx, 'grams', val ? Number(val) : 0);
                                                            }
                                                        }}
                                                    />
                                                </div>

                                                <div className={styles.inputGroup}>
                                                    <label style={{ fontSize: '0.78rem' }}>Base Price / MRP (₹) *</label>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="0.00"
                                                        value={v.originalPrice || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                handleUpdateVariant(vIdx, 'originalPrice', val ? Number(val) : 0);
                                                            }
                                                        }}
                                                        required
                                                    />
                                                </div>

                                                <div className={styles.inputGroup}>
                                                    <label style={{ fontSize: '0.78rem' }}>Combo Offer Price (₹) *</label>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="0.00"
                                                        value={v.price || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                handleUpdateVariant(vIdx, 'price', val ? Number(val) : 0);
                                                            }
                                                        }}
                                                        required
                                                    />
                                                </div>

                                                <div className={styles.inputGroup}>
                                                    <label style={{ fontSize: '0.78rem' }}>Status</label>
                                                    <select
                                                        value={v.status}
                                                        onChange={(e) => handleUpdateVariant(vIdx, 'status', e.target.value)}
                                                    >
                                                        <option value="In Stock">In Stock</option>
                                                        <option value="Low Stock">Low Stock</option>
                                                        <option value="Out of Stock">Out of Stock</option>
                                                    </select>
                                                </div>

                                                <div className={styles.inputGroup}>
                                                    <label style={{ fontSize: '0.78rem' }}>Customer Savings (Auto)</label>
                                                    <div style={{
                                                        padding: '0.75rem 0.9rem',
                                                        background: '#e6fcf5',
                                                        borderRadius: '10px',
                                                        color: '#099268',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        border: '1px solid #a7f3d0'
                                                    }}>
                                                        ₹{savings} Discount
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '1rem', background: '#fff', borderRadius: '10px', color: '#64748b', fontSize: '0.82rem' }}>
                                No custom variants added. (This combo uses the default Base Price & Offer Price above).
                            </div>
                        )}
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Description</label>
                        <textarea 
                            value={newCombo.description} 
                            onChange={e => setNewCombo({...newCombo, description: e.target.value})}
                            placeholder="Describe this combo pack..."
                            rows={3} 
                        />
                    </div>

                    <div className={styles.submitActions}>
                        <button type="button" className={styles.cancelBtn} onClick={() => { setIsAdding(false); resetForm(); }}>
                            Discard
                        </button>
                        <button type="submit" className={styles.saveBtn} disabled={saving}>
                            {saving ? 'Saving...' : editingId ? 'Update Combo' : 'Save Combo'}
                        </button>
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
                <button 
                    className={styles.addBtn} 
                    onClick={() => {
                        if (isAdding) {
                            setIsAdding(false);
                            resetForm();
                        } else {
                            setEditingId(null);
                            resetForm();
                            setIsAdding(true);
                        }
                    }}
                >
                    {isAdding ? <X size={20} /> : <Plus size={20} />}
                    {isAdding ? 'Cancel' : 'Create New Combo'}
                </button>
            </div>

            {/* Top form for Creating New Combo */}
            <AnimatePresence>
                {isAdding && !editingId && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }} 
                        className={styles.formCard}
                    >
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Create New Combo Pack</h3>
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
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                                    <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--primary)' }} />
                                </td>
                            </tr>
                        ) : combos.length > 0 ? (
                            combos.map(combo => (
                                <React.Fragment key={combo.id}>
                                    <tr className={editingId === combo.id ? styles.editingRow : ''}>
                                        <td>
                                            <div className={styles.comboCell}>
                                                <img 
                                                    src={combo.imageURL || (combo.imageURLs && combo.imageURLs[0]) || '/Logo Munch Tokri.png'} 
                                                    className={styles.comboThumb} 
                                                    alt={combo.name} 
                                                />
                                                <div className={styles.comboInfo}>
                                                    <h4>{combo.name}</h4>
                                                    <p>{combo.description ? `${combo.description.slice(0, 50)}...` : 'No description'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 600 }}>{combo.products?.length || 0} Products</span>
                                            {combo.products && combo.products.length > 0 && (
                                                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>
                                                    {combo.products.map(p => p.name).slice(0, 2).join(', ')}
                                                    {combo.products.length > 2 && ` +${combo.products.length - 2} more`}
                                                </div>
                                            )}
                                        </td>
                                        <td>{(combo.products || []).reduce((sum, p) => sum + (p.grams || 0), 0)}g</td>
                                        <td>
                                            {combo.originalPrice > combo.price && (
                                                <span className={styles.originalPrice}>₹{combo.originalPrice}</span>
                                            )}
                                            <span style={{ fontWeight: 700, color: '#0d9488', marginLeft: '0.35rem' }}>
                                                ₹{combo.price}
                                            </span>
                                            {combo.variants && combo.variants.length > 0 && (
                                                <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontSize: '0.72rem', background: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, display: 'inline-block', width: 'fit-content' }}>
                                                        {combo.variants.length} Variants
                                                    </span>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '2px' }}>
                                                        {sortComboVariantsLowToHigh(combo.variants).map((v, i) => (
                                                            <span key={i} style={{ fontSize: '0.68rem', color: '#475569', background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>
                                                                {v.title}{v.grams ? ` (${v.grams}g)` : ''}: ₹{v.price}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${combo.status === 'In Stock' ? styles.inStock : combo.status === 'Low Stock' ? styles.lowStock : styles.outOfStock}`}>
                                                {combo.status}
                                            </span>
                                        </td>
                                        <td className={styles.actionsCell}>
                                            <button 
                                                className={styles.editActionBtn} 
                                                onClick={() => {
                                                    if (editingId === combo.id) {
                                                        setEditingId(null);
                                                        resetForm();
                                                    } else {
                                                        handleEditCombo(combo);
                                                    }
                                                }}
                                                title="Edit Combo"
                                            >
                                                {editingId === combo.id ? <X size={16} /> : <Edit2 size={16} />}
                                            </button>
                                            {user && user.role.toLowerCase() !== 'employee' && (
                                                <button 
                                                    className={styles.deleteActionBtn} 
                                                    onClick={() => {
                                                        showConfirm(`Delete combo "${combo.name}"?`, () => deleteCombo(combo.id));
                                                    }}
                                                    title="Delete Combo"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Inline Edit Form */}
                                    <AnimatePresence>
                                        {editingId === combo.id && (
                                            <tr>
                                                <td colSpan={6} style={{ padding: 0, border: 'none' }}>
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        style={{ overflow: 'hidden' }}
                                                    >
                                                        <div className={styles.inlineFormContainer}>
                                                            <div className={styles.inlineHeader}>
                                                                <h3>Edit Combo: {combo.name}</h3>
                                                                <button onClick={() => { setEditingId(null); resetForm(); }}>
                                                                    <X size={18} />
                                                                </button>
                                                            </div>
                                                            {renderComboForm()}
                                                        </div>
                                                    </motion.div>
                                                </td>
                                            </tr>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#adb5bd' }}>
                                    <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                    <p>No combo packs created yet.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
