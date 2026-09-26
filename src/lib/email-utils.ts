import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { formatOrderDate } from '@/lib/analytics/engine';

// SMTP Configuration (GoDaddy)
const transporter = nodemailer.createTransport({
    host: 'smtpout.secureserver.net',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

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

    // Table
    const tableData = order.items.map((item: any) => [
        '', // Placeholder for Image
        item.name,
        `Rs. ${(item.price / (item.baseWeight || 100)).toFixed(2)}`,
        `${item.quantity}${item.baseWeight === 1 ? ' Unit' : 'g'}`,
        `Rs. ${((item.price / (item.baseWeight || 100)) * item.quantity).toFixed(2)}`
    ]);

    doc.autoTable({
        startY: 130,
        head: [['Image', 'Product', 'Unit Cost', 'Units', 'Amount']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [243, 243, 243], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 80 },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'right' }
        },
        alternateRowStyles: { fillColor: [252, 252, 252] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const subtotal = order.items.reduce((sum: number, item: any) => sum + ((item.price / (item.baseWeight || 100)) * item.quantity), 0);
    const shippingCost = subtotal < 350 ? 50 : 0;
    const tax = subtotal * 0.05;

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

    doc.setDrawColor(240, 240, 240);
    doc.line(20, currentY + 15, pageWidth - 20, currentY + 15);

    // Transaction Details - Table format to match email look
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text('Transaction', 20, currentY + 25);
    
    doc.autoTable({
        startY: currentY + 29,
        margin: { left: 20, right: 20 },
        body: [
            [order.method?.payment || 'N/A', order.status === 'Paid' || order.method?.payment !== 'Cash on Delivery (COD)' ? 'Paid' : 'Pending']
        ],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: {
            1: { halign: 'right' }
        }
    });

    const footerY = (doc as any).lastAutoTable.finalY + 20;
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

    const productRows = order.items.map((item: any) => `
        <tr style="border-bottom: 1px solid #eee">
            <td style="padding: 10px"><img src="${item.imageURL || LOGO_URL}" width="50" style="border-radius: 4px"></td>
            <td style="padding: 10px">${item.name}</td>
            <td align="center" style="padding: 10px">Rs. ${(item.price / (item.baseWeight || 100)).toFixed(2)}</td>
            <td align="center" style="padding: 10px">${item.quantity}${item.baseWeight === 1 ? ' Unit' : 'g'}</td>
            <td align="right" style="padding: 10px">Rs. ${((item.price / (item.baseWeight || 100)) * item.quantity).toFixed(2)}</td>
        </tr>
    `).join('');

    const displayAmount = (order.amount || '').replace('₹', 'Rs. ');

    const htmlContent = `
        <div style="font-family:Arial,Helvetica,sans-serif;background:#f2f2f2;padding:30px">
            <div style="max-width:800px;margin:auto;background:white;border-radius:6px;padding:30px">
                <div style="text-align:center; margin-bottom: 20px;">
                    <img src="${LOGO_URL}" width="200" alt="Munch Tokri">
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
                        <td><b>Order Total</b></td>
                        <td align="right"><b>${displayAmount}</b></td>
                    </tr>
                </table>
                <hr style="border: none; border-top: 1px solid #eee">
                <h3>Transaction</h3>
                <table width="100%">
                    <tr>
                        <td>${order.method?.payment || 'N/A'}</td>
                        <td align="right">${order.status === 'Paid' || order.method?.payment !== 'Cash on Delivery (COD)' ? 'Paid' : 'Pending'}</td>
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

    const mailOptions = {
        from: `"Munch Tokri" <${process.env.EMAIL_USER}>`,
        to: order.customerEmail,
        subject: `Order Confirmation - ${order.orderNumber}`,
        html: htmlContent,
        attachments: [
            {
                filename: `Receipt-${order.orderNumber}.pdf`,
                content: Buffer.from(pdfBuffer),
            },
        ],
    };

    return transporter.sendMail(mailOptions);
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

    const mailOptions = {
        from: `"Munch Tokri" <${process.env.EMAIL_USER}>`,
        to: order.customerEmail,
        subject: subject,
        html: `
            <div style="font-family: Arial, Helvetica, sans-serif; background: #f4f4f4; padding: 30px;">
                <div style="max-width: 700px; margin: auto; background: white; padding: 30px; border-radius: 8px;">
                    <div style="text-align: center;">
                        <img src="${logoUrl}" width="200">
                    </div>
                    <h2 style="color: ${color}; text-align: center;">${title}</h2>
                    <div style="color: #333; line-height: 1.6;">
                        <p>Hello <strong>${order.customerName}</strong>,</p>
                        ${message}
                        ${extraContent}
                    </div>
                    <p style="font-size: 13px; color: #777; margin-top: 30px; text-align: center;">
                        Authentic Karnataka Munchies Since 1961<br>
                        Hurigalu Angadi
                    </p>
                </div>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
}
