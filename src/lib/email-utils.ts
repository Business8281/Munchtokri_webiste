import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { formatOrderDate } from '@/lib/analytics/engine';

// Note: Email delivery is handled exclusively by Firebase Cloud Functions in the backend.

const LOGO_URL = 'https://munch-tokri.web.app/logo.png';

export async function generateOrderPDF(order: any) {
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Sanitize amount to replace ₹ with Rs.
    const displayAmount = (order.amount || '').replace('₹', 'Rs. ');

    // Header & Logo (Text-based for stability, better spacing)
    doc.setFontSize(24);
    doc.setTextColor(211, 47, 47); // red (#d32f2f)
    doc.setFont("helvetica", "bold");
    doc.text('MUNCH TOKRI', pageWidth / 2, 22, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(119, 119, 119); // #777
    doc.setFont("helvetica", "normal");
    doc.text('Authentic Karnataka Munchies Since 1961', pageWidth / 2, 28, { align: 'center' });
    doc.text('Hurigalu Angadi', pageWidth / 2, 33, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Order Confirmation', 20, 45);

    doc.setFontSize(10);
    doc.text(`Hi ${order.customerName},`, 20, 55);
    doc.text(`Thank you for ordering from Munch Tokri. Your order has been successfully placed.`, 20, 61);

    doc.setDrawColor(240, 240, 240);
    doc.line(20, 67, pageWidth - 20, 67);
    doc.setFont("helvetica", "bold");
    doc.text(`Order Date: ${formatOrderDate(order.date || order.createdAt)}`, 20, 73);
    doc.setFont("helvetica", "normal");
    doc.line(20, 77, pageWidth - 20, 77);

    // Addresses in two columns
    const shipping = order.shippingDetails;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text('Billing Address', 20, 88);
    doc.text('Delivery Address', pageWidth / 2 + 10, 88);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    // Billing
    doc.text(`${order.customerName}`, 20, 95);
    doc.text(`${shipping?.address || ''}`, 20, 100);
    doc.text(`${shipping?.city || ''} - ${shipping?.pincode || ''}`, 20, 105);
    doc.text(`${shipping?.mobile || ''}`, 20, 110);

    // Shipping
    doc.text(`${order.customerName}`, pageWidth / 2 + 10, 95);
    doc.text(`${shipping?.address || ''}`, pageWidth / 2 + 10, 100);
    doc.text(`${shipping?.city || ''} - ${shipping?.pincode || ''}`, pageWidth / 2 + 10, 105);
    doc.text(`${shipping?.mobile || ''}`, pageWidth / 2 + 10, 110);

    // Order ID
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Order ID: ${order.orderNumber}`, 20, 125);

    // Pre-load all product and combo images concurrently
    const itemImages = await Promise.all(
        order.items.map(async (item: any) => {
            let url = item.imageURL;
            const cat = item.category?.toLowerCase();
            const isCombo = cat === 'combos' || cat === 'combo' || item.baseWeight === 1;

            if (isCombo && (!url || url.includes('Logo') || url.startsWith('/'))) {
                if (item.products && item.products.length > 0) {
                    const firstWithImg = item.products.find((p: any) => p.imageURL || p.image);
                    if (firstWithImg) {
                        url = firstWithImg.imageURL || firstWithImg.image;
                    }
                }
            }

            if (!url || url.trim() === '') {
                url = LOGO_URL;
            } else if (url.startsWith('/')) {
                url = `https://munch-tokri.web.app${url}`;
            }

            try {
                const res = await fetch(url);
                if (!res.ok) return null;
                const arrayBuffer = await res.arrayBuffer();
                const contentType = res.headers.get('content-type') || 'image/jpeg';
                const format = contentType.includes('png') ? 'PNG' : 'JPEG';
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                return {
                    data: `data:${contentType};base64,${base64}`,
                    format
                };
            } catch {
                return null;
            }
        })
    );

    // Table
    const tableData = order.items.map((item: any) => {
        let productName = item.name;
        if (item.variant && !productName.includes(item.variant)) {
            productName = `${productName} (${item.variant})`;
        }
        const isCombo = item.category === 'Combos' || item.baseWeight === 1 || (item.products && item.products.length > 0);
        const comboGrams = item.grams || (item.products ? item.products.reduce((s: number, p: any) => s + (Number(p.grams) || 0), 0) : 0);
        if (isCombo && item.products && item.products.length > 0) {
            const packList = item.products.map((p: any) => `  • ${p.name} (${p.grams}g)`).join('\n');
            const totalPackWeightStr = comboGrams > 0 ? ` [${comboGrams}g/pack]` : '';
            productName = `${productName}\nPack of ${item.products.length}${totalPackWeightStr} includes:\n${packList}`;
        }
        const unitLabel = isCombo 
            ? ` Pack${item.quantity > 1 ? 's' : ''}${comboGrams > 0 ? ` (${comboGrams * item.quantity}g)` : ''}` 
            : (item.baseWeight === 1 ? ' Unit' : 'g');
        return [
            '', // Placeholder for Image rendered via didDrawCell
            productName,
            `Rs. ${(item.price / (item.baseWeight || 100)).toFixed(2)}`,
            `${item.quantity}${unitLabel}`,
            `Rs. ${((item.price / (item.baseWeight || 100)) * item.quantity).toFixed(2)}`
        ];
    });

    doc.autoTable({
        startY: 130,
        head: [['Image', 'Product', 'Unit Cost', 'Units', 'Amount']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [243, 243, 243], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4, minCellHeight: 18, valign: 'middle' },
        columnStyles: {
            0: { cellWidth: 22, halign: 'center', valign: 'middle' },
            1: { cellWidth: 78, valign: 'middle' },
            2: { halign: 'center', valign: 'middle' },
            3: { halign: 'center', valign: 'middle' },
            4: { halign: 'right', valign: 'middle' }
        },
        alternateRowStyles: { fillColor: [252, 252, 252] },
        didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 0) {
                const imgObj = itemImages[data.row.index];
                if (imgObj && imgObj.data) {
                    try {
                        const size = Math.min(data.cell.width - 4, data.cell.height - 4, 15);
                        const x = data.cell.x + (data.cell.width - size) / 2;
                        const y = data.cell.y + (data.cell.height - size) / 2;
                        doc.addImage(imgObj.data, imgObj.format, x, y, size, size);
                    } catch {
                        // ignore if invalid image
                    }
                }
            }
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const subtotal = order.items.reduce((sum: number, item: any) => sum + ((item.price / (item.baseWeight || 100)) * item.quantity), 0);
    const shippingCost = subtotal < 350 ? 50 : 0;
    const tax = subtotal * 0.05;

    const isCodOrder =
        order.method?.payment === 'COD' ||
        order.method?.payment === 'Cash on Delivery (COD)' ||
        order.method?.payment?.includes('Cash on Delivery') ||
        order.paymentDetails?.isCod === true ||
        String(order.paymentDetails?.method || '').toLowerCase().includes('cod');

    const totalNumeric = parseFloat(String(order.amount || '').replace(/[^0-9.-]+/g, '')) || 0;
    const advancePaid = Number(order.paymentDetails?.advancePaid || (isCodOrder ? totalNumeric * 0.2 : 0));
    const codBalance = Number(order.paymentDetails?.codBalance || (isCodOrder ? Math.max(0, totalNumeric - advancePaid) : 0));

    // Totals Grid
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text('Shipping', 120, finalY);
    doc.text(`Rs. ${shippingCost.toFixed(2)}`, pageWidth - 20, finalY, { align: 'right' });
    
    let currentY = finalY + 7;
    if (order.codPrice && order.codPrice > 0) {
        doc.text('COD Extra Charge', 120, currentY);
        doc.text(`Rs. ${order.codPrice.toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });
        currentY += 7;
    }
    
    doc.text('Total Tax (CGST 2.5% + SGST 2.5%)', 120, currentY);
    doc.text(`Rs. ${tax.toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text('Order Total', 120, currentY + 9);
    doc.text(`${displayAmount}`, pageWidth - 20, currentY + 9, { align: 'right' });
    currentY += 16;

    if (isCodOrder && advancePaid > 0) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(22, 163, 74); // green
        doc.text('20% Advance Paid Online (Razorpay)', 120, currentY);
        doc.text(`-Rs. ${advancePaid.toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });
        currentY += 7;

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(211, 47, 47); // red
        doc.text('Balance Due on Delivery (Cash to Courier)', 120, currentY);
        doc.text(`Rs. ${codBalance.toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });
        currentY += 8;
        doc.setTextColor(0, 0, 0); // reset black
    }

    doc.setDrawColor(240, 240, 240);
    doc.line(20, currentY + 4, pageWidth - 20, currentY + 4);

    // Transaction Details - Table format to match email look
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text('Payment & Delivery Details', 20, currentY + 12);
    
    doc.autoTable({
        startY: currentY + 16,
        margin: { left: 20, right: 20 },
        body: isCodOrder
            ? [
                ['Payment Method', 'Cash on Delivery (20% Advance Paid)'],
                ['20% Advance Payment', `Rs. ${advancePaid.toFixed(2)} (Paid Online via Razorpay)`],
                ['Remaining Balance on Delivery', `Rs. ${codBalance.toFixed(2)} (To be collected by Courier)`],
                ['Delivery Courier', `${order.courierName || 'Velocity Express'}${order.velocityAWB ? ` (AWB: ${order.velocityAWB})` : ''}`],
                ['Customer Contact', `${order.shippingDetails?.mobile || 'N/A'}${order.customerEmail ? ` • ${order.customerEmail}` : ''}`],
              ]
            : [
                ['Payment Method', order.method?.payment || 'Online Payment (Prepaid)'],
                ['Payment Status', 'Paid in Full'],
                ['Delivery Courier', `${order.courierName || 'Velocity Express'}${order.velocityAWB ? ` (AWB: ${order.velocityAWB})` : ''}`],
                ['Customer Contact', `${order.shippingDetails?.mobile || 'N/A'}${order.customerEmail ? ` • ${order.customerEmail}` : ''}`],
              ],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            1: { halign: 'right', fontStyle: 'bold' }
        }
    });

    const footerY = (doc as any).lastAutoTable.finalY + 18;
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text('Authentic Karnataka Munchies Since 1961 - Hurigalu Angadi', pageWidth / 2, footerY, { align: 'center' });

    return doc.output('arraybuffer');
}

export async function sendOrderConfirmationEmail(order: any, pdfBuffer: ArrayBuffer) {
    const subtotal = order.items.reduce((sum: number, item: any) => sum + ((item.price / (item.baseWeight || 100)) * item.quantity), 0);
    const shippingCost = subtotal < 350 ? 50 : 0;
    const tax = subtotal * 0.05;

    const isCodOrder =
        order.method?.payment === 'COD' ||
        order.method?.payment === 'Cash on Delivery (COD)' ||
        order.method?.payment?.includes('Cash on Delivery') ||
        order.paymentDetails?.isCod === true ||
        String(order.paymentDetails?.method || '').toLowerCase().includes('cod');

    const totalNumeric = parseFloat(String(order.amount || '').replace(/[^0-9.-]+/g, '')) || 0;
    const advancePaid = Number(order.paymentDetails?.advancePaid || (isCodOrder ? totalNumeric * 0.2 : 0));
    const codBalance = Number(order.paymentDetails?.codBalance || (isCodOrder ? Math.max(0, totalNumeric - advancePaid) : 0));

    const productRows = order.items.map((item: any) => {
        const isCombo = item.category === 'Combos' || item.baseWeight === 1 || (item.products && item.products.length > 0);
        const comboGrams = item.grams || (item.products ? item.products.reduce((s: number, p: any) => s + (Number(p.grams) || 0), 0) : 0);
        let itemsHtml = '';
        if (isCombo && item.products && item.products.length > 0) {
            const totalPackWeightStr = comboGrams > 0 ? ` • Total ${comboGrams}g` : '';
            itemsHtml = `
            <div style="margin-top:6px;padding:6px 10px;background:#f0fdfa;border-left:3px solid #0d9488;border-radius:4px;text-align:left;">
                <div style="font-size:11px;font-weight:700;color:#0f766e;margin-bottom:3px;">Pack of ${item.products.length} includes${totalPackWeightStr}:</div>
                <div style="font-size:11px;color:#334155;line-height:1.5;">
                    ${item.products.map((p: any) => `<div style="margin-bottom:2px;">• <strong>${p.name}</strong> (${p.grams || 0}g)</div>`).join('')}
                </div>
            </div>`;
        }
        const unitLabel = isCombo 
            ? ` Pack${item.quantity > 1 ? 's' : ''}${comboGrams > 0 ? ` (${comboGrams * item.quantity}g)` : ''}` 
            : (item.baseWeight === 1 ? ' Unit' : 'g');
        const itemTitle = item.variant && !item.name.includes(item.variant) ? `${item.name} (${item.variant})` : item.name;

        return `
        <tr style="border-bottom: 1px solid #eee">
            <td style="padding: 10px"><img src="${item.imageURL || LOGO_URL}" width="50" style="border-radius: 4px"></td>
            <td style="padding: 10px">
                <div style="font-weight:600">${itemTitle}</div>
                ${itemsHtml}
            </td>
            <td align="center" style="padding: 10px">Rs. ${(item.price / (item.baseWeight || 100)).toFixed(2)}</td>
            <td align="center" style="padding: 10px">${item.quantity}${unitLabel}</td>
            <td align="right" style="padding: 10px">Rs. ${((item.price / (item.baseWeight || 100)) * item.quantity).toFixed(2)}</td>
        </tr>
        `;
    }).join('');

    const displayAmount = (order.amount || '').replace('₹', 'Rs. ');

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${LOGO_URL}" alt="Munch Tokri Logo" style="max-height: 80px;" />
                </div>
                <h2 style="color:#d32f2f">Order Confirmation</h2>
                <p>Hi ${order.customerName},</p>
                <p>Thank you for ordering from <b>Munch Tokri</b>. Your order has been successfully placed.</p>
                <hr style="border: none; border-top: 1px solid #eee">
                <b>Order Date:</b> ${formatOrderDate(order.date || order.createdAt)}
                <hr style="border: none; border-top: 1px solid #eee">
                <table width="100%" style="margin-top:20px">
                    <tr>
                        <td width="50%" valign="top">
                            <h3 style="color: #333; margin-bottom: 10px;">Billing Address</h3>
                            ${order.customerName}<br>
                            ${order.shippingDetails?.address || ''}<br>
                            ${order.shippingDetails?.city || ''} - ${order.shippingDetails?.pincode || ''}<br>
                            ${order.shippingDetails?.mobile || ''}<br>
                        </td>
                        <td width="50%" valign="top">
                            <h3 style="color: #333; margin-bottom: 10px;">Delivery Address</h3>
                            ${order.customerName}<br>
                            ${order.shippingDetails?.address || ''}<br>
                            ${order.shippingDetails?.city || ''} - ${order.shippingDetails?.pincode || ''}<br>
                            ${order.shippingDetails?.mobile || ''}<br>
                        </td>
                    </tr>
                </table>
                <hr style="border: none; border-top: 1px solid #eee">
                <h3>Order ID: ${order.orderNumber}</h3>
                <table width="100%" style="border-collapse:collapse">
                    <tr style="background:#f3f3f3">
                        <th align="left" style="padding: 10px">Image</th>
                        <th align="left" style="padding: 10px">Product</th>
                        <th style="padding: 10px">Unit Cost</th>
                        <th style="padding: 10px">Units</th>
                        <th align="right" style="padding: 10px">Amount</th>
                    </tr>
                    ${productRows}
                </table>
                <hr style="border: none; border-top: 1px solid #eee">
                <table width="100%">
                    <tr>
                        <td>Shipping</td>
                        <td align="right">Rs. ${shippingCost.toFixed(2)}</td>
                    </tr>
                    ${order.codPrice && order.codPrice > 0 ? `
                    <tr>
                        <td>COD Extra Charge</td>
                        <td align="right">Rs. ${order.codPrice.toFixed(2)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td>Total Tax (CGST 2.5% + SGST 2.5%)</td>
                        <td align="right">Rs. ${tax.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td><b>Total Order Amount</b></td>
                        <td align="right"><b>${displayAmount}</b></td>
                    </tr>
                    ${isCodOrder && advancePaid > 0 ? `
                    <tr style="color: #16a34a;">
                        <td><b>20% Advance Paid Online (Razorpay)</b></td>
                        <td align="right"><b>- Rs. ${advancePaid.toFixed(2)}</b></td>
                    </tr>
                    <tr style="background-color: #fffbeb; color: #b45309; font-size: 15px;">
                        <td style="padding: 8px 4px;"><b>Balance Due on Delivery (Cash to Courier)</b></td>
                        <td align="right" style="padding: 8px 4px;"><b>Rs. ${codBalance.toFixed(2)}</b></td>
                    </tr>
                    ` : ''}
                </table>
                <hr style="border: none; border-top: 1px solid #eee">
                <h3>Payment & Delivery Information</h3>
                <table width="100%" style="font-size: 14px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 6px 0; color: #64748b;">Payment Method:</td>
                        <td align="right" style="padding: 6px 0; font-weight: bold;">
                            ${isCodOrder ? 'Cash on Delivery (20% Advance Paid Online)' : (order.method?.payment || 'Prepaid Online')}
                        </td>
                    </tr>
                    ${isCodOrder ? `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 6px 0; color: #64748b;">20% Advance Paid Online:</td>
                        <td align="right" style="padding: 6px 0; font-weight: bold; color: #16a34a;">Rs. ${advancePaid.toFixed(2)} (Paid)</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 6px 0; color: #64748b;">Remaining Balance on Delivery:</td>
                        <td align="right" style="padding: 6px 0; font-weight: bold; color: #d32f2f;">Rs. ${codBalance.toFixed(2)} (To Pay Courier)</td>
                    </tr>
                    ` : `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 6px 0; color: #64748b;">Payment Status:</td>
                        <td align="right" style="padding: 6px 0; font-weight: bold; color: #16a34a;">Paid in Full</td>
                    </tr>
                    `}
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 6px 0; color: #64748b;">Delivery Courier:</td>
                        <td align="right" style="padding: 6px 0; font-weight: bold;">
                            ${order.courierName || 'Velocity Express'}${order.velocityAWB ? ` (AWB: ${order.velocityAWB})` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #64748b;">Live Updates Sent To:</td>
                        <td align="right" style="padding: 6px 0; font-weight: bold;">
                            WhatsApp / SMS: +91 ${order.shippingDetails?.mobile || 'N/A'}
                        </td>
                    </tr>
                </table>
                <p style="font-size:13px;color:#777;margin-top:30px">
                    Authentic Karnataka Munchies Since 1961
                    <br>
                    Hurigalu Angadi
                </p>
            </div>
        </div>
    `;

    // In production, emails are dispatched by Firebase Cloud Functions.
    console.info(`[Email Utils] Order confirmation prepared for: ${order.customerEmail}`);
    return { success: true, message: "Handled by Cloud Functions" };
}

export async function sendStatusUpdateEmail(order: any) {
    const logoUrl = "https://munch-tokri.web.app/logo.png";
    const status = order.status;
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
            message = `<p>Your order <b>#${order.orderNumber}</b> has been freshly prepared and will soon be dispatched.</p>`;
            break;
        case "Dispatched":
            subject = `Order Dispatched - ${order.orderNumber} 🚚`;
            color = "#3498db";
            title = "Order Dispatched 🚚";
            message = `<p>Your order <b>#${order.orderNumber}</b> has been dispatched.</p>`;
            if (order.velocityAWB || order.velocityOrderId) {
                const courier = order.courierName || "Velocity";
                const trackingId = order.velocityAWB || order.velocityOrderId;
                const trackingLink = `https://shipfastt.in/track/${trackingId}`;
                extraContent = `
                    <p><b>Courier:</b> ${courier}</p>
                    <p><b>Tracking ID:</b> ${trackingId}</p>
                    <div style="margin-top: 20px;">
                        <a href="${trackingLink}" style="background:#d32f2f;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;">
                            Track Order
                        </a>
                    </div>
                `;
            } else if (order.shiprocketOrderId || order.trackingId) {
                const courier = order.courierName || "Shiprocket";
                const trackingId = order.trackingId || order.shiprocketOrderId;
                const trackingLink = `https://shiprocket.co/tracking/${trackingId}`;
                extraContent = `
                    <p><b>Courier:</b> ${courier}</p>
                    <p><b>Tracking ID:</b> ${trackingId}</p>
                    <div style="margin-top: 20px;">
                        <a href="${trackingLink}" style="background:#d32f2f;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;">
                            Track Order
                        </a>
                    </div>
                `;
            }
            break;
        case "Delivered":
            subject = `Order Delivered - ${order.orderNumber} 🎉`;
            color = "#27ae60";
            title = "Order Delivered 🎉";
            message = `<p>Your order <b>#${order.orderNumber}</b> has been delivered.</p><p>We hope you enjoy your Munch Tokri snacks.</p>`;
            break;
        case "Cancelled":
            subject = `Order Cancelled - ${order.orderNumber}`;
            color = "#e74c3c";
            title = "Order Cancelled";
            message = `<p>Your order <b>#${order.orderNumber}</b> has been cancelled.</p><p>If payment was made online, your refund will be processed shortly.</p>`;
            break;
        case "Refund Requested":
            subject = `Refund Request Received - ${order.orderNumber}`;
            color = "#e74c3c";
            title = "Refund Request Received";
            message = `<p>We have received your refund request for order <b>#${order.orderNumber}</b>.</p><p>Our team will review and process it shortly.</p>`;
            break;
        case "Replacement Requested":
            subject = `Replacement Request Received - ${order.orderNumber}`;
            color = "#0369a1";
            title = "Replacement Request Received";
            message = `<p>Your replacement request for order <b>#${order.orderNumber}</b> has been registered.</p><p>We will notify you once the replacement is shipped.</p>`;
            break;
        case "Return Requested":
            subject = `Return Request Submitted - ${order.orderNumber}`;
            color = "#92400e";
            title = "Return Request Submitted";
            message = `<p>Your return request for order <b>#${order.orderNumber}</b> has been received.</p><p>Our team will arrange pickup shortly.</p>`;
            break;
        case "Returned":
            subject = `Return Completed - ${order.orderNumber}`;
            color = "#166534";
            title = "Return Completed";
            message = `<p>Your returned item for order <b>#${order.orderNumber}</b> has been received.</p><p>Your refund will be processed soon.</p>`;
            break;
        default:
            message = `<p>Your order status has been updated to ${status}.</p>`;
    }

    // In production, status update emails are dispatched by Firebase Cloud Functions.
    console.info(`[Email Utils] Order update prepared for: ${order.customerEmail}`);
    return { success: true, message: "Handled by Cloud Functions" };
}
