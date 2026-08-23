"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
    collection, getDocs, query, orderBy, onSnapshot,
    doc, getDoc, setDoc, deleteDoc, where, limit, Timestamp, serverTimestamp
} from 'firebase/firestore';
import { adminDb } from '@/lib/firebase';
import {
    Users,
    Calendar,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Search,
    Filter,
    RefreshCw,
    User as UserIcon,
    CreditCard,
    Settings,
    Save,
    PlusCircle,
    Trash2,
    Edit3,
    Star,
    Link as LinkIcon,
    IndianRupee,
    Loader2,
    ChevronRight,
    Trophy,
    Coins,
    Sparkles,
    HelpCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import styles from './Memberships.module.css';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────
interface MembershipPlan {
    id: string;
    name: string;
    price: number;
    priceLabel: string;
    tagline: string;
    razorpayPlanId: string;
    razorpaySubscriptionId: string;
    razorpayPaymentLink: string;
    benefits: string[];
    isLive: boolean;
    pointsReward: number;
}

interface LoyaltyConfig {
    pointsPerRupee: number;
    pointsValueInRupees: number;
    minRedeemPoints: number;
    baseSpendingAmount?: number;
    pointsPerBase?: number;
}

interface SiteMembershipConfig {
    plans: MembershipPlan[];
    loyalty: LoyaltyConfig;
    wholesaleThresholdKg: number;
    wholesalePricePerKg: number;
    packagingCostPerPack: number;
    packagingBaseGrams: number;
    discountTiers: { threshold: number; percentage: number }[];
}

const DEFAULT_PLAN: MembershipPlan = {
    id: 'plan_' + Date.now(),
    name: 'Annual Membership',
    price: 300,
    priceLabel: '/ year',
    tagline: "That's less than ₹1 per day!",
    razorpayPlanId: '',
    razorpaySubscriptionId: '',
    razorpayPaymentLink: '',
    benefits: [
        'Free Delivery on all orders',
        'Flat 10% Extra Discount',
        'Early Access to New Products',
        'Priority Support',
    ],
    isLive: true,
    pointsReward: 100,
};

const DEFAULT_LOYALTY: LoyaltyConfig = {
    pointsPerRupee: 0.02,
    pointsValueInRupees: 5,
    minRedeemPoints: 1,
    baseSpendingAmount: 100,
    pointsPerBase: 2,
};

const DEFAULT_CONFIG: SiteMembershipConfig = {
    plans: [DEFAULT_PLAN],
    loyalty: DEFAULT_LOYALTY,
    wholesaleThresholdKg: 10,
    wholesalePricePerKg: 350,
    packagingCostPerPack: 15,
    packagingBaseGrams: 250,
    discountTiers: [
        { threshold: 1200, percentage: 15 },
        { threshold: 600, percentage: 10 },
        { threshold: 450, percentage: 7 },
        { threshold: 300, percentage: 5 },
    ]
};

const DEFAULT_PAGE_CONTENT = {
    hero: {
        label: "The Munch Tokri Club",
        title: "Elevate Your Snacking Game",
        desc: "Join our exclusive club and unlock premium benefits, huge savings, and priority access to Karnataka's finest handcrafted snacks."
    },
    benefits: [
        { title: "Free Delivery Always", desc: "No more minimum order values. Get free shipping on every single order, no matter how small." },
        { title: "Flat 10% Extra Off", desc: "Save more on every purchase. Members get an additional 10% discount that stacks with other offers." },
        { title: "Priority Handling", desc: "Skip the queue. Member orders are packed and dispatched with the highest priority." },
        { title: "Early Access", desc: "Be the first to taste our new launches and seasonal special combos before they go public." },
        { title: "Exclusive Offers", desc: "Access member-only flash sales and special discounts curated just for the Munch Tokri Club." },
        { title: "VIP Support", desc: "Direct access to our dedicated customer delight team for any assistance you need." },
        { title: "Birthday Special", desc: "Celebrate with us! Get a special surprise gift or extra discount during your birthday month." },
        { title: "Bulk Discounts", desc: "Ordering for an event? Members get exclusive wholesale pricing on bulk orders." },
        { title: "Member-Only Mixes", desc: "Access limited-edition mixture combinations and custom packs available only to the club." }
    ],
    faqs: [
        { q: "What is the Munch Tokri Club?", a: "It's our exclusive membership program designed for our most loyal customers to enjoy extra savings, free shipping, and priority service." },
        { q: "How much does it cost?", a: "The membership is very affordable. Join to unlock massive savings!" },
        { q: "How do I use my discount?", a: "Once you're a member, your member benefits are automatically applied at checkout when you're logged into your account. No coupon codes needed!" },
        { q: "Is there a limit on free delivery?", a: "For club members, we offer free delivery on orders as per the plan benefits. Most plans include unlimited free delivery nationwide!" }
    ],
    comparison: [
        { feature: "Extra 10% Off Every Order", guest: "No", member: "Yes" },
        { feature: "Unlimited Free Delivery", guest: "Starts at ₹350", member: "Always Free" },
        { feature: "Priority Order Packing", guest: "Standard", member: "VIP Priority" },
        { feature: "Early Access to Special Packs", guest: "No", member: "Yes" },
        { feature: "Member-only Flash Sales", guest: "No", member: "Yes" }
    ]
};

import { useSearchParams } from 'next/navigation';

// ─────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────
export default function MembershipsPage() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<'subscribers' | 'settings' | 'page'>('subscribers');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'page') setActiveTab('page');
        else if (tab === 'settings') setActiveTab('settings');
        else if (tab === 'subscribers') setActiveTab('subscribers');
    }, [searchParams]);

    return (
        <div className={styles.container}>
            {/* ── Page Header ── */}
            <div className={styles.header}>
                <div className={styles.titleWrapper}>
                    <div className={styles.iconBox}>
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <h1>Membership Management</h1>
                        <p>Monitor members &amp; configure your plans &amp; loyalty points</p>
                    </div>
                </div>
            </div>

            {/* ── Tab Navigation ── */}
            <div className={styles.tabNav}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'subscribers' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('subscribers')}
                >
                    <Users size={16} />
                    <span>Subscribers</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    <Settings size={16} />
                    <span>Plans &amp; Points</span>
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'page' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('page')}
                >
                    <Edit3 size={16} />
                    <span>Page Edit</span>
                </button>
            </div>

            {/* ── Tab Content ── */}
            {activeTab === 'subscribers' ? (
                <SubscribersTab />
            ) : activeTab === 'settings' ? (
                <PlanSettingsTab />
            ) : (
                <PageEditTab />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────
// Tab 1 – Subscribers
// ─────────────────────────────────────────────────
function SubscribersTab() {
    const [memberships, setMemberships] = useState<any[]>([]);
    const [customerMap, setCustomerMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Manual activation state
    const [showManualForm, setShowManualForm] = useState(false);
    const [manualUser, setManualUser] = useState({ email: '', planId: '', months: '12' });
    const [siteConfig, setSiteConfig] = useState<any>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            const snap = await getDoc(doc(adminDb, 'settings', 'membership'));
            if (snap.exists()) setSiteConfig(snap.data());
        };
        fetchConfig();
    }, []);

    useEffect(() => {
        setLoading(true);
        // Live listener for memberships
        const q = query(collection(adminDb, 'memberships'), orderBy('createdAt', 'desc'));
        const unsubscribeMemberships = onSnapshot(q, async (snapshot) => {
            const subs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setMemberships(subs);
            setLoading(false);
        }, (err) => {
            console.error('Memberships Listen Error:', err);
            toast.error('Failed to listen to memberships');
            setLoading(false);
        });

        // Separate lookup for customer emails (can be large, so we fetch once or on change)
        const fetchEmails = async () => {
            const custSnap = await getDocs(collection(adminDb, 'customers'));
            const emailLookup: Record<string, string> = {};
            custSnap.docs.forEach(d => {
                emailLookup[d.id] = d.data().email || 'No email';
            });
            setCustomerMap(emailLookup);
        };
        fetchEmails();

        return () => unsubscribeMemberships();
    }, []);

    const handleManualActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualUser.email || !manualUser.planId) {
            toast.error('Please fill Email and select a plan');
            return;
        }

        const plan = siteConfig?.plans?.find((p: any) => p.id === manualUser.planId);
        if (!plan) {
            toast.error('Plan not found in configuration');
            return;
        }

        setLoading(true);
        const actionToast = toast.loading('Searching for user & activating...');
        try {
            const cleanedEmail = manualUser.email.toLowerCase().trim();
            console.log(`[Admin] Manually activating membership for: ${cleanedEmail}`);

            // 1. Lookup UID accurately
            const customersRef = collection(adminDb, 'customers');
            const q = query(customersRef, where('email', '==', cleanedEmail), limit(1));
            const querySnap = await getDocs(q);

            if (querySnap.empty) {
                console.error(`[Admin] Activation Failed: User with email ${cleanedEmail} not found in 'customers' collection.`);
                throw new Error('No registered user found with this email. Have they signed up on the site?');
            }

            const userDoc = querySnap.docs[0];
            const foundUid = userDoc.id;
            console.log(`[Admin] Found UID: ${foundUid} for email: ${cleanedEmail}`);

            const now = new Date();
            const expiry = new Date();
            expiry.setMonth(now.getMonth() + parseInt(manualUser.months));

            const manualSub = {
                userId: foundUid,
                userEmail: cleanedEmail,
                planId: manualUser.planId,
                planName: plan.name,
                amount: plan.price,
                status: 'active',
                type: 'manual',
                subscriptionId: 'manual_' + Date.now().toString().slice(-6),
                startDate: Timestamp.fromDate(now),
                expiryDate: Timestamp.fromDate(expiry),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            // 2. Create membership record
            console.log('[Admin] Writing to memberships collection...');
            await setDoc(doc(adminDb, 'memberships', manualSub.subscriptionId), manualSub);

            // 3. Grant points
            if (plan.pointsReward > 0) {
                console.log(`[Admin] Rewarding ${plan.pointsReward} bonus points...`);
                const customerRef = doc(adminDb, 'customers', foundUid);
                const currentPoints = userDoc.data().loyaltyPoints || 0;
                await setDoc(customerRef, { loyaltyPoints: currentPoints + plan.pointsReward }, { merge: true });
            }

            toast.success(`Active! ${plan.name} granted to ${cleanedEmail}`, { id: actionToast });
            setShowManualForm(false);
            setManualUser({ email: '', planId: '', months: '12' });

            // Wait slightly for Firebase and refresh
            // Handled by live listener
        } catch (e: any) {
            console.error('[Admin] Manual Activation CRASH:', e);
            toast.error('Activation Error: ' + e.message, { id: actionToast });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (subId: string) => {
        if (!confirm('Are you sure you want to cancel this membership? It will stop benefits immediately.')) return;
        setLoading(true);
        try {
            await setDoc(doc(adminDb, 'memberships', subId), {
                status: 'cancelled',
                updatedAt: serverTimestamp()
            }, { merge: true });
            toast.success('Membership cancelled successfully');
        } catch (e: any) {
            toast.error('Failed to cancel: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const filtered = memberships.filter(m => {
        const userEmail = customerMap[m.userId] || m.userEmail || '';
        const matchSearch =
            userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.subscriptionId?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchFilter = filterStatus === 'all' || m.status === filterStatus;
        return matchSearch && matchFilter;
    });

    const activeCount = memberships.filter(m => m.status === 'active').length;
    const cancelledCount = memberships.filter(m => m.status === 'cancelled').length;
    const totalRev = memberships.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);

    return (
        <>
            {/* Stats */}
            <div className={styles.statsGrid}>
                <StatCard icon={<Users size={20} />} label="Total Members" value={memberships.length} iconClass={styles.iconBlue} />
                <StatCard icon={<CheckCircle2 size={20} />} label="Active" value={activeCount} iconClass={styles.iconGreen} valueClass={styles.valueGreen} />
                <StatCard icon={<XCircle size={20} />} label="Cancelled" value={cancelledCount} iconClass={styles.iconRed} valueClass={styles.valueRed} />
                <StatCard 
                    icon={<IndianRupee size={20} />} 
                    label="Total Revenue" 
                    value={totalRev} 
                    iconClass={styles.iconBlue} 
                    // @ts-ignore
                    prefix="₹"
                />
            </div>

            {/* Controls */}
            <div className={styles.tableControls}>
                <div className={styles.searchBox}>
                    <Search size={16} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Search by User ID or Sub ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className={styles.filters}>
                    <button onClick={() => setShowManualForm(!showManualForm)} className={styles.manualBtn}>
                        <PlusCircle size={15} />
                        <span>Manual Activate</span>
                    </button>
                    <div className={styles.filterItem}>
                        <Filter size={14} />
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Manual Form */}
            {showManualForm && (
                <div className={styles.manualFormCard}>
                    <div className={styles.manualFormHeader}>
                        <h3>Manual Activation</h3>
                        <button onClick={() => setShowManualForm(false)}>×</button>
                    </div>
                    <form onSubmit={handleManualActivate} className={styles.manualForm}>
                        <div className={styles.inputGroup}>
                            <label>User Gmail</label>
                            <input
                                type="email"
                                placeholder="customer@gmail.com"
                                value={manualUser.email}
                                onChange={e => setManualUser({ ...manualUser, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Select Plan</label>
                            <select
                                value={manualUser.planId}
                                onChange={e => setManualUser({ ...manualUser, planId: e.target.value })}
                                required
                            >
                                <option value="">Select a plan...</option>
                                {siteConfig?.plans?.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Duration (Months)</label>
                            <input
                                type="number"
                                value={manualUser.months}
                                onChange={e => setManualUser({ ...manualUser, months: e.target.value })}
                                required
                            />
                        </div>
                        <button type="submit" className={styles.btnFull} disabled={loading}>
                            Activate Plan Now
                        </button>
                    </form>
                </div>
            )}

            {/* Table */}
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>User Details</th>
                            <th>Plan</th>
                            <th>Dates</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    <td colSpan={5}><div className={styles.skeleton} /></td>
                                </tr>
                            ))
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className={styles.emptyTable}>
                                    <AlertCircle size={36} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                                    <p>No memberships found</p>
                                </td>
                            </tr>
                        ) : (
                            filtered.map(m => (
                                <tr key={m.id}>
                                    <td>
                                        <div className={styles.userInfo}>
                                            <div className={styles.userAvatar}><UserIcon size={15} /></div>
                                            <div>
                                                <p className={styles.userId}>{customerMap[m.userId] || m.userEmail || m.userId}</p>
                                                <span className={styles.subId}>{m.subscriptionId}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <p className={styles.planName}>{m.planName || 'Membership'}</p>
                                        <span className={styles.planPrice}>₹{m.amount}</span>
                                    </td>
                                    <td>
                                        <div className={styles.dates}>
                                            <div className={styles.dateRow}>
                                                <Calendar size={11} />
                                                <span>Start: {m.startDate?.seconds ? new Date(m.startDate.seconds * 1000).toLocaleDateString() : '—'}</span>
                                            </div>
                                            <div className={`${styles.dateRow} ${styles.dateExpiry}`}>
                                                <Calendar size={11} />
                                                <span>Expiry: {m.expiryDate?.seconds ? new Date(m.expiryDate.seconds * 1000).toLocaleDateString() : '—'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${styles[m.status] || ''}`}>
                                            {m.status}
                                        </span>
                                    </td>
                                    <td>
                                        {m.status === 'active' && (
                                            <button
                                                onClick={() => handleCancel(m.subscriptionId)}
                                                className={styles.cancelBtn}
                                            >
                                                <XCircle size={14} />
                                                <span>Cancel</span>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────
// Tab 2 – Plan Settings
// ─────────────────────────────────────────────────
function PlanSettingsTab() {
    const [siteConfig, setSiteConfig] = useState<SiteMembershipConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

    // Benefit editing state (scoped to the currently editing plan)
    const [newBenefit, setNewBenefit] = useState('');
    const [editingBenefitIdx, setEditingBenefitIdx] = useState<number | null>(null);
    const [editingBenefitText, setEditingBenefitText] = useState('');

    // Live listener for config
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(adminDb, 'settings', 'membership'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                // Merge with defaults to ensure all fields exist
                setSiteConfig({
                    ...DEFAULT_CONFIG,
                    ...data,
                    plans: data.plans || [DEFAULT_PLAN],
                    loyalty: { ...DEFAULT_LOYALTY, ...data.loyalty }
                } as SiteMembershipConfig);
                setLoading(false);
            } else {
                // Try legacy path if new doesn't exist
                getDoc(doc(adminDb, 'siteConfig', 'membership')).then(oldSnap => {
                    if (oldSnap.exists()) {
                        setSiteConfig({ ...DEFAULT_CONFIG, ...oldSnap.data() } as SiteMembershipConfig);
                    }
                    setLoading(false);
                });
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        // If we are currently editing a benefit, commit it first to state
        if (editingBenefitIdx !== null && editingPlanId) {
            const plan = siteConfig.plans.find(p => p.id === editingPlanId);
            if (plan) {
                const updatedBenefits = [...plan.benefits];
                updatedBenefits[editingBenefitIdx] = editingBenefitText.trim() || updatedBenefits[editingBenefitIdx];

                const updatedConfig = {
                    ...siteConfig,
                    plans: siteConfig.plans.map(p => p.id === editingPlanId ? { ...p, benefits: updatedBenefits } : p)
                };

                setSiteConfig(updatedConfig);
                await performActualSave(updatedConfig);
                setEditingBenefitIdx(null);
                return;
            }
        }

        await performActualSave(siteConfig);
    };

    const performActualSave = async (configToSave: SiteMembershipConfig) => {
        // Validation
        const invalidPlan = configToSave.plans.find(p => !p.name.trim() || !p.price);
        if (invalidPlan) {
            toast.error(`Please fill Plan Name and Price`);
            return;
        }

        setSaving(true);
        try {
            console.log('Admin Pushing Live Changes...', configToSave);
            await setDoc(doc(adminDb, 'settings', 'membership'), configToSave);

            // Wait slightly for Firebase propagation
            await new Promise(r => setTimeout(r, 600));

            toast.success('🚀 LIVE DATA SAVED! Your changes are now permanent.');
            setSiteConfig(configToSave);
        } catch (e: any) {
            console.error('LIVE SAVE PERMISSION ERROR:', e);
            toast.error('Live save failed (Permission): ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const onSearchEnter = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        }
    };

    const addPlan = () => {
        const newPlan: MembershipPlan = {
            ...DEFAULT_PLAN,
            id: 'plan_' + Date.now(),
            name: 'New Membership Tier',
            isLive: false
        };
        setSiteConfig(c => ({ ...c, plans: [...c.plans, newPlan] }));
        setEditingPlanId(newPlan.id);
    };

    const deletePlan = (id: string) => {
        if (!confirm('Are you sure you want to delete this plan?')) return;
        setSiteConfig(c => ({ ...c, plans: c.plans.filter(p => p.id !== id) }));
        if (editingPlanId === id) setEditingPlanId(null);
    };

    const updatePlanField = (id: string, field: keyof MembershipPlan, value: any) => {
        setSiteConfig(c => ({
            ...c,
            plans: c.plans.map(p => p.id === id ? { ...p, [field]: value } : p)
        }));
    };

    const updateLoyaltyField = (field: keyof LoyaltyConfig, value: number) => {
        setSiteConfig(prev => ({
            ...prev,
            loyalty: { ...prev.loyalty, [field]: value }
        }));
    };

    const updateTier = (index: number, field: 'threshold' | 'percentage', value: number) => {
        setSiteConfig(prev => {
            const tiers = [...prev.discountTiers];
            tiers[index] = { ...tiers[index], [field]: value };
            return { ...prev, discountTiers: tiers };
        });
    };

    const addTier = () => {
        setSiteConfig(prev => ({
            ...prev,
            discountTiers: [...prev.discountTiers, { threshold: 0, percentage: 0 }]
        }));
    };

    const removeTier = (index: number) => {
        setSiteConfig(prev => ({
            ...prev,
            discountTiers: prev.discountTiers.filter((_, i) => i !== index)
        }));
    };

    const addBenefit = (planId: string) => {
        const trimmed = newBenefit.trim();
        if (!trimmed) return;
        setSiteConfig(c => ({
            ...c,
            plans: c.plans.map(p => p.id === planId ? { ...p, benefits: [...p.benefits, trimmed] } : p)
        }));
        setNewBenefit('');
    };

    const removeBenefit = (planId: string, idx: number) => {
        setSiteConfig(c => ({
            ...c,
            plans: c.plans.map(p => p.id === planId ? { ...p, benefits: p.benefits.filter((_, i) => i !== idx) } : p)
        }));
    };

    const saveEditBenefit = (planId: string) => {
        if (editingBenefitIdx === null) return;
        setSiteConfig(c => ({
            ...c,
            plans: c.plans.map(p => {
                if (p.id !== planId) return p;
                const updated = [...p.benefits];
                updated[editingBenefitIdx] = editingBenefitText.trim() || updated[editingBenefitIdx];
                return { ...p, benefits: updated };
            })
        }));
        setEditingBenefitIdx(null);
    };

    if (loading) {
        return (
            <div className={styles.loadingCenter}>
                <Loader2 size={32} className={styles.spin} style={{ color: 'var(--primary)' }} />
                <p>Loading plan settings…</p>
            </div>
        );
    }

    return (
        <div className={styles.settingsGrid}>

            {/* ── Left Column: Plans List ── */}
            <div className={styles.plansSection}>
                <div className={styles.sectionHeader}>
                    <div className={styles.headerLeft}>
                        <Trophy size={20} />
                        <h3>Membership Plans</h3>
                    </div>
                    <button onClick={addPlan} className={styles.btnAddPlan}>
                        <PlusCircle size={16} />
                        New Plan
                    </button>
                </div>

                <div className={styles.plansList}>
                    {siteConfig.plans.map(plan => (
                        <div
                            key={plan.id}
                            className={`${styles.planItemCard} ${editingPlanId === plan.id ? styles.planActive : ''}`}
                            onClick={() => setEditingPlanId(plan.id)}
                        >
                            <div className={styles.planInfo}>
                                <div className={styles.planTitleRow}>
                                    <h4>{plan.name}</h4>
                                    {plan.isLive && <span className={styles.liveBadge}>LIVE</span>}
                                </div>
                                <p>₹{plan.price} {plan.priceLabel}</p>
                            </div>
                            <div className={styles.planMeta}>
                                <span>{plan.benefits.length} Benefits</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deletePlan(plan.id); }}
                                    className={styles.deleteIconBtn}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* ── Right Column: Edit Plan Details ── */}
            <div className={styles.editSection}>
                {editingPlanId ? (
                    <>
                        {/* Basic Info */}
                        <div className={styles.settingsCard}>
                            <div className={styles.settingsCardHeader}>
                                <Edit3 size={18} />
                                <h3>Edit Plan: {siteConfig.plans.find(p => p.id === editingPlanId)?.name}</h3>
                            </div>

                            <div className={styles.fieldRow}>
                                <div className={styles.fieldGroup}>
                                    <label>Plan Name</label>
                                    <input
                                        type="text"
                                        value={siteConfig.plans.find(p => p.id === editingPlanId)?.name || ''}
                                        onChange={e => updatePlanField(editingPlanId, 'name', e.target.value)}
                                        onKeyDown={onSearchEnter}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label>Status</label>
                                    <div className={styles.toggleRow}>
                                        <span>Is Plan Live?</span>
                                        <input
                                            type="checkbox"
                                            checked={siteConfig.plans.find(p => p.id === editingPlanId)?.isLive || false}
                                            onChange={e => updatePlanField(editingPlanId, 'isLive', e.target.checked)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.fieldRow}>
                                <div className={styles.fieldGroup}>
                                    <label>Price (₹)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="0"
                                        value={siteConfig.plans.find(p => p.id === editingPlanId)?.price ?? ''}
                                        onChange={e => updatePlanField(editingPlanId, 'price', e.target.value === '' ? 0 : Number(e.target.value))}
                                        onKeyDown={onSearchEnter}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label>Price Label</label>
                                    <input
                                        type="text"
                                        value={siteConfig.plans.find(p => p.id === editingPlanId)?.priceLabel || ''}
                                        onChange={e => updatePlanField(editingPlanId, 'priceLabel', e.target.value)}
                                        onKeyDown={onSearchEnter}
                                    />
                                </div>
                            </div>

                            <div className={styles.fieldGroup}>
                                <label>Tagline</label>
                                <input
                                    type="text"
                                    value={siteConfig.plans.find(p => p.id === editingPlanId)?.tagline || ''}
                                    onChange={e => updatePlanField(editingPlanId, 'tagline', e.target.value)}
                                    onKeyDown={onSearchEnter}
                                />
                            </div>

                            <div className={styles.fieldRow}>
                                <div className={styles.fieldGroup}>
                                    <label>Razorpay Plan ID</label>
                                    <input
                                        type="text"
                                        value={siteConfig.plans.find(p => p.id === editingPlanId)?.razorpayPlanId || ''}
                                        onChange={e => updatePlanField(editingPlanId, 'razorpayPlanId', e.target.value)}
                                        placeholder="plan_XXX..."
                                        onKeyDown={onSearchEnter}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label>Razorpay Subscription ID</label>
                                    <input
                                        type="text"
                                        value={siteConfig.plans.find(p => p.id === editingPlanId)?.razorpaySubscriptionId || ''}
                                        onChange={e => updatePlanField(editingPlanId, 'razorpaySubscriptionId', e.target.value)}
                                        placeholder="sub_XXX..."
                                        onKeyDown={onSearchEnter}
                                    />
                                </div>
                            </div>

                            <div className={styles.fieldRow}>
                                <div className={styles.fieldGroup}>
                                    <label>Razorpay Payment Link</label>
                                    <input
                                        type="text"
                                        value={siteConfig.plans.find(p => p.id === editingPlanId)?.razorpayPaymentLink || ''}
                                        onChange={e => updatePlanField(editingPlanId, 'razorpayPaymentLink', e.target.value)}
                                        placeholder="https://razorpay.me/@..."
                                        onKeyDown={onSearchEnter}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label>Joining Bonus Points</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="0"
                                        value={siteConfig.plans.find(p => p.id === editingPlanId)?.pointsReward ?? ''}
                                        onChange={e => updatePlanField(editingPlanId, 'pointsReward', e.target.value === '' ? 0 : Number(e.target.value))}
                                        onKeyDown={onSearchEnter}
                                    />
                                </div>
                            </div>

                            <div className={styles.fieldRow}>
                                <div className={styles.fieldGroup}>
                                    <label>Coin Value (Value of 1 Coin in ₹)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={siteConfig.loyalty.pointsValueInRupees}
                                        onChange={e => updateLoyaltyField('pointsValueInRupees', e.target.value === '' ? 0 : Number(e.target.value))}
                                        onKeyDown={onSearchEnter}
                                    />
                                    <span className={styles.fieldHint}>Value: ₹{siteConfig.loyalty.pointsValueInRupees} / coin</span>
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label>Min Coins to Redeem</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="0"
                                        value={siteConfig.loyalty.minRedeemPoints ?? ''}
                                        onChange={e => updateLoyaltyField('minRedeemPoints', e.target.value === '' ? 0 : Number(e.target.value))}
                                        onKeyDown={onSearchEnter}
                                    />
                                    <span className={styles.fieldHint}>Min coins for single redemption</span>
                                </div>
                            </div>
                        </div>

                        {/* Points System Configuration */}
                        <div className={styles.settingsCard} style={{ marginTop: '1.5rem' }}>
                            <div className={styles.settingsCardHeader}>
                                <Coins size={18} />
                                <h3>Points System Configuration</h3>
                            </div>
                            <div className={styles.fieldRow}>
                                <div className={styles.fieldGroup}>
                                    <label>Purchase Amount (₹)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={siteConfig.loyalty.baseSpendingAmount || 100}
                                        onChange={e => {
                                            const val = Number(e.target.value) || 1;
                                            setSiteConfig(prev => ({
                                                ...prev,
                                                loyalty: {
                                                    ...prev.loyalty,
                                                    baseSpendingAmount: val,
                                                    pointsPerRupee: (prev.loyalty.pointsPerBase || 0) / val
                                                }
                                            }));
                                        }}
                                        onKeyDown={onSearchEnter}
                                    />
                                    <p className={styles.fieldHint}>
                                        E.g. Set to 100 for "Every ₹100 spent"
                                    </p>
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label>Points Rewarded</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={siteConfig.loyalty.pointsPerBase || 0}
                                        onChange={e => {
                                            const val = Number(e.target.value) || 0;
                                            setSiteConfig(prev => ({
                                                ...prev,
                                                loyalty: {
                                                    ...prev.loyalty,
                                                    pointsPerBase: val,
                                                    pointsPerRupee: val / (prev.loyalty.baseSpendingAmount || 100)
                                                }
                                            }));
                                        }}
                                        onKeyDown={onSearchEnter}
                                    />
                                    <p className={styles.fieldHint}>
                                        E.g. Set to 5 for "Get 5 points"
                                    </p>
                                </div>
                            </div>
                            <div className={styles.fieldRow} style={{ marginTop: '0.5rem' }}>
                                <div className={styles.fieldGroup} style={{ gridColumn: 'span 2' }}>
                                    <label>Current Ratio Summary</label>
                                    <div className={styles.ratioDisplay}>
                                        ₹{siteConfig.loyalty.baseSpendingAmount || 100} Purchase = <strong>{siteConfig.loyalty.pointsPerBase || 0} Coins</strong>
                                    </div>
                                    <p className={styles.fieldHint}>
                                        (Effective Ratio: {siteConfig.loyalty.pointsPerRupee?.toFixed(4)} points per ₹1 spent)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Wholesale & Discount Tiers */}
                        <div className={styles.settingsCard} style={{ marginTop: '1.5rem' }}>
                            <div className={styles.settingsCardHeader}>
                                <IndianRupee size={18} />
                                <h3>Wholesale & Discount Rules</h3>
                            </div>

                            <div className={styles.fieldRow}>
                                <div className={styles.fieldGroup}>
                                    <label>Wholesale Order (KG)</label>
                                    <input
                                        type="number"
                                        value={siteConfig.wholesaleThresholdKg}
                                        onChange={e => setSiteConfig(prev => ({ ...prev, wholesaleThresholdKg: Number(e.target.value) }))}
                                        onKeyDown={onSearchEnter}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label>Wholesale Price (₹/KG)</label>
                                    <input
                                        type="number"
                                        value={siteConfig.wholesalePricePerKg}
                                        onChange={e => setSiteConfig(prev => ({ ...prev, wholesalePricePerKg: Number(e.target.value) }))}
                                        onKeyDown={onSearchEnter}
                                    />
                                </div>
                            </div>

                            <div className={styles.fieldRow}>
                                <div className={styles.fieldGroup}>
                                    <label>Per Package Cost (₹)</label>
                                    <input
                                        type="number"
                                        value={siteConfig.packagingCostPerPack}
                                        onChange={e => setSiteConfig(prev => ({ ...prev, packagingCostPerPack: Number(e.target.value) }))}
                                        onKeyDown={onSearchEnter}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label>Pkg Base Weight (Grams)</label>
                                    <input
                                        type="number"
                                        value={siteConfig.packagingBaseGrams}
                                        onChange={e => setSiteConfig(prev => ({ ...prev, packagingBaseGrams: Number(e.target.value) }))}
                                        onKeyDown={onSearchEnter}
                                    />
                                </div>
                            </div>

                            <div className={styles.discountTiersSection}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <label className={styles.sectionLabel}>Tiered Discounts (Member-only)</label>
                                    <button onClick={addTier} className={styles.btnSmallAction}>
                                        <PlusCircle size={14} /> Add Tier
                                    </button>
                                </div>
                                <div className={styles.tiersContainer}>
                                    {siteConfig.discountTiers.map((tier, idx) => (
                                        <div key={idx} className={styles.tierEntry}>
                                            <span>Purchase &gt; ₹</span>
                                            <input
                                                type="number"
                                                value={tier.threshold}
                                                onChange={e => updateTier(idx, 'threshold', Number(e.target.value))}
                                            />
                                            <span>=</span>
                                            <input
                                                type="number"
                                                value={tier.percentage}
                                                onChange={e => updateTier(idx, 'percentage', Number(e.target.value))}
                                            />
                                            <span>% Off</span>
                                            <button
                                                onClick={() => removeTier(idx)}
                                                className={styles.tierDeleteBtn}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Benefits */}
                        <div className={styles.settingsCard} style={{ marginTop: '1.5rem' }}>
                            <div className={styles.settingsCardHeader}>
                                <Star size={18} />
                                <h3>Benefits List</h3>
                            </div>

                            <div className={styles.benefitsList}>
                                {siteConfig.plans.find(p => p.id === editingPlanId)?.benefits.map((b, idx) => (
                                    <div key={idx} className={styles.benefitItem}>
                                        {editingBenefitIdx === idx ? (
                                            <div className={styles.benefitEditRow}>
                                                <input
                                                    autoFocus
                                                    value={editingBenefitText}
                                                    onChange={e => setEditingBenefitText(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') saveEditBenefit(editingPlanId); if (e.key === 'Escape') setEditingBenefitIdx(null); }}
                                                    className={styles.benefitEditInput}
                                                />
                                                <button onClick={() => saveEditBenefit(editingPlanId)} className={styles.btnSmallGreen}>Save</button>
                                                <button onClick={() => setEditingBenefitIdx(null)} className={styles.btnSmallGray}>×</button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className={styles.benefitDot} />
                                                <span className={styles.benefitText}>{b}</span>
                                                <div className={styles.benefitActions}>
                                                    <button onClick={() => { setEditingBenefitIdx(idx); setEditingBenefitText(b); }} className={styles.iconBtn} title="Edit">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button onClick={() => removeBenefit(editingPlanId, idx)} className={`${styles.iconBtn} ${styles.iconBtnRed}`} title="Remove">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className={styles.addBenefitRow}>
                                <PlusCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                <input
                                    type="text"
                                    placeholder="Add a new benefit…"
                                    value={newBenefit}
                                    onChange={e => setNewBenefit(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addBenefit(editingPlanId); }}
                                    className={styles.addBenefitInput}
                                />
                                <button onClick={() => addBenefit(editingPlanId)} className={styles.btnAdd} disabled={!newBenefit.trim()}>
                                    Add
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className={styles.emptyEditState}>
                        <CreditCard size={48} opacity={0.2} />
                        <p>Select a plan from the list to edit its details</p>
                    </div>
                )}
            </div>

            {/* ── Save Action ── */}
            <div className={styles.finalActions}>
                <button
                    className={styles.saveBtn}
                    onClick={handleSave}
                    disabled={saving || siteConfig.plans.length === 0}
                >
                    {saving ? (
                        <><Loader2 size={18} className={styles.spin} /> Saving Changes...</>
                    ) : (
                        <><Save size={18} /> Save All Changes</>
                    )}
                </button>
                <p className={styles.saveTip}>
                    <CheckCircle2 size={14} />
                    Changes are applied instantly to the live website
                </p>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────
// Helper: Stat Card
// ─────────────────────────────────────────────────
function StatCard({
    icon, label, value, iconClass, valueClass, prefix,
}: { icon: React.ReactNode; label: string; value: number; iconClass?: string; valueClass?: string; prefix?: string }) {
    return (
        <div className={styles.statCard}>
            <div className={styles.statInfo}>
                <p>{label}</p>
                <h3 className={valueClass}>
                    {prefix && <span>{prefix}</span>}
                    {value.toLocaleString()}
                </h3>
            </div>
            <div className={`${styles.statIcon} ${iconClass || ''}`}>{icon}</div>
        </div>
    );
}

// ─────────────────────────────────────────────────
// Tab 3 – Page Edit
// ─────────────────────────────────────────────────
function PageEditTab() {
    const [content, setContent] = useState(DEFAULT_PAGE_CONTENT);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const snap = await getDoc(doc(adminDb, 'settings', 'membership_page'));
                if (snap.exists()) {
                    setContent({ ...DEFAULT_PAGE_CONTENT, ...snap.data() });
                }
            } catch (e) {
                console.error("Error fetching page content:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        const tId = toast.loading('Saving page content...');
        try {
            await setDoc(doc(adminDb, 'settings', 'membership_page'), content);
            toast.success('Membership page updated successfully!', { id: tId });
        } catch (e: any) {
            toast.error('Failed to save: ' + e.message, { id: tId });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className={styles.skeleton} style={{ height: '400px', margin: '2rem' }} />;

    return (
        <div className={styles.pageEditContainer}>
            <div className={styles.sectionHeader}>
                <div className={styles.headerLeft}>
                    <Sparkles size={20} className="text-[var(--primary)]" />
                    <h3>Membership Landing Page Content</h3>
                </div>
            </div>

            {/* Hero Section */}
            <div className={styles.settingsCard} style={{ marginTop: '1.5rem' }}>
                <div className={styles.settingsCardHeader}>
                    <Star size={18} />
                    <h3>Hero Section</h3>
                </div>
                <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                        <label>Small Label (e.g. The Munch Tokri Club)</label>
                        <input
                            type="text"
                            value={content.hero.label}
                            onChange={(e) => setContent({ ...content, hero: { ...content.hero, label: e.target.value } })}
                        />
                    </div>
                </div>
                <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                        <label>Main Title</label>
                        <input
                            type="text"
                            value={content.hero.title}
                            onChange={(e) => setContent({ ...content, hero: { ...content.hero, title: e.target.value } })}
                        />
                    </div>
                </div>
                <div className={styles.fieldRow} style={{ gridTemplateColumns: '1fr' }}>
                    <div className={styles.fieldGroup}>
                        <label>Description (Supports New Lines)</label>
                        <textarea
                            rows={3}
                            value={content.hero.desc}
                            className={styles.textarea}
                            onChange={(e) => setContent({ ...content, hero: { ...content.hero, desc: e.target.value } })}
                        />
                    </div>
                </div>
            </div>

            {/* Benefits List */}
            <div className={styles.settingsCard} style={{ marginTop: '2rem' }}>
                <div className={styles.settingsCardHeader}>
                    <Sparkles size={18} />
                    <h3>Member Benefits Grid</h3>
                </div>
                <div className={styles.listEditor}>
                    {content.benefits.map((benefit, i) => (
                        <div key={i} className={styles.listItem}>
                            <div style={{ flex: 1 }}>
                                <input
                                    type="text"
                                    placeholder="Benefit Title"
                                    value={benefit.title}
                                    style={{ fontWeight: 700, marginBottom: '0.5rem' }}
                                    onChange={(e) => {
                                        const newList = [...content.benefits];
                                        newList[i].title = e.target.value;
                                        setContent({ ...content, benefits: newList });
                                    }}
                                />
                                <textarea
                                    placeholder="Benefit Description"
                                    value={benefit.desc}
                                    rows={2}
                                    style={{ fontSize: '0.85rem' }}
                                    onChange={(e) => {
                                        const newList = [...content.benefits];
                                        newList[i].desc = e.target.value;
                                        setContent({ ...content, benefits: newList });
                                    }}
                                />
                            </div>
                            <button
                                className={styles.deleteBtn}
                                onClick={() => {
                                    const newList = content.benefits.filter((_, idx) => idx !== i);
                                    setContent({ ...content, benefits: newList });
                                }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    <button
                        className={styles.btnAddPlan}
                        style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}
                        onClick={() => setContent({
                            ...content,
                            benefits: [...content.benefits, { title: 'New Benefit', desc: 'Description here' }]
                        })}
                    >
                        <PlusCircle size={18} />
                        <span>Add New Benefit Card</span>
                    </button>
                </div>
            </div>

            {/* Comparison Table */}
            <div className={styles.settingsCard} style={{ marginTop: '2rem' }}>
                <div className={styles.settingsCardHeader}>
                    <Filter size={18} />
                    <h3>Membership vs Guest Comparison</h3>
                </div>
                <div className={styles.listEditor}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: '1rem', padding: '0 1rem', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, opacity: 0.6 }}>
                        <span>FEATURE</span>
                        <span>GUEST</span>
                        <span>MEMBER</span>
                        <span></span>
                    </div>
                    {(content.comparison || DEFAULT_PAGE_CONTENT.comparison).map((row, i) => (
                        <div key={i} className={styles.listItem} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="Feature"
                                value={row.feature}
                                onChange={(e) => {
                                    const newList = [...(content.comparison || DEFAULT_PAGE_CONTENT.comparison)];
                                    newList[i].feature = e.target.value;
                                    setContent({ ...content, comparison: newList });
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Guest"
                                value={row.guest}
                                onChange={(e) => {
                                    const newList = [...(content.comparison || DEFAULT_PAGE_CONTENT.comparison)];
                                    newList[i].guest = e.target.value;
                                    setContent({ ...content, comparison: newList });
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Member"
                                value={row.member}
                                onChange={(e) => {
                                    const newList = [...(content.comparison || DEFAULT_PAGE_CONTENT.comparison)];
                                    newList[i].member = e.target.value;
                                    setContent({ ...content, comparison: newList });
                                }}
                            />
                            <button
                                className={styles.deleteBtn}
                                onClick={() => {
                                    const newList = (content.comparison || DEFAULT_PAGE_CONTENT.comparison).filter((_, idx) => idx !== i);
                                    setContent({ ...content, comparison: newList });
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    <button
                        className={styles.btnAddPlan}
                        style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}
                        onClick={() => setContent({
                            ...content,
                            comparison: [...(content.comparison || DEFAULT_PAGE_CONTENT.comparison), { feature: 'New Feature', guest: 'No', member: 'Yes' }]
                        })}
                    >
                        <PlusCircle size={18} />
                        <span>Add Feature Comparison Row</span>
                    </button>
                </div>
            </div>

            {/* FAQs */}
            <div className={styles.settingsCard} style={{ marginTop: '2rem' }}>
                <div className={styles.settingsCardHeader}>
                    <HelpCircle size={18} />
                    <h3>Frequently Asked Questions</h3>
                </div>
                <div className={styles.listEditor}>
                    {content.faqs.map((faq, i) => (
                        <div key={i} className={styles.listItem}>
                            <div style={{ flex: 1 }}>
                                <input
                                    type="text"
                                    placeholder="Question"
                                    value={faq.q}
                                    style={{ fontWeight: 700, marginBottom: '0.5rem' }}
                                    onChange={(e) => {
                                        const newList = [...content.faqs];
                                        newList[i].q = e.target.value;
                                        setContent({ ...content, faqs: newList });
                                    }}
                                />
                                <textarea
                                    placeholder="Answer"
                                    value={faq.a}
                                    rows={2}
                                    style={{ fontSize: '0.85rem' }}
                                    onChange={(e) => {
                                        const newList = [...content.faqs];
                                        newList[i].a = e.target.value;
                                        setContent({ ...content, faqs: newList });
                                    }}
                                />
                            </div>
                            <button
                                className={styles.deleteBtn}
                                onClick={() => {
                                    const newList = content.faqs.filter((_, idx) => idx !== i);
                                    setContent({ ...content, faqs: newList });
                                }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    <button
                        className={styles.btnAddPlan}
                        style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}
                        onClick={() => setContent({
                            ...content,
                            faqs: [...content.faqs, { q: 'New Question?', a: 'Answer here' }]
                        })}
                    >
                        <PlusCircle size={18} />
                        <span>Add New FAQ Item</span>
                    </button>
                </div>
            </div>

            <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center', marginBottom: '4rem' }}>
                <button
                    className={styles.saveBtn}
                    style={{ padding: '1.25rem 4rem', fontSize: '1.125rem', width: 'auto', minWidth: '400px', display: 'flex', justifyContent: 'center' }}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                    <span>{saving ? 'Applying Changes...' : 'Publish All Changes to Website'}</span>
                </button>
            </div>
        </div>
    );
}
