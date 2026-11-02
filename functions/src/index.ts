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
try {
  admin.firestore().settings({ ignoreUndefinedProperties: true });
} catch (e) {
  // settings already applied
}

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

// Velocity parameters
const velocityApiKey = defineString("VELOCITY_API_KEY");
const velocityWarehouseId = defineString("VELOCITY_WAREHOUSE_ID", {
  default: "",
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
  variant?: string;
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
  velocityOrderId?: string;
  velocityShipmentId?: string;
  velocityAWB?: string;
  earnedPoints?: number;
  discount?: number;
  membershipDiscount?: number;
  codPrice?: number;
  trackingId?: string;
  courierName?: string;
  paymentDetails?: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    method?: string;
    isMagicCheckout?: boolean;
    [key: string]: any;
  };
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
    if (!order) {
      console.log("No order data found:", event.params.orderId);
      return;
    }

    try {
      console.log(`Generating PDF for order: ${order.orderNumber}`);
      let pdfBuffer: Buffer | null = null;
      try {
        pdfBuffer = await generateOrderPDF(order);
      } catch (pdfErr) {
        console.error("PDF generation failed, proceeding with fallback notification:", pdfErr);
      }

      if (pdfBuffer) {
        // Send customer email if valid email present and not fallback placeholder
        const isFallbackEmail = !order.customerEmail ||
          order.customerEmail.includes("customer@munchtokri.com") ||
          order.customerEmail.includes("orders@munchtokri.com") ||
          order.customerEmail.includes("@munchtokri.in");
        if (!isFallbackEmail && order.customerEmail.includes("@")) {
          try {
            console.log(`Sending confirmation email to: ${order.customerEmail}`);
            await sendOrderConfirmationEmail(order, pdfBuffer);
          } catch (custEmailErr) {
            console.error("Failed to send customer confirmation email:", custEmailErr);
          }
        }

        // Always send admin notification email
        try {
          console.log(`Sending admin notification to: ${emailUser.value()}`);
          await sendAdminNotificationEmail(order, pdfBuffer);
        } catch (adminEmailErr) {
          console.error("Failed to send admin notification email:", adminEmailErr);
        }
      }

      console.log("Order confirmation notifications processed");
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
      if (order.velocityAWB || order.velocityOrderId) {
        const courier = order.courierName || "Velocity";
        const trackingId = order.velocityAWB || order.velocityOrderId;
        const trackingLink = `https://shipfastt.in/track/${trackingId}`;
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
      } else if (order.shiprocketOrderId || order.trackingId) {
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
 * Fetches an image URL and converts it to Base64 format for jsPDF embedding.
 */
async function fetchBase64Image(
  url?: string
): Promise<{ data: string; format: string } | null> {
  if (!url || typeof url !== "string") return null;
  let fullUrl = url.trim();
  if (!fullUrl) return null;
  if (fullUrl.startsWith("/")) {
    fullUrl = `https://munch-tokri.web.app${fullUrl}`;
  }
  try {
    const res = await axios.get(fullUrl, {
      responseType: "arraybuffer",
      timeout: 6000,
      headers: {
        Accept: "image/*",
      },
    });
    const contentType = (res.headers["content-type"] as string) || "image/jpeg";
    const format = contentType.toLowerCase().includes("png") ? "PNG" : "JPEG";
    const base64 = Buffer.from(res.data).toString("base64");
    return {
      data: `data:${contentType};base64,${base64}`,
      format,
    };
  } catch (err) {
    console.warn(`Could not load image for PDF invoice from: ${fullUrl}`);
    return null;
  }
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

  // Pre-load all product and combo images concurrently
  const itemImages = await Promise.all(
    order.items.map(async (item: OrderItem) => {
      let url = item.imageURL;
      const cat = item.category?.toLowerCase();
      const isCombo = cat === "combos" || cat === "combo" || item.baseWeight === 1;

      // For combos, if image is missing, empty, or placeholder logo, resolve true combo image
      if (isCombo && (!url || url.includes("Logo") || url.startsWith("/"))) {
        // 1. Check included combo sub-products
        if (item.products && item.products.length > 0) {
          const firstWithImg = item.products.find((p: any) => p.imageURL || p.image);
          if (firstWithImg) {
            url = (firstWithImg as any).imageURL || (firstWithImg as any).image;
          }
        }
        // 2. Fetch from combos collection if productId is provided
        if ((!url || url.includes("Logo") || url.startsWith("/")) && item.productId) {
          try {
            const cleanId = item.productId.includes("_v_") ?
              item.productId.split("_v_")[0] :
              (item.productId.includes("_") ? item.productId.split("_")[0] : item.productId);
            const comboSnap = await admin.firestore().collection("combos").doc(cleanId).get();
            if (comboSnap.exists) {
              const comboData = comboSnap.data();
              url = comboData?.imageURL ||
                comboData?.imageURLs?.[0] ||
                comboData?.images?.[0] ||
                comboData?.products?.[0]?.imageURL ||
                comboData?.products?.[0]?.image ||
                url;
            }
          } catch (e) {
            // fallback gracefully
          }
        }
      }

      // For regular products, fallback to products collection if missing
      if (!isCombo && (!url || url.includes("Logo") || url.startsWith("/")) && item.productId) {
        try {
          const prodSnap = await admin.firestore().collection("products").doc(item.productId).get();
          if (prodSnap.exists) {
            const prodData = prodSnap.data();
            url = prodData?.imageURL || prodData?.imageURLs?.[0] || prodData?.images?.[0] || url;
          }
        } catch (e) {
          // fallback gracefully
        }
      }

      if (!url || url.trim() === "") {
        url = LOGO_URL;
      }

      return await fetchBase64Image(url);
    })
  );

  // Table
  const tableData = order.items.map((item: OrderItem) => {
    const cat = item.category?.toLowerCase();
    const isCombo = cat === "combos" || cat === "combo" || item.baseWeight === 1;
    const isCustomMix = cat === "custom mix" || item.category === "Custom Mix";

    // Quantity display (Units for combos, grams for everything else)
    const comboGrams = (item as any).grams || (item.products ? item.products.reduce((s: number, p: any) => s + (Number(p.grams) || 0), 0) : 0);
    const displayQty = isCombo && !isCustomMix ?
      `${item.quantity} Unit${item.quantity > 1 ? "s" : ""}${comboGrams > 0 ? ` (${comboGrams * item.quantity}g)` : ""}` :
      isCustomMix ? `${item.quantity}g` : `${item.quantity / (item.baseWeight || 100)} Units (${item.quantity}g)`;

    // Name display (Include sub-products for bundles)
    let displayName = item.name;
    if (item.variant && !displayName.includes(item.variant)) {
      displayName = `${displayName} (${item.variant})`;
    }
    if ((isCombo || isCustomMix) && item.products && item.products.length > 0) {
      const baseName = isCustomMix ? "Custom Mix" : displayName;
      const weightHeader = (!isCustomMix && comboGrams > 0) ? ` [${comboGrams}g/pack]` : "";
      const header = isCustomMix ? "Ingredients:" : `Pack of ${item.products.length}${weightHeader} includes:`;
      displayName = `${baseName}\n${header}\n` + item.products.map(
        (p: { name: string, grams: number }) => `  • ${p.name} (${p.grams}g)`
      ).join("\n");
    }

    // Unit Price string
    const unitPriceLabel = isCombo && !isCustomMix ? "/ Unit" : `/ ${(item.baseWeight || 100)}g`;
    const unitPrice = `Rs. ${item.price.toFixed(2)} ${unitPriceLabel}`;

    return [
      "", // Cell where image is rendered via didDrawCell
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
    styles: { fontSize: 9, cellPadding: 4, minCellHeight: 18, valign: "middle" },
    columnStyles: {
      0: { cellWidth: 22, halign: "center", valign: "middle" },
      1: { cellWidth: 78, valign: "middle" },
      2: { halign: "center", valign: "middle" },
      3: { halign: "center", valign: "middle" },
      4: { halign: "right", valign: "middle" },
    },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    didDrawCell: (data: any) => {
      if (data.section === "body" && data.column.index === 0) {
        const imgObj = itemImages[data.row.index];
        if (imgObj && imgObj.data) {
          try {
            const size = Math.min(data.cell.width - 4, data.cell.height - 4, 15);
            const x = data.cell.x + (data.cell.width - size) / 2;
            const y = data.cell.y + (data.cell.height - size) / 2;
            doc.addImage(imgObj.data, imgObj.format, x, y, size, size);
          } catch (err) {
            // graceful ignore
          }
        }
      }
    },
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

  const isCodOrder =
    Boolean(order.paymentDetails?.isCod) ||
    order.method?.payment?.includes("Cash on Delivery") ||
    order.method?.payment?.includes("COD");
  const advancePaid = Number(order.paymentDetails?.advancePaid) || 0;
  const codBalance = Number(order.paymentDetails?.codBalance) || 0;

  // Net Total
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Total Order Amount", 120, currentY);
  doc.text(`${displayAmount}`, pageWidth - 20, currentY, { align: "right" });
  currentY += 8;

  if (isCodOrder && advancePaid > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 163, 74); // green
    doc.text("20% Advance Paid Online (Razorpay)", 120, currentY);
    doc.text(`-Rs. ${advancePaid.toFixed(2)}`, pageWidth - 20, currentY, { align: "right" });
    currentY += 7;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(211, 47, 47); // red
    doc.text("Balance Due on Delivery (Cash to Courier)", 120, currentY);
    doc.text(`Rs. ${codBalance.toFixed(2)}`, pageWidth - 20, currentY, { align: "right" });
    currentY += 8;
    doc.setTextColor(0, 0, 0); // reset black
  }

  // Loyalty Points
  if (order.earnedPoints && order.earnedPoints > 0) {
    currentY += 2;
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
  doc.text("Payment & Delivery Details", 20, finalY + (isCodOrder && advancePaid > 0 ? 46 : 32));

  doc.autoTable({
    startY: finalY + (isCodOrder && advancePaid > 0 ? 50 : 36),
    margin: { left: 20, right: 20 },
    body: isCodOrder ?
      [
          ["Payment Method", "Cash on Delivery (20% Advance Paid)"],
          ["20% Advance Payment", `Rs. ${advancePaid.toFixed(2)} (Paid Online via Razorpay)`],
          ["Remaining Balance on Delivery", `Rs. ${codBalance.toFixed(2)} (To be collected by Courier)`],
          ["Delivery Courier", `${order.courierName || "Velocity Express"}${order.velocityAWB ? ` (AWB: ${order.velocityAWB})` : ""}`],
          ["Customer Contact", `${order.shippingDetails?.mobile || "N/A"}${order.customerEmail ? ` • ${order.customerEmail}` : ""}`],
        ] :
      [
          ["Payment Method", order.method?.payment || "Online Payment (Prepaid)"],
          ["Payment Status", "Paid in Full"],
          ["Delivery Courier", `${order.courierName || "Velocity Express"}${order.velocityAWB ? ` (AWB: ${order.velocityAWB})` : ""}`],
          ["Customer Contact", `${order.shippingDetails?.mobile || "N/A"}${order.customerEmail ? ` • ${order.customerEmail}` : ""}`],
        ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      1: { halign: "right", fontStyle: "bold" },
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
    const cat = item.category?.toLowerCase();
    const isCombo = cat === 'combos' || cat === 'combo' || item.baseWeight === 1;
    const isCustomMix = cat === 'custom mix' || item.category === 'Custom Mix';

    let imgSrc = item.imageURL;
    if (isCombo && (!imgSrc || imgSrc.includes('Logo') || imgSrc.startsWith('/'))) {
      if (item.products && item.products.length > 0) {
        const firstWithImg = item.products.find((p: any) => p.imageURL || p.image);
        if (firstWithImg) {
          imgSrc = (firstWithImg as any).imageURL || (firstWithImg as any).image;
        }
      }
    }
    if (!imgSrc || imgSrc.trim() === '') {
      imgSrc = LOGO_URL;
    }
    if (imgSrc.startsWith('/')) {
      imgSrc = `https://munch-tokri.web.app${imgSrc}`;
    }

    const comboGrams = (item as any).grams || (item.products ? item.products.reduce((s: number, p: any) => s + (Number(p.grams) || 0), 0) : 0);
    const displayQty = isCombo && !isCustomMix ?
      `${item.quantity} Unit${item.quantity > 1 ? "s" : ""}${comboGrams > 0 ? ` (${comboGrams * item.quantity}g)` : ""}` :
      isCustomMix ? `${item.quantity}g` : `${item.quantity / (item.baseWeight || 100)} Units (${item.quantity}g)`;

    const itemTitle = item.variant && !item.name.includes(item.variant) ? `${item.name} (${item.variant})` : item.name;
    let displayName = `<strong>${itemTitle}</strong>`;
    if ((isCombo || isCustomMix) && item.products && item.products.length > 0) {
      const baseName = isCustomMix ? "Custom Mix" : itemTitle;
      const weightHeader = (!isCustomMix && comboGrams > 0) ? ` • Total ${comboGrams}g` : "";
      const header = isCustomMix ? "Ingredients:" : `Pack of ${item.products.length}${weightHeader} includes:`;
      displayName = `
        <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">${baseName}</div>
        <div style="margin-top: 4px; padding: 6px 10px; background: #f0fdfa; border-left: 3px solid #0d9488; border-radius: 4px; text-align: left;">
          <div style="font-size: 11px; font-weight: 700; color: #0f766e; margin-bottom: 3px;">${header}</div>
          <div style="font-size: 11px; color: #334155; line-height: 1.5;">
            ${item.products.map((p: { name: string, grams: number }) => `<div style="margin-bottom: 2px;">• <strong>${p.name}</strong> (${p.grams}g)</div>`).join('')}
          </div>
        </div>
      `;
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
    "Total Order Amount</td>" +
    "<td align=\"right\" style=\"padding: 10px 0; " +
    "border-top: 1px solid #eee;\">" +
    `${displayAmount}</td>` +
    "</tr>" +
    `${(order.paymentDetails?.isCod || order.method?.payment?.includes("Cash on Delivery") || order.method?.payment?.includes("COD")) && (Number(order.paymentDetails?.advancePaid) || 0) > 0 ?
      "<tr>" +
      "<td style=\"padding: 6px 0; color: #16a34a; font-weight: bold;\">" +
      "20% Advance Paid Online (Razorpay)</td>" +
      "<td align=\"right\" style=\"padding: 6px 0; color: #16a34a; font-weight: bold;\">" +
      `- Rs. ${(Number(order.paymentDetails?.advancePaid) || 0).toFixed(2)}</td>` +
      "</tr>" +
      "<tr style=\"background: #fffbeb; font-weight: bold;\">" +
      "<td style=\"padding: 8px 10px; border-radius: 4px; color: #b45309; font-size: 15px;\">" +
      "Balance Due on Delivery (Cash to Courier)</td>" +
      "<td align=\"right\" style=\"padding: 8px 10px; border-radius: 4px; color: #b45309; font-size: 15px;\">" +
      `Rs. ${(Number(order.paymentDetails?.codBalance) || 0).toFixed(2)}</td>` +
      "</tr>" : ""}` +
    `${order.earnedPoints && order.earnedPoints > 0 ?
      "<tr>" +
      "<td colspan=\"2\" align=\"right\" style=\"padding-top: 10px; " +
      "color: #d32f2f; font-weight: bold;\">" +
      `🎉 You earned ${order.earnedPoints} Coins on this order!` +
      "</td>" +
      "</tr>" : ""}` +
    "</table>" +
    "<hr style=\"border: none; border-top: 1px solid #eee\">" +
    "<h3>Payment & Delivery Information</h3>" +
    "<table width=\"100%\" style=\"font-size: 14px; border-collapse: collapse;\">" +
    "<tr>" +
    "<td style=\"padding: 5px 0;\">Payment Method:</td>" +
    `<td align="right" style="padding: 5px 0;"><strong>${order.method?.payment || (order.paymentDetails?.isCod ? "Cash on Delivery (20% Advance Paid)" : "Online Payment")}</strong></td>` +
    "</tr>" +
    `${(order.paymentDetails?.isCod || order.method?.payment?.includes("Cash on Delivery")) ?
      "<tr>" +
      "<td style=\"padding: 5px 0; color: #16a34a;\">Advance Paid Online:</td>" +
      `<td align="right" style="padding: 5px 0; color: #16a34a; font-weight: bold;">Rs. ${(Number(order.paymentDetails?.advancePaid) || 0).toFixed(2)} (Paid via Razorpay)</td>` +
      "</tr>" +
      "<tr>" +
      "<td style=\"padding: 5px 0; color: #b45309;\">Balance on Delivery:</td>" +
      `<td align="right" style="padding: 5px 0; color: #b45309; font-weight: bold;">Rs. ${(Number(order.paymentDetails?.codBalance) || 0).toFixed(2)} (Cash to Courier)</td>` +
      "</tr>" :
      "<tr>" +
      "<td style=\"padding: 5px 0;\">Payment Status:</td>" +
      `<td align="right" style="padding: 5px 0; color: #16a34a; font-weight: bold;">${isPaid ? "Paid in Full" : "Pending"}</td>` +
      "</tr>"}` +
    "<tr>" +
    "<td style=\"padding: 5px 0;\">Delivery Courier:</td>" +
    `<td align="right" style="padding: 5px 0;"><strong>${order.courierName || "Velocity Express"}</strong></td>` +
    "</tr>" +
    `${order.velocityAWB ?
      "<tr>" +
      "<td style=\"padding: 5px 0;\">Velocity AWB Tracking:</td>" +
      `<td align="right" style="padding: 5px 0; color: #0f766e; font-weight: bold;">${order.velocityAWB}</td>` +
      "</tr>" : ""}` +
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
          <p style="margin: 5px 0 0;"><strong>Total Order Value:</strong>
            ${order.amount}</p>
          <p style="margin: 5px 0 0;"><strong>Payment Method:</strong>
            ${order.method?.payment || "N/A"}</p>
          ${(order.paymentDetails?.isCod || order.method?.payment?.includes("Cash on Delivery")) ? `
          <p style="margin: 5px 0 0; color: #16a34a;"><strong>20% Advance Paid Online:</strong>
            Rs. ${(Number(order.paymentDetails?.advancePaid) || 0).toFixed(2)} (via Razorpay)</p>
          <p style="margin: 5px 0 0; color: #b45309; font-weight: bold;"><strong>Balance to Collect on Delivery:</strong>
            Rs. ${(Number(order.paymentDetails?.codBalance) || 0).toFixed(2)} (Cash to Courier)</p>
          ` : `
          <p style="margin: 5px 0 0; color: #16a34a;"><strong>Payment Status:</strong> Paid in Full (Prepaid)</p>
          `}
          <p style="margin: 5px 0 0;"><strong>Phone:</strong>
            +91 ${order.shippingDetails?.mobile || "N/A"}</p>
          <p style="margin: 5px 0 0;"><strong>Delivery Address:</strong>
            ${order.shippingDetails?.address || ""}, ${order.shippingDetails?.city || ""}, ${order.shippingDetails?.state || ""} - ${order.shippingDetails?.pincode || ""}</p>
          ${order.velocityAWB ? `
          <p style="margin: 5px 0 0; color: #0f766e;"><strong>Velocity AWB:</strong> ${order.velocityAWB}</p>
          ` : ""}
        </div>
        <h3 style="color: #333; margin-top: 20px; font-size: 16px;">Items Ordered:</h3>
        <ul style="padding-left: 20px; margin: 10px 0;">
          ${order.items.map((item: any) => {
      const isCombo = item.category?.toLowerCase() === 'combos' || item.category?.toLowerCase() === 'combo' || item.baseWeight === 1;
      const isCustomMix = item.category?.toLowerCase() === 'custom mix' || item.category === 'Custom Mix';
      const comboGrams = (item as any).grams || (item.products ? item.products.reduce((s: number, p: any) => s + (Number(p.grams) || 0), 0) : 0);
      const qtyStr = isCombo && !isCustomMix ? `${item.quantity} Unit(s)${comboGrams > 0 ? ` (${comboGrams * item.quantity}g)` : ''}` : isCustomMix ? `${item.quantity}g` : `${item.quantity / (item.baseWeight || 100)} Units (${item.quantity}g)`;
      let subItemsHtml = '';
      if ((isCombo || isCustomMix) && item.products && item.products.length > 0) {
        const weightHeader = (!isCustomMix && comboGrams > 0) ? ` • Total ${comboGrams}g` : "";
        const header = isCustomMix ? 'Ingredients:' : `Pack of ${item.products.length}${weightHeader} includes:`;
        subItemsHtml = `
          <div style="margin-top: 4px; padding: 4px 8px; background: #f0fdfa; border-left: 2px solid #0d9488; font-size: 11px;">
            <div style="font-weight: 700; color: #0f766e; margin-bottom: 2px;">${header}</div>
            <div style="color: #334155; line-height: 1.4;">
              ${item.products.map((p: any) => `<div>• <strong>${p.name}</strong> (${p.grams}g)</div>`).join('')}
            </div>
          </div>
        `;
      }
      const itemTitle = item.variant && !item.name.includes(item.variant) ? `${item.name} (${item.variant})` : item.name;
      return `
            <li style="margin-bottom: 8px;">
              <strong>${itemTitle}</strong> x ${qtyStr}
              ${subItemsHtml}
            </li>
          `;
    }).join('')}
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
        order_items: order.items.map((item: OrderItem) => {
          const cat = item.category?.toLowerCase();
          const isCombo = cat === 'combos' || cat === 'combo' || item.baseWeight === 1;
          const isCustomMix = cat === 'custom mix' || item.category === 'Custom Mix';
          const units = (isCombo && !isCustomMix) ? item.quantity : Math.max(1, Math.floor(item.quantity / (item.baseWeight || 100)));
          return {
            name: item.name,
            sku: item.productId || item.name,
            units: units,
            selling_price: item.price / (isCustomMix ? 1 : units), // Estimate per unit
          };
        }),
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
 * HTTPS Callable function to create an order in Velocity.
 */
export const createVelocityOrder = onCall(
  { region: "asia-south1", invoker: "public" },
  async (request) => {
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
    if (order.velocityOrderId || order.velocityShipmentId) {
      console.log("Order already has a Velocity shipment, skipping creation.");
      return {
        order_id: order.velocityOrderId,
        shipment_id: order.velocityShipmentId,
        awb_code: order.velocityAWB,
        alreadyCreated: true,
      };
    }

    const token = velocityApiKey.value().trim();
    if (!token) {
        throw new HttpsError("internal", "Velocity API key not configured");
    }

    try {
      const orderAmount = parseFloat(order.amount.replace("₹", "").replace(",", ""));
      const isCod =
        order.method?.payment === "COD" ||
        order.method?.payment === "Cash on Delivery (COD)" ||
        order.method?.payment?.includes("Cash on Delivery") ||
        order.paymentDetails?.isCod === true ||
        String(order.paymentDetails?.method || "").toLowerCase().includes("cod");

      const codBalanceToCollect = order.paymentDetails?.codBalance != null ?
        Number(order.paymentDetails.codBalance) :
        (isCod ? Math.round(orderAmount * 0.8) : orderAmount);

      const advancePaid = Number(order.paymentDetails?.advancePaid || (isCod ? Math.round(orderAmount * 0.2) : 0));

      const cleanPhone = (order.shippingDetails?.mobile || "")
        .replace(/[^0-9]/g, "")
        .slice(-10) || order.shippingDetails?.mobile || "9999999999";

      const cleanEmail = (order.customerEmail && !order.customerEmail.includes("customer@munchtokri.com")) ?
        order.customerEmail :
        "sales@munchtokri.in";

      const codInstruction = isCod ?
        `COD Order: Collect Balance Rs. ${codBalanceToCollect.toFixed(2)} only (20% Advance Rs. ${advancePaid.toFixed(2)} paid online via Razorpay)` :
        `Prepaid Order: Fully Paid Online (Rs. ${orderAmount.toFixed(2)})`;

      const velocityOrder = {
        order_id: order.orderNumber || orderId,
        order_date: new Date().toISOString().slice(0, 16).replace("T", " "),
        carrier_id: "",
        billing_customer_name: order.customerName.split(" ")[0] || "Customer",
        billing_last_name: order.customerName.split(" ").slice(1).join(" ") || "Name",
        billing_address: order.shippingDetails.address.length < 10 ?
          `${order.shippingDetails.address} - Address Details` :
          order.shippingDetails.address,
        billing_city: order.shippingDetails.city,
        billing_pincode: order.shippingDetails.pincode,
        billing_state: order.shippingDetails.state,
        billing_country: "India",
        billing_email: cleanEmail,
        billing_phone: cleanPhone,
        comment: codInstruction,
        customer_note: codInstruction,
        shipping_is_billing: true,
        print_label: true,
        order_items: order.items.map((item: OrderItem) => {
          const cat = item.category?.toLowerCase();
          const isCombo = cat === 'combos' || cat === 'combo' || item.baseWeight === 1;
          const isCustomMix = cat === 'custom mix' || item.category === 'Custom Mix';
          const units = (isCombo && !isCustomMix) ? item.quantity : Math.max(1, Math.floor(item.quantity / (item.baseWeight || 100)));
          return {
            name: item.name,
            sku: item.productId || item.name,
            units: units,
            selling_price: item.price / (isCustomMix ? 1 : units), // Estimate per unit
            discount: 0,
            tax: 0
          };
        }),
        payment_method: isCod ? "COD" : "PREPAID",
        sub_total: orderAmount,
        cod_collectible: isCod ? Math.round(codBalanceToCollect) : 0,
        length: 10,
        breadth: 10,
        height: 10,
        weight: 0.5,
        warehouse_id: velocityWarehouseId.value().trim()
      };

      console.log("Requesting Velocity order creation...");
      const response = await axios.post(
        "https://shazam.velocity.in/custom/api/v1/forward-order-orchestration",
        velocityOrder,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": token,
          },
        }
      );

      console.log("Velocity Response:", response.data);

      if (response.data.status !== 1 && response.data.status !== "SUCCESS" && !response.data.payload) {
         throw new Error(JSON.stringify(response.data));
      }

      const payload = response.data.payload;
      const shipmentData = {
        order_id: payload.order_id,
        shipment_id: payload.shipment_id,
        awb_code: payload.awb_code
      };

      await orderRef.update({
        velocityOrderId: shipmentData.order_id,
        velocityShipmentId: shipmentData.shipment_id,
        velocityAWB: shipmentData.awb_code,
        status: "Dispatched",
      });

      return shipmentData;
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string } | any },
        message?: string
      };
      console.error("Velocity Order Error:",
        JSON.stringify(error.response?.data || error.message, null, 2));
      throw new HttpsError("internal",
        error.response?.data?.message || "Failed to create Velocity order");
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

      const passedAmountInPaise = Math.round(Number(amount) * 100);
      const isCodOrder = request.data.isCod === true || request.data.notes?.isCod === "true";
      const totalOrderAmount = Number(request.data.totalOrderAmount) || Number(amount);
      const advancePaid = isCodOrder ? Number(amount) : totalOrderAmount;
      const codBalance = isCodOrder ? (Number(request.data.codBalance) || Math.max(0, totalOrderAmount - advancePaid)) : 0;

      const itemsList = Array.isArray(request.data.items) ? request.data.items : [];
      let lineItems: any[] = [];
      let lineItemsTotal = 0;
      let finalAmountInPaise = passedAmountInPaise;

      if (itemsList.length === 0) {
        finalAmountInPaise = passedAmountInPaise > 0 ? passedAmountInPaise : 100;
        lineItems = [{
          sku: isCodOrder ? "cod_advance_20" : "snack_order",
          name: isCodOrder ? "20% Advance Payment for COD Order" : "Snack Order",
          description: `Total Order: ₹${totalOrderAmount.toFixed(2)}${isCodOrder ? ` | Balance ₹${codBalance.toFixed(2)} on delivery` : ""}`,
          price: finalAmountInPaise,
          offer_price: finalAmountInPaise,
          quantity: 1,
          type: "physical",
          image_url: "https://munchtokri.com/logo.png",
        }];
        lineItemsTotal = finalAmountInPaise;
      } else {
        lineItems = itemsList.map((item: any, idx: number) => {
          const isCombo = item.category === "Combos" || item.baseWeight === 1;
          const baseWeight = Number(item.baseWeight) || 100;
          const qty = Number(item.quantity) || 1;
          const price = Number(item.price) || 0;

          let itemTotalPaise = 0;
          let displayQty = 1;
          let itemDesc = "Authentic Karnataka snack";

          if (isCombo) {
            displayQty = Math.max(1, Math.round(qty));
            const unitPricePaise = Math.round(price * 100);
            itemTotalPaise = unitPricePaise * displayQty;
            itemDesc = item.variant || `${displayQty} unit(s)`;
          } else {
            // Regular snack where quantity is in grams
            const totalRupees = (price / baseWeight) * qty;
            itemTotalPaise = Math.round(totalRupees * 100);
            displayQty = 1;
            itemDesc = item.variant ? `${item.variant} (${qty}g)` : `${qty}g pack`;
          }

          let calculatedPrice = displayQty > 0 ? Math.round(itemTotalPaise / displayQty) : itemTotalPaise;
          if (calculatedPrice <= 0 && passedAmountInPaise > 0) {
            calculatedPrice = passedAmountInPaise;
          }
          const unitPriceInPaise = Math.max(100, calculatedPrice);
          const itemName = String(item.name || `Snack Item ${idx + 1}`).trim();

          const rawImg = item.imageURL || item.imageUrl || "";
          const imgUrl = rawImg.startsWith("http") ?
            rawImg :
            (rawImg.startsWith("/") ? `https://munchtokri.com${rawImg}` : "https://munchtokri.com/logo.png");

          return {
            sku: String(item.productId || item.id || `item_${idx + 1}`),
            name: itemName,
            description: itemDesc,
            price: unitPriceInPaise,
            offer_price: unitPriceInPaise,
            quantity: displayQty,
            type: "physical",
            image_url: imgUrl,
          };
        });

        lineItemsTotal = lineItems.reduce((acc: number, it: any) => acc + (it.price * it.quantity), 0);
        finalAmountInPaise = lineItemsTotal > 0 ? lineItemsTotal : (passedAmountInPaise > 0 ? passedAmountInPaise : 100);
      }

      const options: any = {
        amount: finalAmountInPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now().toString().slice(-8)}`,
        notes: {
          userId: String(request.data.userId || request.auth?.uid || ""),
          source: "magic_checkout",
          one_click_checkout: "true",
          isCod: isCodOrder ? "true" : "false",
          advancePaid: String(advancePaid),
          codBalance: String(codBalance),
          totalOrderAmount: String(totalOrderAmount),
          ...(request.data.notes || {}),
        },
      };

      if (lineItems.length > 0) {
        options.line_items_total = lineItemsTotal;
        options.line_items = lineItems;
      }

      console.log("Creating Razorpay Magic order with options:", JSON.stringify(options));
      const order = await razorpay.orders.create(options);
      console.log("Razorpay Magic order created successfully:", order.id);
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
 * Core order persistence handler for Razorpay Magic Checkout orders.
 * Shared between client callable verifyAndSaveMagicOrder and server webhook.
 */
async function saveMagicOrderToFirestore(params: {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  clientItems?: any[];
  userId?: string;
  clientShippingDetails?: any;
  verifySignature?: boolean;
  paymentMethod?: string;
  isCod?: boolean;
}): Promise<{ success: boolean; orderNumber: string; orderId: string; isExisting?: boolean }> {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    clientItems,
    userId,
    clientShippingDetails,
    verifySignature = false,
    paymentMethod: clientPaymentMethod,
    isCod: clientIsCod
  } = params;

  try {
    const keyId = razorpayKeyId.value() || process.env.RAZORPAY_KEY_ID || "";
    const keySecret = razorpayKeySecret.value() || process.env.RAZORPAY_KEY_SECRET || "";

    if (!keyId || !keySecret) {
      console.error("Razorpay API credentials missing in Cloud Functions environment");
      throw new HttpsError("failed-precondition", "Payment gateway credentials missing");
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // 1. Fetch Razorpay Order from server
    let rzpOrder: any = null;
    try {
      rzpOrder = await razorpay.orders.fetch(razorpayOrderId);
      console.log(`Fetched Razorpay Order ${rzpOrder.id}, status: ${rzpOrder.status}`);
    } catch (e: any) {
      console.warn("Failed to fetch Razorpay order details from API:", e.message);
      rzpOrder = { id: razorpayOrderId, amount: 0, status: "created" };
    }

    // 2. Fetch payments for this order
    let payments: any = { items: [] };
    try {
      payments = await razorpay.orders.fetchPayments(razorpayOrderId);
    } catch (e: any) {
      console.warn("Could not fetch payments for order:", e.message);
    }

    const primaryPayment = payments.items && payments.items.length > 0 ? payments.items[0] : null;
    const isCod = Boolean(
      clientIsCod ||
      clientPaymentMethod?.toLowerCase() === "cod" ||
      primaryPayment?.method?.toLowerCase() === "cod" ||
      razorpayPaymentId?.toLowerCase().includes("cod") ||
      (!razorpayPaymentId && (!payments.items || payments.items.length === 0)) ||
      rzpOrder?.notes?.payment_method?.toLowerCase() === "cod" ||
      rzpOrder?.notes?.cod === "true"
    );
    const paymentMethod = isCod ? "cod" : (primaryPayment?.method || clientPaymentMethod || "online");

    // 3. Verify signature for prepaid payments if requested
    if (verifySignature && !isCod && razorpayPaymentId && razorpaySignature) {
      try {
        const body = `${razorpayOrderId}|${razorpayPaymentId}`;
        const expectedSignature = crypto
          .createHmac("sha256", keySecret)
          .update(body)
          .digest("hex");

        if (expectedSignature !== razorpaySignature) {
          console.warn(`Payment signature mismatch! Received: ${razorpaySignature}, expected: ${expectedSignature}`);
          // If Razorpay server itself confirms order is paid or payment is captured, accept it
          const isPaidOnServer = rzpOrder.status === "paid" || primaryPayment?.status === "captured";
          if (!isPaidOnServer) {
            throw new HttpsError("permission-denied", "Invalid payment signature");
          }
        }
      } catch (sigErr: any) {
        if (sigErr instanceof HttpsError) throw sigErr;
        console.warn("Signature check fallback warning:", sigErr.message);
      }
    }

    // 4. Retrieve cached Magic Checkout session from Firestore if available
    const db = admin.firestore();
    let sessionData: any = null;
    try {
      const sessionDoc = await db.collection("magic_checkout_sessions").doc(razorpayOrderId).get();
      if (sessionDoc.exists) {
        sessionData = sessionDoc.data();
        console.log("Retrieved cached Magic Checkout session:", sessionData);
      }
    } catch (sessionErr: any) {
      console.warn("Could not retrieve magic checkout session:", sessionErr.message);
    }

    // 5. Extract customer details & shipping address from all available sources
    const rzpCustomer = rzpOrder.customer_details || {};
    const rzpShipping = rzpOrder.shipping_address || rzpCustomer.shipping_address || {};

    const rawCustName =
      (clientShippingDetails?.fullName && clientShippingDetails.fullName !== "Customer" ? clientShippingDetails.fullName : "") ||
      (sessionData?.customerName && sessionData.customerName !== "Customer" ? sessionData.customerName : "") ||
      (rzpCustomer.name && rzpCustomer.name !== "Customer" ? rzpCustomer.name : "") ||
      (rzpShipping.name && rzpShipping.name !== "Customer" ? rzpShipping.name : "") ||
      (primaryPayment?.notes?.name && primaryPayment.notes.name !== "Customer" ? primaryPayment.notes.name : "") ||
      (primaryPayment?.card?.name && primaryPayment.card.name !== "Customer" ? primaryPayment.card.name : "") ||
      "";
    const customerName = rawCustName.trim() || "Customer";

    const rawMobile =
      (clientShippingDetails?.mobile && clientShippingDetails.mobile !== "N/A" ? clientShippingDetails.mobile : "") ||
      (sessionData?.mobile && sessionData.mobile !== "N/A" ? sessionData.mobile : "") ||
      primaryPayment?.contact ||
      rzpCustomer.contact ||
      rzpShipping.contact ||
      "";
    const mobile = rawMobile.trim() || "N/A";

    const rawEmail =
      (clientShippingDetails?.email && clientShippingDetails.email !== "customer@munchtokri.com" ? clientShippingDetails.email : "") ||
      (sessionData?.email && sessionData.email !== "customer@munchtokri.com" ? sessionData.email : "") ||
      primaryPayment?.email ||
      rzpCustomer.email ||
      rzpShipping.email ||
      "";
    const customerEmail = rawEmail.trim() || "customer@munchtokri.com";

    const rzpShippingLines = [rzpShipping.line1, rzpShipping.line2, rzpShipping.landmark].filter(Boolean).join(", ");
    const rawAddress =
      (clientShippingDetails?.address && clientShippingDetails.address !== "Standard Delivery Address" && clientShippingDetails.address !== "Razorpay Magic Checkout Delivery" ? clientShippingDetails.address : "") ||
      (sessionData?.addressLine && sessionData.addressLine !== "Standard Delivery Address" && sessionData.addressLine !== "Razorpay Magic Checkout Delivery" ? sessionData.addressLine : "") ||
      rzpShippingLines ||
      rzpShipping.address ||
      "";
    const addressLine = rawAddress.trim() || "Standard Delivery Address";

    const rawCity =
      clientShippingDetails?.city ||
      sessionData?.city ||
      rzpShipping.city ||
      rzpCustomer.city ||
      "";
    const city = rawCity.trim() || "Bengaluru";

    const rawState =
      clientShippingDetails?.state ||
      sessionData?.state ||
      rzpShipping.state ||
      rzpCustomer.state ||
      "";
    const state = rawState.trim() || "Karnataka";

    const rawPincode =
      clientShippingDetails?.pincode ||
      sessionData?.pincode ||
      rzpShipping.zipcode ||
      rzpShipping.pincode ||
      rzpShipping.postal_code ||
      rzpCustomer.pincode ||
      "";
    const pincode = rawPincode.trim() || "560001";

    console.log("Resolved Magic Checkout customer information:", {
      razorpayOrderId,
      customerName,
      mobile,
      customerEmail,
      addressLine,
      city,
      state,
      pincode
    });

    // 6. Idempotency Check: check if order is already saved
    const existingOrders = await db.collection("orders")
      .where("paymentDetails.razorpayOrderId", "==", razorpayOrderId)
      .limit(1)
      .get();

    if (!existingOrders.empty) {
      const existingDoc = existingOrders.docs[0];
      const existingData = existingDoc.data();
      console.log("Order already exists for this Razorpay Order ID:", existingData.orderNumber);

      // Backfill placeholder details if we now have real details
      const updateData: any = {};
      if (customerName !== "Customer" && existingData.customerName === "Customer") {
        updateData.customerName = customerName;
      }
      if (customerEmail !== "customer@munchtokri.com" && existingData.customerEmail === "customer@munchtokri.com") {
        updateData.customerEmail = customerEmail;
      }
      if (mobile !== "N/A" && (!existingData.shippingDetails?.mobile || existingData.shippingDetails?.mobile === "N/A")) {
        updateData["shippingDetails.mobile"] = mobile;
      }
      if (addressLine !== "Standard Delivery Address" &&
          (!existingData.shippingDetails?.address ||
           existingData.shippingDetails?.address === "Standard Delivery Address" ||
           existingData.shippingDetails?.address === "Razorpay Magic Checkout Delivery")) {
        updateData["shippingDetails.address"] = addressLine;
      }
      if (city && city !== "Bengaluru" && existingData.shippingDetails?.city === "Bengaluru") {
        updateData["shippingDetails.city"] = city;
      }
      if (state && state !== "Karnataka" && existingData.shippingDetails?.state === "Karnataka") {
        updateData["shippingDetails.state"] = state;
      }
      if (pincode && pincode !== "560001" && existingData.shippingDetails?.pincode === "560001") {
        updateData["shippingDetails.pincode"] = pincode;
      }

      if (Object.keys(updateData).length > 0) {
        await existingDoc.ref.update(updateData);
        console.log("Updated placeholder details on existing order:", existingData.orderNumber, updateData);
      }

      return {
        success: true,
        orderId: existingDoc.id,
        orderNumber: existingData.orderNumber,
        isExisting: true
      };
    }

    // Resolve items
    let finalItems: any[] = [];
    if (Array.isArray(clientItems) && clientItems.length > 0) {
      finalItems = clientItems.map((it: any) => ({
        name: String(it.name || "Snack Item"),
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
        baseWeight: Number(it.baseWeight) || (it.category === "Combos" ? 1 : 100),
        category: String(it.category || "Snacks"),
        productId: String(it.productId || it.id || ""),
        imageURL: String(it.imageURL || "/Logo Munch Tokri.png"),
        variant: it.variant ? String(it.variant) : null,
        grams: it.grams ? Number(it.grams) : null,
      }));
    } else if (Array.isArray(rzpOrder.line_items) && rzpOrder.line_items.length > 0) {
      finalItems = rzpOrder.line_items.map((li: any) => ({
        name: String(li.name || "Snack Item"),
        price: li.amount ? Number(li.amount) / 100 : 0,
        quantity: Number(li.quantity) || 1,
        baseWeight: 1,
        category: "Snacks",
        productId: String(li.sku || "snack_order"),
        imageURL: String(li.image_url || "/Logo Munch Tokri.png"),
        variant: null,
        grams: null,
      }));
    } else {
      const fallbackAmount = Number(rzpOrder.amount) > 0 ? Number(rzpOrder.amount) / 100 : 0;
      finalItems = [{
        name: "Munch Tokri Order",
        price: fallbackAmount,
        quantity: 1,
        baseWeight: 1,
        category: "Snacks",
        productId: "snack_order",
        imageURL: "/Logo Munch Tokri.png",
        variant: null,
        grams: null,
      }];
    }

    // 6. Generate order number atomically via metadata/counters
    const counterRef = db.collection("metadata").doc("counters");
    let newOrderNumber = "";
    let newOrderId = "";

    await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const currentCount = counterDoc.exists ?
        (counterDoc.data()?.orderCount as number) || 10000 :
        10000;
      const nextCount = currentCount + 1;
      newOrderNumber = `MT-${nextCount}`;

      transaction.set(counterRef, { orderCount: nextCount }, { merge: true });

      const newOrderRef = db.collection("orders").doc();
      newOrderId = newOrderRef.id;

      const isCodOrder = Boolean(
        isCod ||
        rzpOrder.notes?.isCod === "true" ||
        rzpOrder.notes?.payment_method?.toLowerCase() === "cod"
      );
      const totalAmountFromNotes = Number(rzpOrder.notes?.totalOrderAmount);
      const advancePaid = Number(rzpOrder.notes?.advancePaid) || (isCodOrder ? Number(rzpOrder.amount) / 100 : 0);
      const orderTotalRupees = totalAmountFromNotes > 0 ? totalAmountFromNotes : (
        Number(rzpOrder.amount) > 0 ? Number(rzpOrder.amount) / 100 :
        finalItems.reduce((sum: number, it: any) => sum + (it.price / (it.baseWeight || 100)) * it.quantity, 0)
      );
      const codBalance = isCodOrder ? (Number(rzpOrder.notes?.codBalance) || Math.max(0, orderTotalRupees - advancePaid)) : 0;
      const orderTotalStr = `₹${orderTotalRupees.toFixed(2)}`;

      const orderData: any = {
        orderNumber: newOrderNumber,
        customerName: customerName || "Customer",
        customerEmail: customerEmail || "customer@munchtokri.com",
        status: "Processing",
        amount: orderTotalStr,
        date: admin.firestore.FieldValue.serverTimestamp(),
        items: finalItems,
        shippingDetails: {
          mobile: mobile || "N/A",
          address: addressLine,
          city: city,
          state: state,
          pincode: pincode,
        },
        method: {
          payment: isCodOrder ? "Cash on Delivery (20% Advance Paid)" : "Razorpay Magic Checkout",
          delivery: "Standard Delivery",
        },
        paymentDetails: {
          razorpayOrderId: razorpayOrderId || "",
          razorpayPaymentId: razorpayPaymentId || (isCodOrder ? `cod_${razorpayOrderId}` : primaryPayment?.id || ""),
          razorpaySignature: razorpaySignature || "",
          method: isCodOrder ? "cod" : (paymentMethod || "online"),
          isCod: isCodOrder,
          advancePaid: isCodOrder ? advancePaid : orderTotalRupees,
          codBalance: isCodOrder ? codBalance : 0,
          isMagicCheckout: true,
        },
      };

      const resolvedUserId = userId || rzpOrder.notes?.userId;
      if (resolvedUserId) {
        orderData.userId = resolvedUserId;
      }

      transaction.set(newOrderRef, orderData);

      // Update sales count on items
      for (const item of finalItems) {
        const isCombo = item.category === "Combos";
        const isProduct = !isCombo && item.category !== "Custom Mix";
        if (isProduct || isCombo) {
          const colName = isCombo ? "combos" : "products";
          let targetId = item.productId || item.id || "";
          if (targetId.includes("_v_")) targetId = targetId.split("_v_")[0];
          else if (isCombo && targetId.includes("_")) targetId = targetId.split("_")[0];
          if (targetId && targetId !== "snack_order") {
            const itemRef = db.collection(colName).doc(targetId);
            transaction.set(itemRef, {
              salesCount: admin.firestore.FieldValue.increment(item.quantity || 1)
            }, { merge: true });
          }
        }
      }
    });

    console.log(`Successfully created Magic Checkout Order: ${newOrderNumber} (${newOrderId})`);
    return {
      success: true,
      orderNumber: newOrderNumber,
      orderId: newOrderId,
    };
  } catch (err: any) {
    console.error("Critical error in saveMagicOrderToFirestore:", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err.message || "Failed to process and save order");
  }
}

/**
 * Verifies Razorpay Magic Checkout payment and saves the order to Firestore.
 * Supports both prepaid and Cash on Delivery (COD) placed inside Magic Checkout.
 */
export const verifyAndSaveMagicOrder = onCall(
  { region: "asia-south1", invoker: "public", secrets: [razorpayKeySecret] },
  async (request) => {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      items: clientItems,
      userId,
      shippingDetails: clientShippingDetails
    } = request.data;

    if (!razorpayOrderId) {
      throw new HttpsError("invalid-argument", "razorpayOrderId is required");
    }

    return await saveMagicOrderToFirestore({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      clientItems,
      userId: userId || request.auth?.uid,
      clientShippingDetails,
      paymentMethod: request.data.paymentMethod,
      isCod: Boolean(request.data.isCod),
      verifySignature: !request.data.isCod
    });
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
      const { userId, planId } = req.body;

      if (!userId) {
        res.status(400).send({ error: "User ID is required" });
        return;
      }

      const razorpay = new Razorpay({
        key_id: razorpayKeyId.value(),
        key_secret: razorpayKeySecret.value(),
      });

      const subscription = await razorpay.subscriptions.create({
        plan_id: planId || "plan_SXKsy3aNPYhIEh",
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
      } else if (
        event.event === "order.paid" ||
        event.event === "payment.captured" ||
        event.event === "order.placed" ||
        event.event === "payment.pending"
      ) {
        const rzpOrderId =
          event.payload?.order?.entity?.id ||
          event.payload?.payment?.entity?.order_id;
        const rzpPayment = event.payload?.payment?.entity;
        const rzpPaymentId = rzpPayment?.id;
        const isWebhookCod =
          event.event === "order.placed" ||
          event.event === "payment.pending" ||
          rzpPayment?.method?.toLowerCase() === "cod" ||
          rzpPayment?.method?.toLowerCase().includes("cash");

        if (rzpOrderId) {
          console.log(`Razorpay Webhook: Processing ${event.event} for order ${rzpOrderId} (isCod: ${isWebhookCod})`);
          await saveMagicOrderToFirestore({
            razorpayOrderId: rzpOrderId,
            razorpayPaymentId: rzpPaymentId || (isWebhookCod ? `cod_${rzpOrderId}` : undefined),
            verifySignature: false,
            paymentMethod: isWebhookCod ? "cod" : (rzpPayment?.method || "online"),
            isCod: isWebhookCod,
          });
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

/**
 * Razorpay Magic Checkout: Get Promotions
 * Returns all active promotions/coupons formatted for Magic Checkout modal.
 */
export const magicCheckoutPromotions = onRequest(
  { region: "asia-south1", invoker: "public" },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const now = Date.now();
      const couponsSnap = await admin.firestore().collection("coupons")
        .where("status", "==", "active")
        .get();

      const promotions: Array<{
        reference_id: string;
        type: string;
        code: string;
        value: number;
        value_type: string;
        summary: string;
        description: string;
      }> = [];

      couponsSnap.forEach((doc) => {
        const data = doc.data();

        // Check expiry
        if (data.expiryDate) {
          const expiryMillis = data.expiryDate.toMillis ?
            data.expiryDate.toMillis() :
            new Date(data.expiryDate).getTime();
          if (now > expiryMillis) {
            return;
          }
        }

        // Check max uses limit
        if (data.maxUses && (data.usedCount || 0) >= data.maxUses) {
          return;
        }

        const isPercentage = data.discountType === "percentage";
        const code = (data.code || doc.id).toUpperCase();
        const discountVal = Number(data.discountValue) || 0;
        const minOrder = Number(data.minOrderValue) || 0;
        const maxDiscount = Number(data.maxDiscount) || 0;

        promotions.push({
          reference_id: doc.id,
          type: "offer",
          code: code,
          value: isPercentage ? discountVal : discountVal * 100,
          value_type: isPercentage ? "percentage" : "fixed_amount",
          summary: isPercentage ? `${discountVal}% OFF` : `₹${discountVal} OFF`,
          description: `Min cart value ₹${minOrder}${maxDiscount > 0 ? `, up to ₹${maxDiscount} off` : ""}`,
        });
      });

      res.status(200).json({ promotions });
    } catch (error: unknown) {
      const e = error as Error;
      console.error("Magic Checkout Promotions Error:", e);
      res.status(500).json({ error: e.message || "Failed to fetch promotions" });
    }
  }
);

/**
 * Razorpay Magic Checkout: Apply Promotion
 * Validates and calculates discount for coupon selected/typed by customer.
 */
export const magicCheckoutApplyPromotion = onRequest(
  { region: "asia-south1", invoker: "public" },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const body = req.body || {};
      const code = (body.code || req.query.code || "").toString().trim().toUpperCase();

      if (!code) {
        res.status(200).json({
          failure_code: "INVALID_CODE",
          failure_reason: "Coupon code is required.",
        });
        return;
      }

      // Look up coupon by document ID or by code field
      let couponDoc = await admin.firestore().collection("coupons").doc(code).get();
      if (!couponDoc.exists) {
        const querySnap = await admin.firestore().collection("coupons")
          .where("code", "==", code)
          .limit(1)
          .get();
        if (!querySnap.empty) {
          couponDoc = querySnap.docs[0];
        }
      }

      if (!couponDoc.exists) {
        res.status(200).json({
          failure_code: "INVALID_CODE",
          failure_reason: "The coupon code you entered is invalid.",
        });
        return;
      }

      const data = couponDoc.data();
      if (!data) {
        res.status(200).json({
          failure_code: "INVALID_CODE",
          failure_reason: "Coupon data could not be loaded.",
        });
        return;
      }

      // Status check
      if (data.status !== "active") {
        res.status(200).json({
          failure_code: "INACTIVE_COUPON",
          failure_reason: "This coupon is no longer active.",
        });
        return;
      }

      // Expiry check
      if (data.expiryDate) {
        const expiryMillis = data.expiryDate.toMillis ?
          data.expiryDate.toMillis() :
          new Date(data.expiryDate).getTime();
        if (Date.now() > expiryMillis) {
          res.status(200).json({
            failure_code: "COUPON_EXPIRED",
            failure_reason: "This coupon has expired.",
          });
          return;
        }
      }

      // Max uses check
      if (data.maxUses && (data.usedCount || 0) >= data.maxUses) {
        res.status(200).json({
          failure_code: "USAGE_LIMIT_EXCEEDED",
          failure_reason: "This coupon usage limit has been reached.",
        });
        return;
      }

      // Minimum order check (if cart_total or line_items provided)
      let cartTotalInPaise = Number(body.cart?.cart_total || body.cart_total || 0);
      if (!cartTotalInPaise && Array.isArray(body.cart?.line_items)) {
        cartTotalInPaise = body.cart.line_items.reduce((acc: number, it: any) => {
          return acc + (Number(it.offer_price || it.price || 0) * Number(it.quantity || 1));
        }, 0);
      }
      const cartAmountInRupees = cartTotalInPaise > 0 ? cartTotalInPaise / 100 : 0;

      const minOrder = Number(data.minOrderValue) || 0;
      if (cartAmountInRupees > 0 && minOrder > 0 && cartAmountInRupees < minOrder) {
        res.status(200).json({
          failure_code: "MIN_ORDER_NOT_MET",
          failure_reason: `Minimum cart value of ₹${minOrder} is required.`,
        });
        return;
      }

      const isPercentage = data.discountType === "percentage";
      const discountVal = Number(data.discountValue) || 0;
      const maxDiscount = Number(data.maxDiscount) || 0;

      let calculatedValue = isPercentage ? discountVal : discountVal * 100;
      let valueType = isPercentage ? "percentage" : "fixed_amount";

      // If cart total was provided, calculate exact amount in paise
      if (isPercentage && cartAmountInRupees > 0) {
        let discountInRupees = (cartAmountInRupees * discountVal) / 100;
        if (maxDiscount > 0) {
          discountInRupees = Math.min(discountInRupees, maxDiscount);
        }
        calculatedValue = Math.round(discountInRupees * 100);
        valueType = "fixed_amount";
      }

      res.status(200).json({
        promotion: {
          reference_id: couponDoc.id,
          type: "offer",
          code: code,
          value: calculatedValue,
          value_type: valueType,
          description: isPercentage ?
            `${discountVal}% discount applied!` :
            `₹${discountVal} discount applied!`,
        },
      });
    } catch (error: unknown) {
      const e = error as Error;
      console.error("Magic Checkout Apply Promotion Error:", e);
      res.status(500).json({
        failure_code: "SERVER_ERROR",
        failure_reason: e.message || "Failed to process coupon.",
      });
    }
  }
);

/**
 * Razorpay Magic Checkout: Shipping Info API
 * Evaluates delivery address, serviceability, shipping methods, and fees.
 */
export const magicCheckoutShippingInfo = onRequest(
  { region: "asia-south1", invoker: "public" },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const db = admin.firestore();
      const body = req.body || {};
      const orderId = body.order_id || body.orderId || "";
      const rawAddress =
        body.delivery_address ||
        body.shipping_address ||
        (Array.isArray(body.addresses) && body.addresses.length > 0 ? body.addresses[0] : null) ||
        body.address ||
        {};
      const rawCustomer = body.customer || {};

      const fName = rawAddress.first_name || rawCustomer.first_name || "";
      const lName = rawAddress.last_name || rawCustomer.last_name || "";
      const combinedName = [fName, lName].filter(Boolean).join(" ");
      const customerName =
        rawAddress.name ||
        combinedName ||
        rawCustomer.name ||
        "";

      const mobile =
        rawAddress.contact ||
        rawAddress.phone ||
        rawCustomer.contact ||
        rawCustomer.phone ||
        "";

      const email =
        rawCustomer.email ||
        rawAddress.email ||
        "";

      const addressLine =
        [rawAddress.line1, rawAddress.line2, rawAddress.landmark].filter(Boolean).join(", ") ||
        rawAddress.address ||
        "";

      const city = rawAddress.city || "";
      const state = rawAddress.state || rawAddress.state_code || "";
      const pincode = rawAddress.zipcode || rawAddress.pincode || rawAddress.postal_code || "";
      const country = (rawAddress.country || "IN").toUpperCase();

      console.log("Magic Checkout Shipping Info received for order:", {
        orderId,
        customerName,
        mobile,
        email,
        addressLine,
        city,
        state,
        pincode,
        country
      });

      // Persist session if orderId is available
      if (orderId) {
        try {
          await db.collection("magic_checkout_sessions").doc(orderId).set({
            orderId,
            customerName: customerName || null,
            mobile: mobile || null,
            email: email || null,
            addressLine: addressLine || null,
            city: city || null,
            state: state || null,
            pincode: pincode || null,
            country: country || "IN",
            rawAddress,
            rawCustomer,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          // Also check if order was already saved previously with placeholders, and update it
          const existingOrderSnap = await db.collection("orders")
            .where("paymentDetails.razorpayOrderId", "==", orderId)
            .limit(1)
            .get();

          if (!existingOrderSnap.empty) {
            const existingDoc = existingOrderSnap.docs[0];
            const existing = existingDoc.data();
            const updatePayload: any = {};
            if (customerName && existing.customerName === "Customer") {
              updatePayload.customerName = customerName;
            }
            if (email && existing.customerEmail === "customer@munchtokri.com") {
              updatePayload.customerEmail = email;
            }
            if (mobile && (!existing.shippingDetails?.mobile || existing.shippingDetails?.mobile === "N/A")) {
              updatePayload["shippingDetails.mobile"] = mobile;
            }
            if (addressLine && (!existing.shippingDetails?.address || existing.shippingDetails?.address === "Standard Delivery Address" || existing.shippingDetails?.address === "Razorpay Magic Checkout Delivery")) {
              updatePayload["shippingDetails.address"] = addressLine;
            }
            if (city && existing.shippingDetails?.city === "Bengaluru" && city !== "Bengaluru") {
              updatePayload["shippingDetails.city"] = city;
            }
            if (state && existing.shippingDetails?.state === "Karnataka" && state !== "Karnataka") {
              updatePayload["shippingDetails.state"] = state;
            }
            if (pincode && existing.shippingDetails?.pincode === "560001" && pincode !== "560001") {
              updatePayload["shippingDetails.pincode"] = pincode;
            }

            if (Object.keys(updatePayload).length > 0) {
              await existingDoc.ref.update(updatePayload);
              console.log("Updated existing order with Magic Checkout shipping info:", existing.orderNumber);
            }
          }
        } catch (sessionSaveErr) {
          console.warn("Could not cache magic checkout session or update order:", sessionSaveErr);
        }
      }

      const lineItems = Array.isArray(body.line_items) ? body.line_items : [];

      // Determine cart subtotal in Rupees
      let cartTotalInPaise = 0;
      for (const item of lineItems) {
        const priceInPaise = Number(item.offer_price || item.price || 0);
        const qty = Number(item.quantity || 1);
        cartTotalInPaise += priceInPaise * qty;
      }
      const subtotalInRupees = cartTotalInPaise > 0 ? (cartTotalInPaise / 100) : 0;

      // Fetch dynamic store settings if configured
      let freeShippingThreshold = 350;
      let shippingRate = 50;
      try {
        const storeSettingsDoc = await db.collection("settings").doc("store").get();
        if (storeSettingsDoc.exists) {
          const settings = storeSettingsDoc.data();
          if (settings?.freeShippingThreshold !== undefined) {
            freeShippingThreshold = Number(settings.freeShippingThreshold);
          }
          if (settings?.shippingRate !== undefined) {
            shippingRate = Number(settings.shippingRate);
          }
        }
      } catch (e) {
        console.warn("Could not fetch store settings, using defaults (350/50):", e);
      }

      // Check country and pincode serviceability
      const isDomestic = country === "IN" || country === "INDIA";

      if (!isDomestic) {
        res.status(200).json({
          serviceable: false,
          cod_serviceable: false,
          shipping_methods: [],
        });
        return;
      }

      const isCodAdvance = lineItems.some(
        (it: any) =>
          it.sku === "cod_advance_20" ||
          it.id === "cod_advance_20" ||
          String(it.name || "").toLowerCase().includes("advance") ||
          String(it.name || "").toLowerCase().includes("cod")
      );
      const isFreeShipping = isCodAdvance || subtotalInRupees >= freeShippingThreshold;
      const shippingFeeInRupees = isFreeShipping ? 0 : shippingRate;
      const shippingFeeInPaise = shippingFeeInRupees * 100;

      let incomingAddresses: any[] = [{ id: "0" }];
      if (Array.isArray(body.addresses) && body.addresses.length > 0) {
        incomingAddresses = body.addresses;
      } else if (body.address) {
        incomingAddresses = [body.address];
      } else if (rawAddress && Object.keys(rawAddress).length > 0) {
        incomingAddresses = [rawAddress];
      }

      const mappedAddresses = incomingAddresses.map((addr: any, idx: number) => {
        const addrId = String(addr.id || addr.address_id || idx);
        const addrZip = addr.zipcode || addr.pincode || addr.postal_code || pincode || "560001";
        const addrState = addr.state_code || addr.state || state || "KA";
        const addrCountry = (addr.country || country || "IN").toUpperCase();

        return {
          id: addrId,
          zipcode: addrZip,
          state_code: addrState,
          country: addrCountry,
          serviceable: true,
          cod: true,
          cod_serviceable: true,
          cod_available: true,
          shipping_fee: shippingFeeInPaise,
          cod_fee: 0,
          estimated_delivery_days: 3,
          shipping_methods: [
            {
              id: "standard_shipping",
              name: "Standard Delivery",
              description: isFreeShipping ?
                "Free Delivery (3-5 business days)" :
                `Flat Delivery (3-5 business days) - Free on orders above ₹${freeShippingThreshold}`,
              serviceable: true,
              shipping_fee: shippingFeeInPaise,
              cod: true,
              cod_serviceable: true,
              cod_available: true,
              cod_fee: 0,
            },
          ],
        };
      });

      const shippingMethods = [
        {
          id: "standard_shipping",
          name: "Standard Delivery",
          description: isFreeShipping ?
            "Free Delivery (3-5 business days)" :
            `Flat Delivery (3-5 business days) - Free on orders above ₹${freeShippingThreshold}`,
          serviceable: true,
          shipping_fee: shippingFeeInPaise,
          cod: true,
          cod_serviceable: true,
          cod_available: true,
          cod_fee: 0,
        },
      ];

      res.status(200).json({
        success: true,
        serviceable: true,
        cod: true,
        cod_serviceable: true,
        cod_available: true,
        cod_fee: 0,
        addresses: mappedAddresses,
        shipping_methods: shippingMethods,
        data: {
          addresses: mappedAddresses,
          shipping_methods: shippingMethods,
        },
      });
    } catch (error: unknown) {
      const e = error as Error;
      console.error("Magic Checkout Shipping Info Error:", e);
      // Return safe fallback so checkout does not fail
      const fallbackAddresses = [
        {
          id: "0",
          zipcode: "560001",
          state_code: "KA",
          country: "IN",
          serviceable: true,
          cod: true,
          cod_serviceable: true,
          cod_available: true,
          shipping_fee: 5000,
          cod_fee: 0,
          estimated_delivery_days: 3,
          shipping_methods: [
            {
              id: "standard_shipping",
              name: "Standard Delivery",
              description: "Delivery within 3-5 business days",
              serviceable: true,
              shipping_fee: 5000,
              cod: true,
              cod_serviceable: true,
              cod_available: true,
              cod_fee: 0,
            },
          ],
        },
      ];
      res.status(200).json({
        success: true,
        serviceable: true,
        cod: true,
        cod_serviceable: true,
        cod_available: true,
        cod_fee: 0,
        addresses: fallbackAddresses,
        shipping_methods: [
          {
            id: "standard_shipping",
            name: "Standard Delivery",
            description: "Delivery within 3-5 business days",
            serviceable: true,
            shipping_fee: 5000,
            cod: true,
            cod_serviceable: true,
            cod_available: true,
            cod_fee: 0,
          },
        ],
        data: {
          addresses: fallbackAddresses,
        },
      });
    }
  }
);


