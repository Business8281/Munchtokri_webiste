# ⚡ Backend Microservices (`functions/`)

This directory contains the entire **Serverless Backend API & Cloud Function Services** built on **Firebase Functions v2 (Node.js 24)** running in the `asia-south1` (Mumbai) region.

---

## 📂 Backend Structure & Registry

```text
functions/
├── src/
│   └── index.ts                 <-- Central Cloud Functions & API Registry (17 Microservices)
├── .env                         <-- Private Server Secrets (DO NOT COMMIT TO GIT)
├── .env.example                 <-- Template for Backend Secrets
├── package.json                 <-- Backend Dependencies (razorpay, nodemailer, jspdf, axios)
└── tsconfig.json                <-- TypeScript Compiler Configuration
```

---

## 🛠️ The 17 Backend Microservices by Domain

### 1. Payment & Checkout Services
* **`createPayOrder`** (`onCall` HTTPS): Creates a Razorpay order in paise, enforcing minimum limits and secure currency validation.
* **`verifyPayment`** (`onCall` HTTPS): Performs server-side HMAC-SHA256 signature verification to guarantee authentic payments before writing to Firestore.
* **`razorpayWebhook`** (`onRequest` HTTPS): Receives automated webhooks from Razorpay for `order.paid` and `payment.captured` events.

### 2. Razorpay Magic Checkout (1-Click Engine)
* **`magicCheckoutPromotions`** (`onRequest` HTTPS): Route: `/api/magic-checkout/promotions`  
  Fetches active store coupons from Firestore and displays them in the Magic Checkout modal.
* **`magicCheckoutApplyPromotion`** (`onRequest` HTTPS): Route: `/api/magic-checkout/apply-promotion`  
  Validates a coupon code entered by the user and computes exact percentage/flat discount values.
* **`magicCheckoutShippingInfo`** (`onRequest` HTTPS): Route: `/api/magic-checkout/shipping-info`  
  Evaluates the customer's PIN code for serviceability and calculates the ₹50 flat rate or ₹0 Free Delivery (for orders $\ge$ ₹350).

### 3. Shipping & Courier Integrations
* **`createShiprocketOrder`** (`onCall` HTTPS): Creates a domestic order and assigns an AWB in Shiprocket.
* **`createVelocityOrder`** (`onCall` HTTPS): Creates an order with custom labels in Velocity shipping.
* **`shiprocketWebhook`** (`onRequest` HTTPS): Webhook listener for courier status changes (Out for Delivery, Delivered, RTO).

### 4. Automated Invoicing & Email Notifications
* **`onOrderCreated`** (Firestore Trigger: `orders/{orderId}`):  
  Automatically generates a professional PDF tax invoice using `jsPDF` and emails it to the customer via SMTP (`Nodemailer`).
* **`onOrderStatusUpdated`** (Firestore Trigger: `orders/{orderId}`):  
  Sends automated email updates whenever the merchant changes an order status.

### 5. Discounts & Coupons
* **`validateCoupon`** (`onCall` HTTPS):  
  Validates coupon validity, expiry dates, minimum order thresholds, and usage counts.

### 6. Tokri Club VIP Memberships & Subscriptions
* **`membershipStatus`** (`onRequest` HTTPS): Route: `/api/membership-status`  
  Returns active membership tier status and discount rates.
* **`createSubscription`** (`onRequest` HTTPS): Route: `/api/create-subscription`  
  Initiates a recurring subscription mandate through Razorpay.
* **`cancelSubscription`** (`onRequest` HTTPS): Route: `/api/cancel-subscription`  
  Cancels recurring subscription plans.
* **`checkMembershipExpiry`** (`onSchedule` Cron):  
  Cloud Scheduler job running daily at midnight to deactivate expired memberships.
* **`syncMembershipToCustomer`** (Firestore Trigger: `memberships/{userId}`):  
  Syncs customer loyalty tier and points directly into their profile.

---

## ⚠️ Important Rules for `functions/`

✅ **What MUST be inside `functions/`**:
- All server-side business logic, database triggers, and private API integrations.
- Server-side environment variables loaded via `.env` (`defineSecret` or `defineString`).
- Administrative writes to Firestore using `firebase-admin`.

❌ **What must NEVER be inside `functions/`**:
- **Never put client-side UI code here** (no React components, no CSS, no DOM APIs).
- **Never expose `functions/.env` to GitHub** (contains SMTP passwords, Razorpay secret keys, and logistics credentials).
