/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString, defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import axios from "axios";
import Razorpay from "razorpay";
import * as crypto from "crypto";

admin.initializeApp();

// Start writing functions
// Force redeploy timestamp: 2026-03-11T18:15:00
// https://firebase.google.com/docs/functions/typescript
const LOGO_URL = "https://munchtokri.com/logo.png";

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10, region: "asia-south1", invoker: "public" });

// Configuration parameters
const emailUser = defineString("EMAIL_USER");
const emailPass = defineString("EMAIL_PASS");
const smtpHost = defineString("SMTP_HOST", {
  default: "smtpout.secureserver.net",
});
const smtpPort = defineString("SMTP_PORT", { default: "465" });

// Shiprocket parameters
const shiprocketEmail = defineString("SHIPROCKET_EMAIL");
const shiprocketPass = defineString("SHIPROCKET_PASSWORD");
const shiprocketPickup = defineString("SHIPROCKET_PICKUP_LOCATION", {
  default: "Primary",
});

// Razorpay parameters
const razorpayKeyId = defineString("RAZORPAY_KEY_ID");
const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");

// Webhook security secret (set this in Firebase functions config)
const shiprocketWebhookSecret = defineString("SHIPROCKET_WEBHOOK_SECRET", {
  default: "",
});
const razorpayWebhookSecret = defineSecret("RAZORPAY_WEBHOOK_SECRET");


/**
 * Sends an email with retry logic and connection pooling.
 */
