# 🌐 Frontend Application (`src/`)

This directory contains the entire **Client-Side Storefront and Merchant Admin User Interface** built on **Next.js 16 (App Router)** and **React 18**.

---

## 📂 Subfolder Structure & Breakdown

```text
src/
├── app/                  <-- Next.js 16 App Router (Routing, Layouts, Server-Side Metadata)
│   ├── (public)/         <-- Customer-Facing Storefront Pages
│   │   ├── page.tsx      <-- Homepage with Hero, Featured Products, Combos, & Testimonials
│   │   ├── shop/         <-- Product Catalog & Category Filters
│   │   ├── product/[id]/ <-- Dynamic Product Page with 1-Click Razorpay Buy Now widget
│   │   ├── combos/       <-- Pre-packaged Value Snack Bundles
│   │   ├── combos/[id]/  <-- Dynamic Combo Page with pack selection and savings breakdown
│   │   ├── build-mixture/<-- Interactive Custom Snack Mixture Builder
│   │   ├── checkout/     <-- Standard 4-step & Direct Magic Checkout flow
│   │   ├── membership/   <-- Tokri Club VIP Membership program landing & tiers
│   │   ├── dashboard/    <-- Customer Account Portal (Order History, Addresses)
│   │   ├── login/        <-- Phone / Google / Email Customer Authentication
│   │   └── (legal)/      <-- Legal pages (privacy, refund, shipping, terms, contact, about)
│   ├── admin/            <-- Protected Merchant Admin Dashboard
│   │   ├── (authenticated)/ <-- Orders, Inventory, Combos, Coupons, Customers, Settings
│   │   └── login/        <-- Admin authentication page
│   ├── layout.tsx        <-- Global Layout with Meta Pixel (1739636207115257) & Fonts
│   ├── globals.css       <-- CSS Variables, design tokens, and base styling
│   ├── sitemap.ts        <-- Dynamic search engine sitemap generator
│   └── robots.ts         <-- Search engine crawler rules
│
├── components/           <-- Reusable UI & Feature Components
│   ├── ui/               <-- Atomic design elements (Buttons, Cards, Modals, Trust Badges)
│   │   ├── Button/       <-- Global accessible button component
│   │   ├── Card/         <-- ProductCard with live inventory indicators
│   │   ├── Cart/         <-- CartDrawer (slide-out cart with 1-click buy button)
│   │   ├── FloatingCart/ <-- Hydration-safe floating cart bubble
│   │   ├── RazorpayMagicCheckoutWidget/ <-- 1-Click Buyer Protection & Buy Now button
│   │   ├── Review/       <-- Customer product reviews form & listing
│   │   └── StarRating/   <-- Dynamic star rating display
│   ├── layout/           <-- Structural Layout Components
│   │   ├── Navbar/       <-- Sticky navigation bar with live cart counter
│   │   ├── Footer/       <-- Global footer with links, payment trust marks, & info
│   │   ├── AnnouncementBar/ <-- Top promotion ticker bar
│   │   └── AdminLayout/  <-- Admin sidebar, topbar, and secure navigation
│   └── providers/        <-- React Context Provider wrappers (Providers.tsx)
│
├── contexts/             <-- Global Client State Management (React Contexts)
│   ├── CartContext.tsx   <-- Shopping cart state with localStorage persistence ('munchtokri_cart')
│   ├── FirebaseContext.tsx <-- Firebase Auth session & user identity
│   ├── NotificationContext.tsx <-- In-app toasts and alert banners
│   └── AdminContext.tsx  <-- Admin authentication and RBAC session
│
├── hooks/                <-- Custom React Hooks
│   └── useFirestore.ts   <-- Real-time Firestore hooks (useOrders, useCustomer, useMembership)
│
├── lib/                  <-- Frontend Utilities & Configuration
│   ├── constants.ts      <-- Business constants (Free Shipping ₹350, Rate ₹50, Tax 5%)
│   ├── firebase.ts       <-- Client-side Firebase App & Auth initialization
│   ├── email-utils.ts    <-- Client email formatting and validation
│   ├── image-utils.ts    <-- Image fallback URL helpers
│   └── analytics/        <-- Client-side event tracking (tracker.ts)
│
└── types/                <-- TypeScript Interfaces & Schemas
    ├── index.ts          <-- Product, Order, Combo, Coupon, User, Address models
    └── analytics.ts      <-- Analytics event payloads
```

---

## ⚠️ Important Rules for `src/`

✅ **What MUST be inside `src/`**:
- All UI markup (JSX/TSX) and CSS modules.
- Client-side data fetching and user state.
- Public variables starting with `NEXT_PUBLIC_` accessed via `process.env`.

❌ **What must NEVER be inside `src/`**:
- **Never put server secrets here** (e.g. `RAZORPAY_KEY_SECRET`, `SHIPROCKET_PASSWORD`).
- **Never import Node.js server modules** (`fs`, `child_process`, `nodemailer`).
- **Never use Firebase Admin SDK** directly in client components (use Firebase Client SDK in `src/lib/firebase.ts`).
