# 🛍️ Munch Tokri (Hurigalu Angadi)

An enterprise-grade e-commerce web application for heritage roasted snacks and handcrafted mixtures from Karnataka, powered by **Next.js 16 (App Router)**, **Firebase Firestore**, **Firebase Cloud Functions v2**, and **Razorpay Magic Checkout**.

---

## 📂 Master Folder Organization (Directory Map)

This repository is strictly organized following 10+ year senior principal engineering standards, separating **Frontend**, **Backend**, **Public Assets**, **Documentation**, and **Environment Secrets**:

```text
hurigalu_angadi_website/
├── 🌐 src/                          <-- [FRONTEND] Next.js 16 Application Code
│   ├── app/                         <-- App Router Pages, Layouts & Routing
│   │   ├── (public)/                <-- Customer Storefront (Shop, Combos, Product, Checkout, etc.)
│   │   ├── admin/                   <-- Merchant Admin Portal (Orders, Inventory, Customers, etc.)
│   │   ├── layout.tsx               <-- Root Layout (SEO, Meta Pixel, Fonts)
│   │   └── globals.css              <-- CSS variables, reset, design tokens
│   ├── components/                  <-- Reusable UI, Layout, & Feature Components
│   │   ├── ui/                      <-- Atomic UI (Buttons, Cards, Modals, 1-Click Widget)
│   │   ├── layout/                  <-- Structure (Navbar, Footer, AnnouncementBar)
│   │   └── providers/               <-- Context Provider wrappers
│   ├── contexts/                    <-- Client State Management (Cart, Auth, Notifications)
│   ├── hooks/                       <-- Custom React Data Fetching Hooks (useFirestore)
│   ├── lib/                         <-- Constants, Analytics Tracker, Firebase Client
│   ├── types/                       <-- TypeScript Interface Definitions & Models
│   └── README.md                    <-- Detailed Frontend Folder Guide
│
├── ⚡ functions/                    <-- [BACKEND] Firebase Cloud Functions v2 (Serverless Microservices)
│   ├── src/                         <-- Backend TypeScript Source Code
│   │   └── index.ts                 <-- Central API & Cloud Function registry (17 services)
│   ├── .env                         <-- Private Server Secrets (DO NOT COMMIT)
│   ├── .env.example                 <-- Template for Backend Environment Variables
│   ├── package.json                 <-- Backend Node.js dependencies
│   ├── tsconfig.json                <-- Backend TypeScript compilation settings
│   └── README.md                    <-- Detailed Backend Folder Guide
│
├── 🖼️ public/                       <-- [STATIC ASSETS] Public Web Server Assets
│   ├── images/                      <-- Static product & banner images
│   ├── logo.png / logo.svg          <-- Brand logos & icons
│   ├── razorpay.svg                 <-- Gateway badges
│   ├── herovideo.mp4 / .webm        <-- Hero background video clips
│   └── README.md                    <-- Detailed Public Assets Guide
│
├── 📚 docs/                         <-- [DOCUMENTATION] Guides, Specs, & Architecture
│   ├── specifications/              <-- API Specifications & Logistics Documentation
│   └── README.md                    <-- Documentation Directory Guide
│
├── 🎨 design/                       <-- [DESIGN] HTML/CSS Reference Mockups
│   └── README.md                    <-- Design Assets Guide
│
├── 🔐 Environment Files:
│   ├── .env.example                 <-- FRONTEND Environment Template (NEXT_PUBLIC_*)
│   ├── .env.local                   <-- FRONTEND Active Local Config (git-ignored)
│   ├── functions/.env.example       <-- BACKEND Environment Template (Server Secrets)
│   └── functions/.env               <-- BACKEND Active Server Config (git-ignored)
│
└── ⚙️ Configuration & DevOps:
    ├── firebase.json                <-- Hosting rules, URL rewrites, and headers
    ├── firestore.rules              <-- Database Security Rules
    ├── firestore.indexes.json       <-- Firestore Query Indexes
    ├── storage.rules                <-- Cloud Storage Security Rules
    ├── next.config.mjs              <-- Next.js build config (output: 'export')
    ├── package.json                 <-- Root dependencies & unified build scripts
    ├── tsconfig.json                <-- Frontend TypeScript config
    └── ARCHITECTURE.md              <-- Full System Architecture & Data Flow Guide
```

---

## 🎯 What Belongs Where (Folder Rules)

| Folder | What MUST be here | What must NEVER be here |
| :--- | :--- | :--- |
| **`src/`** *(Frontend)* | React components, CSS modules, Next.js routes, client contexts, client hooks, browser analytics, public interfaces. | **NO server secrets**, NO database admin credentials, NO payment secret keys, NO Node.js mailers. |
| **`functions/`** *(Backend)* | Cloud Functions triggers, Razorpay server APIs, Shiprocket integration, Velocity API, Nodemailer SMTP, PDF generation. | **NO frontend React JSX/TSX**, NO DOM manipulation, NO client-side UI stylesheets. |
| **`public/`** *(Assets)* | Static browser-accessible media (PNG, SVG, WEBP, MP4, favicon). | **NO source code (.ts, .tsx, .js)**, NO customer data, NO private invoice PDFs. |
| **`docs/`** *(Documentation)* | Architecture specs, API schemas, PDF manuals, migration notes. | **NO active application code** or executable scripts. |
| **`.env*` (Root)** | Frontend `NEXT_PUBLIC_*` variables only. | **NO server secrets** like `RAZORPAY_KEY_SECRET` or `EMAIL_PASS`. |
| **`functions/.env`** | Server-only secrets (`RAZORPAY_KEY_SECRET`, `SHIPROCKET_PASSWORD`, `SMTP_PASS`). | **NEVER commit this file to Git.** |

---

## 🚀 Commands & Development Scripts

```bash
# 1. Local Development
npm run dev                  # Start local Next.js dev server at http://localhost:3000

# 2. Testing Production Build
npm run build                # Clean 'out/' and compile optimized static export

# 3. Deployment
npm run deploy:hosting       # Deploy frontend to munchtokri.com (Firebase Hosting)
npm run deploy:functions     # Deploy backend Cloud Functions to Google Cloud (asia-south1)
npm run deploy               # Deploy both Hosting and Functions with 4GB memory buffer
```

For complete technical diagrams and architectural contracts, refer to [ARCHITECTURE.md](./ARCHITECTURE.md).