async function sendEmailWithRetry(mailOptions: nodemailer.SendMailOptions, retries = 3): Promise<any> {
  const transporter = nodemailer.createTransport({
    host: smtpHost.value(),
    port: parseInt(smtpPort.value(), 10),
    secure: parseInt(smtpPort.value(), 10) === 465,
    pool: true,
    maxConnections: 1,
    auth: {
      user: emailUser.value(),
      pass: emailPass.value(),
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  for (let i = 0; i < retries; i++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      transporter.close();
      return info;
    } catch (error: any) {
      if (i === retries - 1) {
        transporter.close();
        throw error;
      }
      console.warn(`Email attempt ${i + 1} failed: ${error.message}. Retrying in 3 seconds...`);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
}

interface OrderItem {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  baseWeight?: number;
  imageURL?: string;
  category?: string;
  products?: { name: string, grams: number }[];
}

interface OrderData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amount: string;
  date: admin.firestore.Timestamp | null;
  status: string;
  shippingDetails: {
    address: string;
    city: string;
    state: string;
    pincode: string;
    mobile: string;
  };
  method: {
    payment: string;
    delivery?: string;
  };
  items: OrderItem[];
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;
  earnedPoints?: number;
  discount?: number;
  membershipDiscount?: number;
  codPrice?: number;
  trackingId?: string;
  courierName?: string;
}

/**
 * Triggered when a new order is created in Firestore.
 * Generates a PDF receipt and sends it via email.
 */
export const onOrderCreated = onDocumentCreated(
  {
    document: "orders/{orderId}",
    region: "asia-south1",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }

    const order = snapshot.data() as OrderData;
    if (!order.customerEmail) {
      console.log("No customer email found for order:", event.params.orderId);
      return;
    }

    try {
      console.log(`Generating PDF for order: ${order.orderNumber}`);
      const pdfBuffer = await generateOrderPDF(order);

      console.log(`Sending email to: ${order.customerEmail}`);
      await sendOrderConfirmationEmail(order, pdfBuffer);

      console.log(`Sending admin notification to: ${emailUser.value()}`);
      await sendAdminNotificationEmail(order, pdfBuffer);

      console.log("Order confirmation emails sent successfully");
    } catch (error) {
      console.error("Error processing order confirmation:", error);
    }
  });

/**
 * Triggered when an order document is updated in Firestore.
 * Detects status changes and sends notification emails.
 */
export const onOrderStatusUpdated = onDocumentUpdated(
  {
    document: "orders/{orderId}",
    region: "asia-south1",
  },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data() as OrderData;
    const after = change.after.data() as OrderData;

    // Only proceed if status has changed
    if (before.status === after.status) return;

    try {
      const activeStatuses = [
        "Prepared",
        "Dispatched",
        "Delivered",
        "Cancelled",
        "Refund Requested",
        "Replacement Requested",
        "Return Requested",
        "Returned",
      ];

      if (activeStatuses.includes(after.status)) {
        await sendStatusUpdateEmail(after, after.status);
        // Admin alerts for requests
        const adminAlerts = [
          "Refund Requested",
          "Replacement Requested",
          "Return Requested",
          "Returned",
        ];
        if (adminAlerts.includes(after.status)) {
          await sendAdminStatusAlert(after, after.status);
        }
      }
    } catch (error) {
      console.error("Error processing status update notification:", error);
    }
  });

/**
 * Sends a status update email to the customer.
 * @param {OrderData} order The order data.
 * @param {string} status The new status.
 */
async function sendStatusUpdateEmail(
  order: OrderData,
  status: string
): Promise<void> {
  const logoUrl = LOGO_URL;
  let subject = `Order Update - ${order.orderNumber}`;
  let color = "#ef4444";
  let title = `Order ${status}`;
  let message = "";
  let extraContent = "";

  switch (status) {
    case "Prepared":
      subject = `Order Prepared - ${order.orderNumber} 🍪`;
      color = "#f39c12";
      title = "Order Prepared 🍪";
      message = `<p>Your order <b>#${order.orderNumber}</b> has been freshly ` +
        "prepared and will soon be dispatched.</p>";
      break;
    case "Dispatched":
      subject = `Order Dispatched - ${order.orderNumber} 🚚`;
      color = "#3498db";
      title = "Order Dispatched 🚚";
      message = `<p>Your order <b>#${order.orderNumber}</b> has been ` +
        "dispatched.</p>";
      if (order.shiprocketOrderId || order.trackingId) {
        const courier = order.courierName || "Shiprocket";
        const trackingId = order.trackingId || order.shiprocketOrderId;
        const trackingLink = `https://shiprocket.co/tracking/${trackingId}`;
        extraContent = `
          <p><b>Courier:</b> ${courier}</p>
          <p><b>Tracking ID:</b> ${trackingId}</p>
          <div style="margin-top: 20px;">
            <a href="${trackingLink}" style="background:#d32f2f;color:white;` +
          "padding:12px 20px;text-decoration:none;border-radius:6px;" +
          "display:inline-block;\">" +
          "Track Order" +
          "</a>" +
          "</div>" +
          "";
      }
      break;
    case "Delivered":
      subject = `Order Delivered - ${order.orderNumber} 🎉`;
      color = "#27ae60";
      title = "Order Delivered 🎉";
      message = `<p>Your order <b>#${order.orderNumber}</b> has been ` +
        "delivered.</p><p>We hope you enjoy your Munch Tokri snacks.</p>";
      break;
    case "Cancelled":
      subject = `Order Cancelled - ${order.orderNumber}`;
      color = "#e74c3c";
      title = "Order Cancelled";
      message = `<p>Your order <b>#${order.orderNumber}</b> has been ` +
        "cancelled.</p><p>If payment was made online, your refund will " +
        "be processed shortly.</p>";
      break;
    case "Refund Requested":
      subject = `Refund Request Received - ${order.orderNumber}`;
      color = "#e74c3c";
      title = "Refund Request Received";
      message = "<p>We have received your refund request for order " +
        `<b>#${order.orderNumber}</b>.</p><p>Our team will review ` +
        "and process it shortly.</p>";
      break;
    case "Replacement Requested":
      subject = `Replacement Request Received - ${order.orderNumber}`;
      color = "#0369a1";
      title = "Replacement Request Received";
      message = "<p>Your replacement request for order " +
        `<b>#${order.orderNumber}</b> has been registered.</p><p>We ` +
        "will notify you once the replacement is shipped.</p>";
      break;
    case "Return Requested":
      subject = `Return Request Submitted - ${order.orderNumber}`;
      color = "#92400e";
      title = "Return Request Submitted";
      message = `<p>Your return request for order <b>#${order.orderNumber}</b> ` +
        "has been received.</p><p>Our team will arrange pickup shortly.</p>";
      break;
    case "Returned":
      subject = `Return Completed - ${order.orderNumber}`;
      color = "#166534";
      title = "Return Completed";
      message = `<p>Your returned item for order <b>#${order.orderNumber}</b> ` +
        "has been received.</p><p>Your refund will be processed soon.</p>";
      break;
    default:
      message = `<p>Your order status has been updated to ${status}.</p>`;
  }

  const mailOptions = {
    from: `"Munch Tokri" <${emailUser.value()}>`,
    to: order.customerEmail,
    subject: subject,
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; ` +
      "background: #f4f4f4; padding: 30px;\">" +
      "<div style=" +
      "\"max-width: 700px; margin: auto; background: white; " +
      "padding: 30px; border-radius: 8px;\">" +
      "<div style=\"text-align: center; margin-bottom: 20px;\">" +
      `<img src="${logoUrl}" width="200" alt="Munch Tokri">` +
      "</div>" +
      `<h2 style="color: ${color}; text-align: center;">${title}</h2>` +
      "<div style=\"color: #333; line-height: 1.6;\">" +
      `<p>Hello <strong>${order.customerName}</strong>,</p>` +
      `${message}` +
      `${extraContent}` +
      "</div>" +
      "<p style=\"font-size: 13px; color: #777; margin-top: 30px; " +
      "text-align: center;\">" +
      "Authentic Karnataka Munchies Since 1961<br>" +
      "Hurigalu Angadi" +
      "</p>" +
      "</div>" +
      "</div>" +
      "",
  };

  await sendEmailWithRetry(mailOptions);
}

/**
 * Sends a status alert email to the admin.
 * @param {OrderData} order The order data.
 * @param {string} status The new status.
 */
async function sendAdminStatusAlert(
  order: OrderData,
  status: string
): Promise<void> {
  const mailOptions = {
    from: `"Munch Tokri System" <${emailUser.value()}>`,
    to: emailUser.value(),
    subject: `Order Status Alert: ${status} - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;
        margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0;
        border-radius: 8px;">
        <h2 style="color: #ef4444; text-align: center;">Status Update Alert</h2>
        <p>An order status has been updated by the customer/system.</p>
        <div style="background-color: #f8fafc; padding: 15px;
          border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Order Number:</strong>
            ${order.orderNumber}</p>
          <p style="margin: 5px 0 0;"><strong>Customer:</strong>
            ${order.customerName}</p>
          <p style="margin: 5px 0 0;"><strong>New Status:</strong>
            <span style="color: #ef4444; font-weight: bold;">
              ${status}</span></p>
        </div>
        <p>Please check the admin portal for further details and processing.</p>
      </div>
    `,
  };

  return sendEmailWithRetry(mailOptions);
}

/**
 * Generates a PDF receipt for the given order.
 * @param {OrderData} order The order data for which to generate the PDF.
 * @return {Promise<Buffer>} A promise that resolves to the PDF buffer.
 */
async function generateOrderPDF(
  order: OrderData
): Promise<Buffer> {
  // eslint-disable-next-line new-cap
  const doc = new jsPDF() as jsPDF & {
    autoTable: (options: object) => void;
    lastAutoTable: { finalY: number };
  };
  const pageWidth = doc.internal.pageSize.getWidth();

  // Sanitize amount to replace ₹ with Rs.
  const displayAmount = (order.amount || "").replace("₹", "Rs. ");

  // Header & Logo (Text-based for stability, better spacing)
  doc.setFontSize(24);
  doc.setTextColor(211, 47, 47); // red (#d32f2f)
  doc.setFont("helvetica", "bold");
  doc.text("MUNCH TOKRI", pageWidth / 2, 22, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(119, 119, 119); // #777
  doc.setFont("helvetica", "normal");
  doc.text("Authentic Karnataka Munchies Since 1961", pageWidth / 2, 28,
    { align: "center" });
  doc.text("Hurigalu Angadi", pageWidth / 2, 33, { align: "center" });

  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("Order Confirmation", 20, 45);

  doc.setFontSize(10);
  doc.text(`Hi ${order.customerName},`, 20, 55);
  doc.text("Thank you for ordering from Munch Tokri. " +
    "Your order has been successfully placed.", 20, 61);

  doc.setDrawColor(240, 240, 240);
  doc.line(20, 67, pageWidth - 20, 67);
  doc.setFont("helvetica", "bold");
  const dateStr = order.date ?
    order.date.toDate().toLocaleDateString() :
    new Date().toLocaleDateString();
  doc.text(`Order Date: ${dateStr}`, 20, 73);
  doc.setFont("helvetica", "normal");
  doc.line(20, 77, pageWidth - 20, 77);

  // Addresses
  const shipping = order.shippingDetails;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Billing Address", 20, 88);
  doc.text("Delivery Address", pageWidth / 2 + 10, 88);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  // Billing
  doc.text(`${order.customerName}`, 20, 95);
  doc.text(`${shipping?.address || ""}`, 20, 100);
  doc.text(`${shipping?.city || ""} - ${shipping?.pincode || ""}`,
    20, 105);
  doc.text(`${shipping?.mobile || ""}`, 20, 110);

  // Shipping
  doc.text(`${order.customerName}`, pageWidth / 2 + 10, 95);
  doc.text(`${shipping?.address || ""}`, pageWidth / 2 + 10, 100);
  doc.text(`${shipping?.city || ""} - ${shipping?.pincode || ""}`,
    pageWidth / 2 + 10, 105);
  doc.text(`${shipping?.mobile || ""}`, pageWidth / 2 + 10, 110);

  // Order ID
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Order ID: ${order.orderNumber}`, 20, 125);

  // Table
  const tableData = order.items.map((item: OrderItem) => {
    const cat = item.category?.toLowerCase();
    const isCombo = cat === 'combos' || cat === 'combo' || item.baseWeight === 1;
    const isCustomMix = cat === 'custom mix' || item.category === 'Custom Mix';
    
    // Quantity display (Units for combos, grams for everything else)
    const displayQty = isCombo && !isCustomMix ?
      `${item.quantity} Unit${item.quantity > 1 ? "s" : ""}` :
      `${item.quantity}g`;

    // Name display (Include sub-products for bundles)
    let displayName = item.name;
    if ((isCombo || isCustomMix) && item.products) {
      const baseName = isCustomMix ? "Custom Mix" : item.name;
      displayName = baseName + "\n" + item.products.map(
        (p: { name: string, grams: number }) => `  • ${p.name} (${p.grams}g)`
      ).join("\n");
    }

    // Unit Price string
    const unitPriceLabel = isCombo && !isCustomMix ? "/ Unit" : `/ ${(item.baseWeight || 100)}g`;
    const unitPrice = `Rs. ${item.price.toFixed(2)} ${unitPriceLabel}`;

    return [
      "", // Placeholder for Image
      displayName,
      unitPrice,
      displayQty,
      `Rs. ${((item.price / (item.baseWeight || 100)) *
        item.quantity).toFixed(2)}`,
    ];
  });

  doc.autoTable({
    startY: 130,
    head: [["Image", "Product", "Unit Cost", "Units", "Amount"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [243, 243, 243],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 80 },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [252, 252, 252] },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  const subtotal = order.items.reduce((sum: number, item: OrderItem) =>
    sum + ((item.price / (item.baseWeight || 100)) * item.quantity), 0);
  
  // Fetch store settings for shipping rules
  const storeSnap = await admin.firestore().collection("settings").doc("store").get();
  const storeSettings = storeSnap.exists ? storeSnap.data() : null;
  
  let shippingCost = 0;
  if (storeSettings?.enableFlatRateShipping !== false) {
    const threshold = storeSettings?.freeShippingThreshold ?? 350;
    const rate = storeSettings?.shippingRate ?? 50;
    shippingCost = subtotal < threshold ? rate : 0;
  }

  const netSubtotal = subtotal -
    (order.discount || 0) -
    (order.membershipDiscount || 0);
  const tax = netSubtotal * 0.05;

  // Totals Grid
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let currentY = finalY;

  // Base Subtotal
  doc.text("Order Subtotal", 120, currentY);
  doc.text(`Rs. ${subtotal.toFixed(2)}`, pageWidth - 20,
    currentY, { align: "right" });
  currentY += 7;

  // Promo Discount
  if (order.discount && order.discount > 0) {
    doc.setTextColor(22, 163, 74); // success green
    doc.text("Promo Discount", 120, currentY);
    doc.text(`-Rs. ${order.discount.toFixed(2)}`,
      pageWidth - 20, currentY, { align: "right" });
    currentY += 7;
    doc.setTextColor(0, 0, 0); // back to black
  }

  // Membership Discount
  if (order.membershipDiscount && order.membershipDiscount > 0) {
    doc.setTextColor(211, 47, 47); // red
    doc.text("Member Discount", 120, currentY);
    doc.text(`-Rs. ${order.membershipDiscount.toFixed(2)}`,
      pageWidth - 20, currentY, { align: "right" });
    currentY += 7;
    doc.setTextColor(0, 0, 0);
  }

  // Shipping
  doc.text("Shipping", 120, currentY);
  doc.text(`Rs. ${shippingCost.toFixed(2)}`,
    pageWidth - 20, currentY, { align: "right" });
  currentY += 7;

  // COD Price
  if (order.codPrice && order.codPrice > 0) {
    doc.text("COD Extra Charge", 120, currentY);
    doc.text(`Rs. ${order.codPrice.toFixed(2)}`,
      pageWidth - 20, currentY, { align: "right" });
    currentY += 7;
  }

  // GST
  doc.text("GST (CGST 2.5% + SGST 2.5%)", 120, currentY);
  doc.text(`Rs. ${tax.toFixed(2)}`, pageWidth - 20, currentY, { align: "right" });
  currentY += 9;

  // Net Total
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Net Total", 120, currentY);
  doc.text(`${displayAmount}`, pageWidth - 20, currentY, { align: "right" });

  // Loyalty Points
  if (order.earnedPoints && order.earnedPoints > 0) {
    currentY += 10;
    doc.setFontSize(10);
    doc.setTextColor(211, 47, 47);
    doc.text(`Loyalty Points Earned: ${order.earnedPoints} Coins`,
      120, currentY);
    doc.setTextColor(0, 0, 0);
  }

  doc.setDrawColor(240, 240, 240);
  doc.line(20, currentY + 6, pageWidth - 20, currentY + 6);

  // Transaction Details - Table format to match email look
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Transaction", 20, finalY + 32);

  const isPaid = order.status === "Paid" ||
    order.method?.payment !== "Cash on Delivery (COD)";

  doc.autoTable({
    startY: finalY + 36,
    margin: { left: 20, right: 20 },
    body: [
      [
        order.method?.payment || "N/A",
        isPaid ? "Paid" : "Pending",
      ],
    ],
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      1: { halign: "right" },
    },
  });

  const footerY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal");
  doc.text("Authentic Karnataka Munchies Since 1961 - Hurigalu Angadi",
    pageWidth / 2, footerY, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Sends an order confirmation email with a PDF attachment.
 * @param {OrderData} order The order data for the customer.
 * @param {Buffer} pdfBuffer The PDF receipt as a buffer.
 * @return {Promise<any>} A promise that resolves when the email is sent.
 */
async function sendOrderConfirmationEmail(
  order: OrderData,
  pdfBuffer: Buffer
): Promise<void> { // Changed to void
  const subtotal = order.items.reduce((sum: number, item: OrderItem) =>
    sum + ((item.price / (item.baseWeight || 100)) * item.quantity), 0);
  
  // Fetch store settings for shipping rules
  const storeSnap = await admin.firestore().collection("settings").doc("store").get();
  const storeSettings = storeSnap.exists ? storeSnap.data() : null;
  
  let shippingCost = 0;
  if (storeSettings?.enableFlatRateShipping !== false) {
    const threshold = storeSettings?.freeShippingThreshold ?? 350;
    const rate = storeSettings?.shippingRate ?? 50;
    shippingCost = subtotal < threshold ? rate : 0;
  }
  const tax = subtotal * 0.05;
  const displayAmount = (order.amount || "").replace("₹", "Rs. ");

  const productRows = order.items.map((item: OrderItem) => {
    const amount = ((item.price / (item.baseWeight || 100)) *
      item.quantity).toFixed(2);
    let imgSrc = item.imageURL || LOGO_URL;
    if (imgSrc.startsWith("/")) {
      imgSrc = `https://munch-tokri.web.app${imgSrc}`;
    }
    const cat = item.category?.toLowerCase();
    const isCombo = cat === 'combos' || cat === 'combo' || item.baseWeight === 1;
    const isCustomMix = cat === 'custom mix' || item.category === 'Custom Mix';

    const displayQty = isCombo && !isCustomMix ?
      `${item.quantity} Unit${item.quantity > 1 ? "s" : ""}` :
      `${item.quantity}g`;

    let displayName = item.name;
    if ((isCombo || isCustomMix) && item.products) {
      const baseName = isCustomMix ? "Custom Mix" : item.name;
      displayName = `<strong>${baseName}</strong><br/>` +
        "<small style=\"color: #64748b; margin-left: 10px; display: block;\">" +
        item.products.map((p: { name: string, grams: number }) =>
          `• ${p.name} (${p.grams}g)`
        ).join("<br/>") +
        "</small>";
    }

    const unitPriceLabel = isCombo && !isCustomMix ? "/ Unit" : `/ ${(item.baseWeight || 100)}g`;
    const displayUnitCost = `${item.price.toFixed(2)} ${unitPriceLabel}`;

    return `
    <tr style="border-bottom: 1px solid #eee">
      <td style="padding: 10px"><img src="${imgSrc}" width="50" ` +
      "style=\"border-radius: 4px\"></td>" +
      `<td style="padding: 10px">${displayName}</td>` +
      `<td align="center" style="padding: 10px">Rs. ${displayUnitCost}</td>` +
      `<td align="center" style="padding: 10px">${displayQty}</td>` +
      `<td align="right" style="padding: 10px">Rs. ${amount}</td>` +
      "</tr>" +
      "";
  }).join("");

  const dateStr = order.date ?
    order.date.toDate().toLocaleDateString() :
    new Date().toLocaleDateString();

  const isPaid = order.status === "Paid" ||
    order.method?.payment !== "Cash on Delivery (COD)";

  const htmlContent = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f2f2f2;` +
    "padding:30px\">" +
    "<div style=\"max-width:800px;margin:auto;background:white;" +
    "border-radius:6px;padding:30px\">" +
    "<div style=\"text-align:center; margin-bottom: 20px;\">" +
    `<img src="${LOGO_URL}" width="200" alt="Munch Tokri">` +
    "</div>" +
    "<h2 style=\"color:#d32f2f\">Order Confirmation</h2>" +
    `<p>Hi ${order.customerName},</p>` +
    "<p>Thank you for ordering from <b>Munch Tokri</b>. " +
    "Your order has been successfully placed.</p>" +
    "<hr style=\"border: none; border-top: 1px solid #eee\">" +
    `<b>Order Date:</b> ${dateStr}` +
    "<hr style=\"border: none; border-top: 1px solid #eee\">" +
    "<table width=\"100%\" style=\"margin-top:20px\">" +
    "<tr>" +
    "<td width=\"50%\" valign=\"top\">" +
    "<h3 style=\"color: #333; margin-bottom: 10px;\">" +
    "Billing Address</h3>" +
    `${order.customerName}<br>` +
    `${order.shippingDetails?.address || ""}<br>` +
    `${order.shippingDetails?.city || ""} - ` +
    `${order.shippingDetails?.pincode || ""}<br>` +
    `${order.shippingDetails?.mobile || ""}<br>` +
    "</td>" +
    "<td width=\"50%\" valign=\"top\">" +
    "<h3 style=\"color: #333; margin-bottom: 10px;\">" +
    "Delivery Address</h3>" +
    `${order.customerName}<br>` +
    `${order.shippingDetails?.address || ""}<br>` +
    `${order.shippingDetails?.city || ""} - ` +
    `${order.shippingDetails?.pincode || ""}<br>` +
    `${order.shippingDetails?.mobile || ""}<br>` +
    "</td>" +
    "</tr>" +
    "</table>" +
    "<hr style=\"border: none; border-top: 1px solid #eee\">" +
    `<h3>Order ID: ${order.orderNumber}</h3>` +
    "<table width=\"100%\" style=\"border-collapse:collapse\">" +
    "<tr style=\"background:#f3f3f3\">" +
    "<th align=\"left\" style=\"padding: 10px\">Image</th>" +
    "<th align=\"left\" style=\"padding: 10px\">Product</th>" +
    "<th style=\"padding: 10px\">Unit Cost</th>" +
    "<th style=\"padding: 10px\">Units</th>" +
    "<th align=\"right\" style=\"padding: 10px\">Amount</th>" +
    "</tr>" +
    `${productRows}` +
    "</table>" +
    "<hr style=\"border: none; border-top: 1px solid #eee\">" +
    "<table width=\"100%\" style=\"font-size: 14px; color: #444;\">" +
    "<tr>" +
    "<td style=\"padding: 5px 0;\">Subtotal</td>" +
    "<td align=\"right\" style=\"padding: 5px 0;\">" +
    `Rs. ${subtotal.toFixed(2)}</td>` +
    "</tr>" +
    `${order.discount && order.discount > 0 ?
      "<tr>" +
      "<td style=\"padding: 5px 0; color: #16a34a;\">" +
      "Promo Discount</td>" +
      "<td align=\"right\" style=\"padding: 5px 0; " +
      "color: #16a34a;\">" +
      `- Rs. ${order.discount.toFixed(2)}</td>` +
      "</tr>" : ""}` +
    `${order.membershipDiscount && order.membershipDiscount > 0 ?
      "<tr>" +
      "<td style=\"padding: 5px 0; color: #d32f2f;\">" +
      "Member Discount</td>" +
      "<td align=\"right\" style=\"padding: 5px 0; " +
      "color: #d32f2f;\">" +
      `- Rs. ${order.membershipDiscount.toFixed(2)}</td>` +
      "</tr>" : ""}` +
    "<tr>" +
    "<td style=\"padding: 5px 0;\">Shipping</td>" +
    "<td align=\"right\" style=\"padding: 5px 0;\">" +
    `Rs. ${shippingCost.toFixed(2)}</td>` +
    "</tr>" +
    `${order.codPrice && order.codPrice > 0 ?
      "<tr>" +
      "<td style=\"padding: 5px 0;\">COD Extra Charge</td>" +
      "<td align=\"right\" style=\"padding: 5px 0;\">" +
      `Rs. ${order.codPrice.toFixed(2)}</td>` +
      "</tr>" : ""}` +
    "<tr>" +
    "<td style=\"padding: 5px 0;\">GST (CGST 2.5% + SGST 2.5%)</td>" +
    "<td align=\"right\" style=\"padding: 5px 0;\">" +
    `Rs. ${tax.toFixed(2)}</td>` +
    "</tr>" +
    "<tr style=\"font-size: 18px; color: #000; font-weight: bold;\">" +
    "<td style=\"padding: 10px 0; border-top: 1px solid #eee;\">" +
    "Total Amount</td>" +
    "<td align=\"right\" style=\"padding: 10px 0; " +
    "border-top: 1px solid #eee;\">" +
    `${displayAmount}</td>` +
    "</tr>" +
    `${order.earnedPoints && order.earnedPoints > 0 ?
      "<tr>" +
      "<td colspan=\"2\" align=\"right\" style=\"padding-top: 10px; " +
      "color: #d32f2f; font-weight: bold;\">" +
      `🎉 You earned ${order.earnedPoints} Coins on this order!` +
      "</td>" +
      "</tr>" : ""}` +
    "</table>" +
    "<hr style=\"border: none; border-top: 1px solid #eee\">" +
    "<h3>Transaction</h3>" +
    "<table width=\"100%\">" +
    "<tr>" +
    `<td>${order.method?.payment || "N/A"}</td>` +
    `<td align="right">${isPaid ? "Paid" : "Pending"}</td>` +
    "</tr>" +
    "</table>" +
    "<p style=\"font-size:13px;color:#777;margin-top:30px\">" +
    "Authentic Karnataka Munchies Since 1961" +
    "<br>" +
    "Hurigalu Angadi" +
    "</p>" +
    "</div>" +
    "</div>" +
    "";

  const mailOptions = {
    from: `"Munch Tokri" <${emailUser.value()}>`,
    to: order.customerEmail,
    subject: `Order Confirmation - ${order.orderNumber}`,
    html: htmlContent,
    attachments: [
      {
        filename: `Receipt-${order.orderNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  };

  await sendEmailWithRetry(mailOptions);
}

/**
 * Sends an order notification email to the admin.
 * @param {OrderData} order The order data.
 * @param {Buffer} pdfBuffer The PDF receipt as a buffer.
 */
async function sendAdminNotificationEmail(
  order: OrderData,
  pdfBuffer: Buffer
): Promise<void> {
  const mailOptions = {
    from: `"Munch Tokri System" <${emailUser.value()}>`,
    to: emailUser.value(),
    subject: `New Order Received - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;
        margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0;
        border-radius: 8px;">
        <h2 style="color: #ef4444; text-align: center;">New Order Alert</h2>
        <p>A new order has been placed on Munch Tokri!</p>
        <div style="background-color: #f8fafc; padding: 15px;
          border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Order Number:</strong>
            ${order.orderNumber}</p>
          <p style="margin: 5px 0 0;"><strong>Customer:</strong>
            ${order.customerName}</p>
          <p style="margin: 5px 0 0;"><strong>Email:</strong>
            ${order.customerEmail}</p>
          <p style="margin: 5px 0 0;"><strong>Amount:</strong>
            ${order.amount}</p>
          <p style="margin: 5px 0 0;"><strong>Payment Method:</strong>
            ${order.method?.payment || "N/A"}</p>
        </div>
        <h3 style="color: #333; margin-top: 20px; font-size: 16px;">Items Ordered:</h3>
        <ul style="padding-left: 20px; margin: 10px 0;">
          ${order.items.map((item) => `
            <li style="margin-bottom: 8px;">
              <strong>${item.name}</strong> x ${item.quantity}
            </li>
          `).join('')}
        </ul>
        <p>The invoice is attached for your reference.
          Please check the admin portal for further details.</p>
      </div>
    `,
    attachments: [
      {
        filename: `Receipt-${order.orderNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  };

  await sendEmailWithRetry(mailOptions);
}

/**
 * Gets authentication token from Shiprocket.
 * @return {Promise<string>} Authentication token.
 */
async function getShiprocketToken(): Promise<string | null> {
  try {
    const email = shiprocketEmail.value().trim();
    const password = shiprocketPass.value().trim();
    console.log("Attempting Shiprocket login for email:",
      shiprocketEmail.value());
    console.log("Password length:", shiprocketPass.value().length);
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/auth/login",
      {
        email: email,
        password: password,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.token;
  } catch (err: unknown) {
    const error = err as {
      response?: { data?: unknown, status?: number },
      message?: string
    };
    console.error("Shiprocket Auth Error:",
      JSON.stringify(error.response?.data || error.message, null, 2));
    if (error.response) {
      console.error("Status:", error.response.status);
    }
    throw new HttpsError("internal", "Shiprocket authentication failed");
  }
}

/**
 * HTTPS Callable function to create an order in Shiprocket.
 */
export const createShiprocketOrder = onCall(
  { region: "asia-south1", invoker: "public" },
  async (request) => {
    // Ensure user is authenticated as admin (simplified for now)
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const { orderId } = request.data;
    if (!orderId) {
      throw new HttpsError("invalid-argument", "Order ID is required");
    }

    const orderRef = admin.firestore().collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "Order not found");
    }

    const order = orderDoc.data() as OrderData;

    // Prevent duplicate shipments
    if (order.shiprocketOrderId || order.shiprocketShipmentId) {
      console.log("Order already has a Shiprocket shipment, " +
        "skipping creation.");
      return {
        order_id: order.shiprocketOrderId,
        shipment_id: order.shiprocketShipmentId,
        alreadyCreated: true,
      };
    }
    const token = await getShiprocketToken();
    console.log("Acquired Shiprocket token, preparing order payload...");

    try {
      const shiprocketOrder = {
        order_id: order.orderNumber || orderId,
        order_date: new Date().toISOString().slice(0, 16).replace("T", " "),
        pickup_location: shiprocketPickup.value(),
        billing_customer_name: order.customerName.split(" ")[0],
        billing_last_name: order.customerName.split(" ").slice(1).join(" ") ||
          "Customer",
        billing_address: order.shippingDetails.address.length < 10 ?
          `${order.shippingDetails.address} - Address Details` :
          order.shippingDetails.address,
        billing_city: order.shippingDetails.city,
        billing_pincode: order.shippingDetails.pincode,
        billing_state: order.shippingDetails.state,
        billing_country: "India",
        billing_email: order.customerEmail,
        billing_phone: order.shippingDetails.mobile,
        shipping_is_billing: true,
        order_items: order.items.map((item: OrderItem) => ({
          name: item.name,
          sku: item.productId || item.name,
          units: item.quantity,
          selling_price: item.price / 100,
        })),
        payment_method: order.method?.payment === "COD" ? "COD" : "Prepaid",
        sub_total: parseFloat(order.amount.replace("₹", "").replace(",", "")),
        length: 10,
        breadth: 10,
        height: 10,
        weight: 0.5,
      };

      console.log("Requesting Shiprocket order creation...");
      const response = await axios.post(
        "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
        shiprocketOrder,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        }
      );

      console.log("Shiprocket Response:", response.data);

      const shipmentData = {
        order_id: response.data.order_id,
        shipment_id: response.data.shipment_id,
      };

      await orderRef.update({
        shiprocketOrderId: shipmentData.order_id.toString(),
        shiprocketShipmentId: shipmentData.shipment_id.toString(),
        status: "Dispatched",
      });

      return shipmentData;
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string } },
        message?: string
      };
      console.error("Shiprocket Order Error:",
        JSON.stringify(error.response?.data || error.message, null, 2));
      throw new HttpsError("internal",
        error.response?.data?.message || "Failed to create Shiprocket order");
    }
  });

/**
 * Creates a Razorpay order.
 */
export const createPayOrder = onCall(
  { region: "asia-south1", invoker: "public", secrets: [razorpayKeySecret] },
  async (request) => {
    // Log auth status for debugging but don't block - invoker is public
    console.log("createPayOrder auth status:",
      request.auth ? `uid: ${request.auth.uid}` : "no auth token");

    const { amount } = request.data;
    if (!amount) {
      throw new HttpsError("invalid-argument", "Amount is required");
    }
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0 || numericAmount > 500000) {
      throw new HttpsError("invalid-argument",
        "Amount must be a positive number not exceeding ₹5,00,000");
    }

    console.log("createPayOrder called with amount:", amount);
    try {
      // Use defineString params for reliable access in Firebase Functions v2
      const keyId = razorpayKeyId.value();
      const keySecret = razorpayKeySecret.value();

      if (!keyId || !keySecret) {
        console.error("CRITICAL: Razorpay keys missing in environment. " +
          "Ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set " +
          "in functions/.env");
        throw new HttpsError(
          "failed-precondition",
          "Payment gateway configuration missing on server"
        );
      }

      console.log("Initializing Razorpay with Key ID:",
        keyId.substring(0, 7) + "...");
      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      const options = {
        amount: Math.round(Number(amount) * 100), // convert to paise
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };

      console.log("Creating Razorpay order with options:",
        JSON.stringify(options));
      const order = await razorpay.orders.create(options);
      console.log("Razorpay order created successfully:", order.id);
      return { success: true, order };
    } catch (err: unknown) {
      const error = err as {
        message: string,
        code?: string,
        stack?: string,
        error?: unknown
      };
      console.error("Razorpay Order Creation Error Detail:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.error, // Razorpay specific errors
      });
      throw new HttpsError("internal", error.message || "Razorpay API error");
    }
  });

/**
 * Verification of Razorpay Payment Signature (Optional helper for security)
 */
export const verifyPayment = onCall(
  { region: "asia-south1", invoker: "public", secrets: [razorpayKeySecret] },
  async (request) => {
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = request.data;

    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", razorpayKeySecret.value())
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpaySignature) {
      return { status: "success" };
    } else {
      throw new HttpsError("invalid-argument", "Invalid signature");
    }
  });

/**
 * Validates a coupon code.
 */
export const validateCoupon = onCall(
  { region: "asia-south1", invoker: "public" },
  async (request) => {
    const { code, subtotal } = request.data;
    if (!code) {
      throw new HttpsError("invalid-argument", "Coupon code is required");
    }

    console.log(`Validating coupon: ${code} for subtotal: ${subtotal}`);

    const couponRef = admin.firestore().collection("coupons").doc(code);
    const doc = await couponRef.get();

    if (!doc.exists) {
      throw new HttpsError("not-found", "Invalid coupon code");
    }

    const data = doc.data();
    if (!data) {
      throw new HttpsError("internal", "Coupon data is missing");
    }

    // Check if active
    if (data.status !== "active") {
      throw new HttpsError("failed-precondition", "Coupon is no longer active");
    }

    // Check expiry
    if (data.expiryDate) {
      const expiry = data.expiryDate.toDate();
      if (new Date() > expiry) {
        throw new HttpsError("failed-precondition", "Coupon has expired");
      }
    }

    // Check usage limit - Changed from usageLimit to maxUses
    if (data.maxUses && (data.usedCount || 0) >= data.maxUses) {
      throw new HttpsError("failed-precondition", "Coupon usage limit reached");
    }

    // Check minimum order value
    if (data.minOrderValue && subtotal < data.minOrderValue) {
      throw new HttpsError("failed-precondition",
        `Minimum order of ₹${data.minOrderValue} required for this coupon`);
    }

    return {
      valid: true,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minOrderValue: data.minOrderValue,
    };
  });

// Webhook endpoint for Shiprocket tracking updates.

export const shiprocketWebhook = onRequest(
  { region: "asia-south1" },
  async (request, response) => {
    try {
      if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
      }

      // Webhook secret verification
      const webhookSecret = shiprocketWebhookSecret.value();
      if (webhookSecret) {
        const providedSecret =
          (request.query.secret as string) ||
          (request.headers["x-webhook-secret"] as string) ||
          (request.headers["x-api-key"] as string);
        if (providedSecret !== webhookSecret) {
          console.error("Webhook secret mismatch - unauthorized request");
          response.status(401).send("Unauthorized");
          return;
        }
      }

      console.log("Webhook Payload:", JSON.stringify(request.body));

      const orderId = request.body.order_id;
      const currentStatus = request.body.current_status;

      if (!orderId || !currentStatus) {
        console.error("Missing order_id or current_status");
        response.status(400).send("Bad Request: Missing fields");
        return;
      }

      const status = currentStatus.toUpperCase();
      let nextSystemStatus: string | null = null;

      if (status === "DELIVERED") {
        nextSystemStatus = "Delivered";
      } else if (status === "CANCELED") {
        nextSystemStatus = "Cancelled";
      }

      if (!nextSystemStatus) {
        console.log(`Status '${status}' ignored for order ${orderId}.`);
        response.status(200).send("OK: Status ignored.");
        return;
      }

      const ordersRef = admin.firestore().collection("orders");
      const snapshot = await ordersRef
        .where("orderNumber", "==", String(orderId))
        .get();

      if (snapshot.empty) {
        const docRef = await ordersRef.doc(String(orderId)).get();
        if (!docRef.exists) {
          console.error(`Order not found for Shiprocket ID: ${orderId}`);
          response.status(404).send("Order Not Found");
          return;
        }

        console.log(`Found doc for order ID: ${orderId}, ` +
          `status to: ${nextSystemStatus}`);
        await docRef.ref.update({ status: nextSystemStatus });
      } else {
        const docRef = snapshot.docs[0].ref;
        console.log(`Found orderNumber: ${orderId}, ` +
          `status to: ${nextSystemStatus}`);
        await docRef.update({ status: nextSystemStatus });
      }

      response.status(200).send("Webhook Processed Successfully");
    } catch (error) {
      console.error("Error processing Shiprocket webhook:", error);
      response.status(500).send("Internal Server Error");
    }
  }
);

/**
 * Fetches the membership status for a given user.
 */
export const membershipStatus = onRequest(async (req, res) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      res.status(400).send({ error: "User ID is required" });
      return;
    }

    const snapshot = await admin.firestore()
      .collection("memberships")
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .get();

    if (snapshot.empty) {
      res.status(200).send({ isMember: false });
      return;
    }

    const memberships = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).send({ isMember: true, memberships });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("Membership Status Error:", e);
    res.status(500).send({ error: e.message || "Failed to fetch status" });
  }
});

/**
 * Creates a Razorpay subscription for a user.
 */
export const createSubscription = onRequest(
  { secrets: [razorpayKeySecret] },
  async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).send({ error: "User ID is required" });
        return;
      }

      const razorpay = new Razorpay({
        key_id: razorpayKeyId.value(),
        key_secret: razorpayKeySecret.value(),
      });

      const subscription = await razorpay.subscriptions.create({
        plan_id: "plan_SXKsy3aNPYhIEh",
        customer_notify: 1,
        total_count: 1, // 1 year membership
        notes: {
          userId: userId,
        },
      });

      res.status(200).send(subscription);
    } catch (error: unknown) {
      const e = error as Error;
      console.error("Razorpay Subscription Error:", e);
      res.status(500).send({
        error: e.message ||
          "Failed to create subscription"
      });
    }
  });

/**
 * Cancels a Razorpay subscription for a user.
 */
export const cancelSubscription = onRequest(
  { secrets: [razorpayKeySecret] },
  async (req, res) => {
    try {
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        res.status(400).send({ error: "Subscription ID is required" });
        return;
      }

      const razorpay = new Razorpay({
        key_id: razorpayKeyId.value(),
        key_secret: razorpayKeySecret.value(),
      });

      // Cancel in Razorpay
      await razorpay.subscriptions.cancel(subscriptionId);

      // Update in Firestore
      await admin.firestore().collection("memberships").doc(subscriptionId)
        .update({
          status: "cancelled",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      res.status(200).send({
        success: true,
        message: "Subscription cancelled successfully",
      });
    } catch (error: unknown) {
      const e = error as Error;
      console.error("Razorpay Cancellation Error:", e);
      res.status(500).send({
        error: e.message ||
          "Failed to cancel subscription"
      });
    }
  });

/**
 * Handles Razorpay webhooks for subscriptions.
 */
export const razorpayWebhook = onRequest(
  { secrets: [razorpayWebhookSecret] },
  async (req, res) => {
    try {
      const body = req.rawBody.toString();
      const signature = req.headers["x-razorpay-signature"] as string;

      if (!signature) {
        res.status(400).send({ error: "Missing signature" });
        return;
      }

      const expected = crypto
        .createHmac("sha256", razorpayWebhookSecret.value())
        .update(body)
        .digest("hex");

      if (signature !== expected) {
        console.error("Razorpay Webhook: Invalid signature");
        res.status(400).send({ error: "Invalid signature" });
        return;
      }

      const event = JSON.parse(body);
      console.log("Razorpay Webhook Event:", event.event);

      if (event.event === "subscription.charged") {
        const sub = event.payload.subscription.entity;
        const userId = sub.notes?.userId;

        if (!userId) {
          console.warn("Razorpay Webhook: userId not found in notes");
          res.status(400).send({ error: "userId not found" });
          return;
        }

        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        await activateUserMembership(userId, expiryDate, sub.id);
      } else if (event.event === "subscription.cancelled") {
        const sub = event.payload.subscription.entity;
        const userId = sub.notes?.userId;

        await admin.firestore().collection("memberships").doc(sub.id).update({
          status: "cancelled",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (userId) {
          await admin.firestore().collection("customers").doc(userId).update({
            isMember: false,
          });
        }
      } else if (event.event === "subscription.completed") {
        // Handle manual-like completion or final payment
        const sub = event.payload.subscription.entity;
        const userId = sub.notes?.userId;
        if (userId) {
          const expiryDate = new Date();
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          await activateUserMembership(userId, expiryDate, sub.id);
        }
      }

      res.status(200).send({ status: "ok" });
    } catch (error: unknown) {
      const e = error as Error;
      console.error("Razorpay Webhook Error:", e);
      res.status(500).send({
        error: e.message ||
          "Webhook processing failed"
      });
    }
  });

/**
 * Helper to activate/extend membership for a user.
 * @param {string} userId The user ID.
 * @param {Date} expiryDate The new expiry date.
 * @param {string} subscriptionId Optional subscription ID.
 */
async function activateUserMembership(
  userId: string,
  expiryDate: Date,
  subscriptionId?: string
): Promise<void> {
  const db = admin.firestore();
  const subId = subscriptionId || `manual_${userId}`;

  console.log(`Activating membership for user: ${userId}, subId: ${subId}`);

  // Find and cancel any existing active memberships for this user ("cancel all")
  const existingActive = await db.collection("memberships")
    .where("userId", "==", userId)
    .where("status", "==", "active")
    .get();

  const batch = db.batch();

  if (!existingActive.empty) {
    console.log(`Found ${existingActive.size} existing active memberships to cancel.`);
    existingActive.docs.forEach((doc) => {
      // Don't cancel the one we are about to activate if IDs match
      if (doc.id !== subId) {
        batch.update(doc.ref, {
          status: "cancelled",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          cancellationReason: "Replaced by new membership",
        });
      }
    });
  }

  // Set the new membership to active
  batch.set(db.collection("memberships").doc(subId), {
    userId,
    status: "active",
    expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    type: subscriptionId ? "razorpay" : "manual",
  }, { merge: true });

  // Update customer profile
  batch.set(db.collection("customers").doc(userId), {
    isMember: true,
    membershipExpiry: admin.firestore.Timestamp.fromDate(expiryDate),
    lastMembershipId: subId,
  }, { merge: true });

  await batch.commit();
  console.log(`Membership ${subId} activated successfully for user ${userId}`);
}

/**
 * Scheduled function to check for expired memberships daily.
 */
export const checkMembershipExpiry = onSchedule(
  {
    schedule: "0 0 * * *", // Every midnight
    region: "asia-south1",
    maxInstances: 1,
  },
  async (event) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    console.log("Checking for expired memberships...");

    const expiredSnap = await db.collection("memberships")
      .where("status", "==", "active")
      .where("expiryDate", "<", now)
      .get();

    if (expiredSnap.empty) {
      console.log("No expired memberships found.");
      return;
    }

    const batch = db.batch();
    expiredSnap.docs.forEach((snap) => {
      batch.update(snap.ref, {
        status: "expired",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const userId = snap.data().userId;
      if (userId) {
        batch.update(db.collection("customers").doc(userId), {
          isMember: false,
        });
      }
    });

    await batch.commit();
    console.log(`Processed ${expiredSnap.size} expired memberships.`);
  }
);

/**
 * Syncs membership status to customer profile when changed manually in admin.
 */
export const syncMembershipToCustomer = onDocumentWritten(
  {
    document: "memberships/{subId}",
    region: "asia-south1",
  },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const data = change.after.exists ? change.after.data() : null;
    if (!data || !data.userId) return;

    const db = admin.firestore();
    
    // Check if the user has ANY active membership
    const activeSnap = await db.collection("memberships")
      .where("userId", "==", data.userId)
      .where("status", "==", "active")
      .get();

    const hasActive = !activeSnap.empty;
    let latestExpiry: admin.firestore.Timestamp | null = null;

    if (hasActive) {
      // Find the furthest expiry date among active ones
      activeSnap.docs.forEach((doc) => {
        const docData = doc.data();
        if (docData.expiryDate) {
          if (!latestExpiry || docData.expiryDate.toMillis() > latestExpiry.toMillis()) {
            latestExpiry = docData.expiryDate;
          }
        }
      });
    }

    await db.collection("customers").doc(data.userId).set({
      isMember: hasActive,
      membershipExpiry: latestExpiry,
    }, { merge: true });

    console.log(`Synced membership for ${data.userId}. isMember: ${hasActive}`);
  }
);
