"use client";

export const dynamic = "force-dynamic";

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { useProducts } from '@/hooks/useFirestore';
import { Product } from '@/types';
import { useFirebase } from '@/contexts/FirebaseContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '@/lib/image-utils';
import {
    Plus,
    X,
    Upload,
    ImageIcon,
    Save,
    Package,
    Tag,
    Edit2,
    Trash2,
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'react-hot-toast';
import { useNotification } from '@/contexts/NotificationContext';
import styles from './inventory.module.css';

export default function InventoryPage() {
    const { products, loading, addProduct, updateProduct, deleteProduct } = useProducts();
    const { storage } = useFirebase();
    const { showConfirm } = useNotification();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Arrays for multiple images (max 8)
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [newProduct, setNewProduct] = useState<Omit<Product, 'id'>>({
        name: '',
        category: 'Snacks',
        stock: '',
        price: 0,
        originalPrice: 0,
        status: 'In Stock',
        discount: 0,
        description: '',
        overview: '',
        features: [],
        imageURL: '',
        imageURLs: [],
        tags: '',
        isTopProduct: false,
        isLimitedEdition: false,
        isLimitedOffer: false,
        salesCount: 0
    });

    const categories = ['Snacks', 'Mixes', 'Karnataka Specialties', 'Healthy Bites', 'Sweets'];

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        // Check total limit
        if (selectedFiles.length + imagePreviews.length + files.length > 8) {
            toast.error("You can upload a maximum of 8 images.");
            return;
        }

        const validFiles: File[] = [];
        const validPreviews: string[] = [];

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
        // Find if this is a newly selected file or an existing preview
        // Since we append selectedFiles previews to the existing ones (from imageURLs)
        setImagePreviews(prev => prev.filter((_, i) => i !== index));

        // If it was an existing URL, we must remove it from the newProduct.imageURLs array
        // If it was a new file, we must remove it from the selectedFiles array
        const existingCount = newProduct.imageURLs?.length || 0;

        if (index < existingCount) {
            const updatedURLs = [...(newProduct.imageURLs || [])];
            updatedURLs.splice(index, 1);
            setNewProduct(prev => ({ ...prev, imageURLs: updatedURLs, imageURL: updatedURLs[0] || '' }));
        } else {
            const fileIndex = index - existingCount;
            setSelectedFiles(prev => prev.filter((_, i) => i !== fileIndex));
        }
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();

        const totalImages = (newProduct.imageURLs?.length || 0) + selectedFiles.length;
        if (totalImages === 0) {
            toast.error("Please provide at least one product image.");
            return;
        }

        const toastId = toast.loading("Preparing to save...");
        try {
            setSaving(true);
            const uploadedURLs: string[] = [...(newProduct.imageURLs || [])];

            if (selectedFiles.length > 0) {
                toast.loading(`Optimizing and uploading ${selectedFiles.length} image(s)...`, { id: toastId });

                const uploadPromises = selectedFiles.map(async (file, index) => {
                    const compressedBlob = await compressImage(file, 800, 0.6);
                    const storagePath = `products/${Date.now()}_${index}_${file.name.split('.')[0]}.jpg`;
                    const storageRef = ref(storage, storagePath);
                    const snapshot = await uploadBytes(storageRef, compressedBlob, { contentType: 'image/jpeg' });
                    return getDownloadURL(snapshot.ref);
                });

                const newURLs = await Promise.all(uploadPromises);
                uploadedURLs.push(...newURLs);
            }

            toast.loading("Saving product to database...", { id: toastId });

            const productData = {
                ...newProduct,
                imageURL: uploadedURLs[0] || '', // Primary image
                imageURLs: uploadedURLs // All images array
            };

            if (editingId) {
                await updateProduct(editingId, productData);
                toast.success("Product updated successfully!", { id: toastId });
            } else {
                await addProduct(productData);
                toast.success("Product is now live!", { id: toastId });
            }

            setIsAdding(false);
            resetForm();
        } catch (error: any) {
            console.error("Save Error:", error);
            toast.error(error.message || "Failed to save product.", { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setNewProduct({
            name: '',
            category: 'Snacks',
            stock: '',
            price: 0,
            originalPrice: 0,
            status: 'In Stock',
            discount: 0,
            description: '',
            overview: '',
            features: [],
            imageURL: '',
            imageURLs: [],
            tags: '',
            isTopProduct: false,
            isLimitedEdition: false,
            isLimitedOffer: false,
            salesCount: 0
        });
        setImagePreviews([]);
        setSelectedFiles([]);
        setEditingId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEditBtn = (product: Product) => {
        setNewProduct({
            name: product.name || '',
            category: product.category || 'Snacks',
            stock: product.stock || '',
            price: product.price || 0,
            originalPrice: product.originalPrice || 0,
            status: product.status || 'In Stock',
            discount: product.discount || 0,
            description: product.description || '',
            overview: product.overview || '',
            features: product.features || [],
            imageURL: product.imageURL || product.image || '',
            imageURLs: product.imageURLs || (product.imageURL || product.image ? [product.imageURL || product.image as string] : []),
            tags: product.tags || '',
            isTopProduct: !!product.isTopProduct,
            isLimitedEdition: !!product.isLimitedEdition,
            isLimitedOffer: !!product.isLimitedOffer,
            salesCount: product.salesCount || 0
        });
        setEditingId(product.id);
        setImagePreviews(product.imageURLs || (product.imageURL || product.image ? [product.imageURL || product.image as string] : []));
        setSelectedFiles([]);
        setIsAdding(false);
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        const nextStatus = currentStatus === 'In Stock' ? 'Low Stock' : currentStatus === 'Low Stock' ? 'Out of Stock' : 'In Stock';
        try {
            await updateProduct(id, { status: nextStatus });
        } catch (error) {
            console.error("Error updating product status:", error);
        }
    };

    const handleDeleteProduct = (id: string, name: string) => {
        showConfirm(
            `Are you sure you want to remove "${name}"? This action cannot be undone.`,
            async () => {
                const toastId = toast.loading("Removing product...");
                try {
                    await deleteProduct(id);
                    toast.success("Product removed successfully", { id: toastId });
                    if (editingId === id) {
                        setIsAdding(false);
                        resetForm();
                    }
                } catch (error: any) {
                    console.error("Delete Error:", error);
                    toast.error(error.message || "Failed to remove product.", { id: toastId });
                }
            },
            { title: 'Confirm Removal' }
        );
    };

    return (
        <div className={styles.container}>
            <Toaster position="top-right" />

            <div className={styles.header}>
                <h1>Inventory Control</h1>
                <button
                    className={styles.addBtn}
                    onClick={() => {
                        setEditingId(null);
                        if (isAdding) {
                            setIsAdding(false);
                            resetForm();
                        } else {
                            setIsAdding(true);
                        }
                    }}
                >
                    {isAdding ? <X size={20} /> : <Plus size={20} />}
                    {isAdding ? 'Cancel' : 'Add New Product'}
                </button>
            </div>

            {/* Top form ONLY for Adding New Product */}
            <AnimatePresence>
                {isAdding && !editingId && (
                    <motion.div
                        initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                        animate={{ height: 'auto', opacity: 1, overflow: 'visible' }}
                        exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                        className={styles.formCard}
                    >
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Add New Product</h3>
                        {renderProductForm()}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={styles.tableCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Category</th>
                            <th>Grams</th>
                            <th>Price</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                                <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: 'var(--primary)' }} />
                            </td></tr>
                        ) : products.length > 0 ? (
                            products.map((row) => (
                                <React.Fragment key={row.id}>
                                    <tr className={editingId === row.id ? styles.editingRow : ''}>
                                        <td>
                                            <div className={styles.productCell}>
                                                <img
                                                    src={row.imageURL || row.image || '/logo.png'}
                                                    alt={row.name}
                                                    className={styles.productThumb}
                                                />
                                                <div className={styles.productInfo}>
                                                    <h4>{row.name}</h4>
                                                    <p>{row.description || 'No description'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Tag size={14} />
                                                {row.category}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{
                                                fontWeight: 600,
                                                color: row.status === 'Low Stock' ? '#f08c00' :
                                                    row.status === 'Out of Stock' ? '#fa5252' : '#495057'
                                            }}>
                                                {row.stock}
                                            </span>
                                        </td>
                                        <td>₹{row.price}</td>
                                        <td>
                                            <span
                                                className={`${styles.statusBadge} ${row.status === 'In Stock' ? styles.inStock :
                                                    row.status === 'Low Stock' ? styles.lowStock :
                                                        styles.outOfStock
                                                    }`}
                                                onClick={() => toggleStatus(row.id, row.status)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className={styles.actionsCell}>
                                            <button
                                                className={editingId === row.id ? styles.activeEditBtn : styles.editActionBtn}
                                                onClick={() => {
                                                    if (editingId === row.id) {
                                                        setEditingId(null);
                                                        resetForm();
                                                    } else {
                                                        handleEditBtn(row);
                                                    }
                                                }}
                                            >
                                                {editingId === row.id ? <X size={16} /> : <Edit2 size={16} />}
                                                {editingId === row.id ? 'Close' : 'Edit'}
                                            </button>
                                            <button
                                                className={styles.deleteActionBtn}
                                                onClick={() => handleDeleteProduct(row.id, row.name)}
                                            >
                                                <Trash2 size={16} /> Remove
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Inline Edit Dropdown */}
                                    <AnimatePresence>
                                        {editingId === row.id && (
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
                                                                <h3>Edit: {row.name}</h3>
                                                                <button onClick={() => { setEditingId(null); resetForm(); }}>
                                                                    <X size={18} />
                                                                </button>
                                                            </div>
                                                            {renderProductForm()}
                                                        </div>
                                                    </motion.div>
                                                </td>
                                            </tr>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            ))
                        ) : (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#adb5bd' }}>
                                <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                <p>No products found in inventory.</p>
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    function renderProductForm() {
        return (
            <form onSubmit={handleSaveProduct} className={styles.formGrid}>
                {/* Image Upload Column */}
                <div className={styles.imageUploadSection}>
                    <div className={styles.imageGrid}>
                        {imagePreviews.map((preview, idx) => (
                            <div key={idx} className={styles.imagePreviewBox}>
                                <img src={preview} alt={`Preview ${idx + 1}`} />
                                <button
                                    type="button"
                                    className={styles.removeImageBtn}
                                    onClick={() => removeImage(idx)}
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
                        className={styles.uploadInput}
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                    />

                </div>

                {/* Content Fields Column */}
                <div className={styles.fieldsSection}>
                    <div className={styles.inputGroup}>
                        <label>Product Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Traditional Spicy Mixture"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className={styles.row}>
                        <div className={styles.inputGroup}>
                            <label>Category</label>
                            <select
                                value={newProduct.category}
                                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                            >
                                {categories.map(cat => <option key={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Inventory Status</label>
                            <select
                                value={newProduct.status}
                                onChange={(e) => setNewProduct({ ...newProduct, status: e.target.value })}
                            >
                                <option>In Stock</option>
                                <option>Low Stock</option>
                                <option>Out of Stock</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.inputGroup}>
                            <label>Final Price (Selling Price ₹)</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={newProduct.price || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        setNewProduct({ ...newProduct, price: val ? Number(val) : 0 });
                                    }
                                }}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Original Price (MRP ₹)</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={newProduct.originalPrice || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        setNewProduct({ ...newProduct, originalPrice: val ? Number(val) : 0 });
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.inputGroup}>
                            <label>Grams (Display String)</label>
                            <input
                                type="text"
                                placeholder="e.g. 250 gm"
                                value={newProduct.stock}
                                onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Product Tags (Optional)</label>
                            <input
                                type="text"
                                placeholder="Best Seller, New Arrival..."
                                value={newProduct.tags}
                                onChange={(e) => setNewProduct({ ...newProduct, tags: e.target.value })}
                            />
                        </div>
                    </div>
 
                    <div className={styles.labelSection}>
                        <label className={styles.sectionLabel}>Product Highlights</label>
                        <div className={styles.checkboxRow}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={newProduct.isTopProduct}
                                    onChange={(e) => setNewProduct({ ...newProduct, isTopProduct: e.target.checked })}
                                />
                                <span>Top Product</span>
                            </label>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={newProduct.isLimitedEdition}
                                    onChange={(e) => setNewProduct({ ...newProduct, isLimitedEdition: e.target.checked })}
                                />
                                <span>Limited Edition</span>
                            </label>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={newProduct.isLimitedOffer}
                                    onChange={(e) => setNewProduct({ ...newProduct, isLimitedOffer: e.target.checked })}
                                />
                                <span>Limited Offer</span>
                            </label>
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Short Description</label>
                        <input
                            type="text"
                            placeholder="A brief catchy description for cards"
                            value={newProduct.description}
                            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Full Overview</label>
                        <textarea
                            rows={3}
                            placeholder="Detailed info about ingredients, taste, and tradition..."
                            value={newProduct.overview}
                            onChange={(e) => setNewProduct({ ...newProduct, overview: e.target.value })}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Key Features (One per line)</label>
                        <textarea
                            rows={4}
                            placeholder="✦ No Preservatives&#10;✦ traditional Recipe&#10;✦ Made with Rice Bran Oil"
                            value={newProduct.features?.join('\n')}
                            onChange={(e) => setNewProduct({ ...newProduct, features: e.target.value.split('\n') })}
                        />
                    </div>

                    <div className={styles.submitActions}>
                        {editingId && (
                            <button
                                type="button"
                                className={styles.deleteFormBtn}
                                onClick={() => handleDeleteProduct(editingId, newProduct.name)}
                                disabled={saving}
                            >
                                <Trash2 size={18} style={{ marginRight: '8px' }} />
                                Remove Product
                            </button>
                        )}
                        <button type="button" className={styles.cancelBtn} onClick={() => {
                            if (editingId) setEditingId(null);
                            else setIsAdding(false);
                            resetForm();
                        }}>Discard</button>
                        <button type="submit" className={styles.saveBtn} disabled={saving}>
                            {saving ? (
                                <Loader2 size={18} className="animate-spin" style={{ marginRight: '8px' }} />
                            ) : (
                                <Save size={18} style={{ marginRight: '8px' }} />
                            )}
                            {saving ? 'Saving...' : (editingId ? 'Update Product' : 'Save Product')}
                        </button>
                    </div>
                </div>
            </form>
        );
    }
}
