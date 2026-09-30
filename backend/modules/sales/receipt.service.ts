import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import prisma from '../../db/prisma';
import { NotFoundError } from '../../errors';
import { formatKoboToNaira } from '../../utils';

export class ReceiptService {
  /**
   * Generates a downloadable, high-fidelity PDF receipt for a completed sale.
   * Includes business branding, itemized transaction details, tax breakdown in Kobo,
   * split payment records, and a scannable QR code for verification.
   */
  async generateReceiptPdf(
    businessId: string,
    saleId: string
  ): Promise<{ buffer: Buffer; fileName: string; saleNumber: string }> {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        business: { include: { settings: true } },
        customer: true,
        items: true,
        payments: true,
        cashier: { include: { user: true } },
      },
    });

    if (!sale || sale.businessId !== businessId) {
      throw new NotFoundError('Sale transaction not found in this business');
    }

    const business = sale.business;
    const settings = business.settings;
    const vatRate = (settings?.vatRateBps ?? 750) / 100; // e.g. 7.5%

    // 1. Generate QR Code containing verification data
    const verificationUrl = `https://kolo.ng/verify/receipt/${sale.saleNumber}?bid=${business.id}&amt=${sale.grandTotal}`;
    const qrBuffer = await QRCode.toBuffer(verificationUrl, {
      width: 130,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    // 2. Build the PDF Document (A5 Page format: 420 x 595 points, crisp for desktop, mobile & POS)
    const doc = new PDFDocument({
      size: 'A5',
      margins: { top: 25, bottom: 25, left: 30, right: 30 },
      info: {
        Title: `Sales Receipt - ${sale.saleNumber}`,
        Author: business.name,
        Subject: `Official Tax Invoice & Receipt #${sale.saleNumber}`,
        Keywords: 'Receipt, Invoice, Tax, Kobo, Nigeria, Kolo',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));
    });

    // --- Color Palette ---
    const primaryColor = '#047857'; // Emerald 700
    const darkSlate = '#0f172a'; // Slate 900
    const textMuted = '#64748b'; // Slate 500
    const borderGray = '#e2e8f0'; // Slate 200
    const bgLight = '#f8fafc'; // Slate 50

    // --- Header Branding ---
    doc.rect(30, 25, 360, 4).fill(primaryColor);

    doc.moveDown(0.8);
    doc.fontSize(16).fillColor(darkSlate).font('Helvetica-Bold').text(business.name.toUpperCase(), { align: 'center' });

    if (business.legalName && business.legalName !== business.name) {
      doc.fontSize(8).fillColor(textMuted).font('Helvetica').text(business.legalName, { align: 'center' });
    }

    const addressParts = [business.address, business.city, business.state].filter(Boolean).join(', ');
    if (addressParts) {
      doc.fontSize(8).fillColor(textMuted).font('Helvetica').text(addressParts, { align: 'center' });
    }

    const contactParts = [
      business.phone ? `Tel: ${business.phone}` : '',
      business.email ? `Email: ${business.email}` : '',
      business.rcNumber ? `RC: ${business.rcNumber}` : '',
    ].filter(Boolean).join('  •  ');
    
    if (contactParts) {
      doc.fontSize(7.5).fillColor(textMuted).font('Helvetica').text(contactParts, { align: 'center' });
    }

    doc.moveDown(0.5);
    // Divider
    doc.strokeColor(borderGray).lineWidth(1).moveTo(30, doc.y).lineTo(390, doc.y).stroke();
    doc.moveDown(0.6);

    // --- Receipt Meta & Cashier Banner ---
    const metaY = doc.y;
    doc.rect(30, metaY, 360, 42).fill(bgLight);

    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10);
    doc.text(`OFFICIAL SALES RECEIPT`, 40, metaY + 6);
    doc.fillColor(darkSlate).font('Helvetica-Bold').fontSize(9);
    doc.text(`# ${sale.saleNumber}`, 40, metaY + 20);

    const saleDate = new Date(sale.createdAt).toLocaleString('en-NG', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    doc.fillColor(textMuted).font('Helvetica').fontSize(8);
    doc.text(`Date: ${saleDate}`, 240, metaY + 6, { align: 'right', width: 140 });

    const cashierName = sale.cashier?.user
      ? `${sale.cashier.user.firstName} ${sale.cashier.user.lastName}`
      : 'Front Desk';
    doc.text(`Cashier: ${cashierName}`, 240, metaY + 20, { align: 'right', width: 140 });

    doc.y = metaY + 48;

    // --- Customer Info if attached ---
    if (sale.customer) {
      doc.fontSize(8).fillColor(textMuted).font('Helvetica');
      doc.text(`Customer: ${sale.customer.fullName}${sale.customer.phone ? ` (${sale.customer.phone})` : ''}`, 30);
      doc.moveDown(0.4);
    }

    // --- Line Items Table Header ---
    const tableTop = doc.y + 4;
    doc.rect(30, tableTop, 360, 18).fill('#064e3b'); // Dark Emerald
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5);
    doc.text('ITEM DESCRIPTION', 36, tableTop + 5);
    doc.text('QTY', 210, tableTop + 5, { width: 35, align: 'center' });
    doc.text('PRICE', 255, tableTop + 5, { width: 55, align: 'right' });
    doc.text('TOTAL', 320, tableTop + 5, { width: 62, align: 'right' });

    let currentY = tableTop + 20;
    doc.font('Helvetica').fontSize(8);

    sale.items.forEach((item, index) => {
      const isEven = index % 2 === 0;
      if (isEven) {
        doc.rect(30, currentY - 2, 360, 16).fill('#f1f5f9');
      }

      doc.fillColor(darkSlate).font('Helvetica');
      doc.text(item.productName, 36, currentY + 1, { width: 170, ellipsis: true });
      doc.text(String(item.quantity), 210, currentY + 1, { width: 35, align: 'center' });
      doc.text(formatKoboToNaira(item.unitSellingPrice), 255, currentY + 1, { width: 55, align: 'right' });
      doc.font('Helvetica-Bold').text(formatKoboToNaira(item.total), 320, currentY + 1, { width: 62, align: 'right' });

      currentY += 16;
    });

    doc.y = currentY + 6;
    doc.strokeColor(borderGray).lineWidth(1).moveTo(30, doc.y).lineTo(390, doc.y).stroke();
    doc.moveDown(0.5);

    // --- Financial & Tax Breakdown (Strictly in Kobo & Naira) ---
    const summaryY = doc.y;
    const leftColX = 30;
    const rightColX = 210;

    // Left Column: QR Code + Verification Stamp
    doc.image(qrBuffer, leftColX + 5, summaryY + 4, { width: 85, height: 85 });
    doc.fontSize(6.5).fillColor(textMuted).font('Helvetica');
    doc.text('Scan QR to verify receipt authenticity', leftColX, summaryY + 92, { width: 100, align: 'center' });
    doc.text(`Kolo Verification ID: ${sale.id.slice(0, 8)}`, leftColX, summaryY + 100, { width: 100, align: 'center' });

    // Right Column: Precise Minor Unit Breakdown
    let rY = summaryY;
    const addSummaryRow = (label: string, koboValue: bigint | number, isBold = false, isAccent = false) => {
      const numKobo = typeof koboValue === 'bigint' ? Number(koboValue) : koboValue;
      doc.fontSize(8).font(isBold ? 'Helvetica-Bold' : 'Helvetica');
      doc.fillColor(isAccent ? primaryColor : darkSlate);
      doc.text(label, rightColX, rY);
      doc.text(formatKoboToNaira(koboValue), 310, rY, { width: 75, align: 'right' });
      // Minor unit kobo label
      doc.fontSize(6.5).fillColor(textMuted).font('Helvetica');
      doc.text(`(${numKobo.toLocaleString()} kobo)`, 310, rY + 8, { width: 75, align: 'right' });
      rY += 19;
    };

    addSummaryRow('Subtotal:', sale.subtotal);

    if (Number(sale.discountAmount) > 0) {
      addSummaryRow('Discount Applied:', -Number(sale.discountAmount));
    }

    if (Number(sale.taxAmount) > 0) {
      addSummaryRow(`VAT (${vatRate}%):`, sale.taxAmount);
    } else {
      doc.fontSize(8).font('Helvetica').fillColor(textMuted).text('VAT (0% Exempt):', rightColX, rY);
      doc.text('₦0.00', 310, rY, { width: 75, align: 'right' });
      rY += 15;
    }

    // Grand Total Bar
    doc.rect(rightColX - 5, rY, 185, 22).fill(primaryColor);
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('GRAND TOTAL:', rightColX + 2, rY + 6);
    doc.text(formatKoboToNaira(sale.grandTotal), 305, rY + 3, { width: 75, align: 'right' });
    doc.fontSize(6.5).text(`(${Number(sale.grandTotal).toLocaleString()} kobo)`, 305, rY + 13, { width: 75, align: 'right' });
    rY += 28;

    // Payments Section
    doc.fontSize(8).font('Helvetica-Bold').fillColor(darkSlate).text('Payment Summary:', rightColX, rY);
    rY += 12;

    sale.payments.forEach((p) => {
      doc.fontSize(7.5).font('Helvetica').fillColor(textMuted);
      const methodLabel = p.method.replace('_', ' ');
      doc.text(`${methodLabel} ${p.reference ? `(${p.reference.slice(0, 14)})` : ''}:`, rightColX, rY);
      doc.font('Helvetica-Bold').fillColor(darkSlate).text(formatKoboToNaira(p.amount), 310, rY, { width: 75, align: 'right' });
      rY += 12;
    });

    if (Number(sale.balanceDue) > 0) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#b91c1c'); // Crimson Red
      doc.text('BALANCE DUE:', rightColX, rY);
      doc.text(formatKoboToNaira(sale.balanceDue), 310, rY, { width: 75, align: 'right' });
      rY += 14;
    }

    // --- Footer Bank & Policy Notes ---
    doc.y = Math.max(rY + 8, summaryY + 115);
    doc.strokeColor(borderGray).lineWidth(0.8).moveTo(30, doc.y).lineTo(390, doc.y).stroke();
    doc.moveDown(0.6);

    // Business Bank Account Information (for official records / verification)
    if (settings?.bankName && settings?.bankAccountNumber) {
      doc.fontSize(7).fillColor(textMuted).font('Helvetica-Bold');
      doc.text(
        `Direct Transfer: ${settings.bankName}  •  Acct: ${settings.bankAccountNumber}  •  Name: ${settings.bankAccountName || business.name}`,
        { align: 'center' }
      );
      doc.moveDown(0.2);
    }

    const receiptNotes =
      settings?.receiptNotes ||
      'Thank you for your patronage! Goods sold in good condition are not returnable.';
    doc.fontSize(7).fillColor(textMuted).font('Helvetica').text(receiptNotes, { align: 'center' });

    doc.moveDown(0.3);
    doc.fontSize(6).fillColor('#94a3b8').text('Powered by Kolo SME Engine • Valid Official Electronic Receipt', { align: 'center' });

    doc.end();

    const buffer = await pdfPromise;
    const fileName = `receipt-${sale.saleNumber}.pdf`;

    return { buffer, fileName, saleNumber: sale.saleNumber };
  }

  /**
   * Verifies receipt authenticity by sale number and returns transaction verification data
   */
  async verifyReceiptData(businessId: string, saleNumber: string) {
    const sale = await prisma.sale.findFirst({
      where: { businessId, saleNumber },
      include: {
        business: { select: { id: true, name: true, rcNumber: true, phone: true } },
        customer: { select: { fullName: true } },
        items: true,
        payments: true,
      },
    });

    if (!sale) {
      throw new NotFoundError('Receipt verification failed: Sale record not found');
    }

    return {
      isValid: true,
      saleNumber: sale.saleNumber,
      businessName: sale.business.name,
      rcNumber: sale.business.rcNumber,
      issuedAt: sale.createdAt,
      status: sale.status,
      paymentStatus: sale.paymentStatus,
      grandTotalKobo: Number(sale.grandTotal),
      grandTotalNaira: Number(sale.grandTotal) / 100,
      formattedTotal: formatKoboToNaira(sale.grandTotal),
      taxAmountKobo: Number(sale.taxAmount),
      formattedTax: formatKoboToNaira(sale.taxAmount),
      itemCount: sale.items.length,
      customerName: sale.customer?.fullName || 'Walk-in Customer',
    };
  }
}

export const receiptService = new ReceiptService();
