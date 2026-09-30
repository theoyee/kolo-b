import assert from 'assert';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { formatKoboToNaira } from '../backend/utils';

export async function runReceiptTests() {
  console.log('\n--- 🧪 TEST SUITE: Downloadable PDF Receipt & QR Code Verification ---');

  // 1. Verify QR Code generation
  const verificationPayload = 'https://kolo.ng/verify/receipt/SALE-2026-00042?bid=biz_123&amt=10320000';
  const qrBuffer = await QRCode.toBuffer(verificationPayload, { width: 100, margin: 1 });
  assert(Buffer.isBuffer(qrBuffer), 'QR code must be a Buffer');
  assert(qrBuffer.length > 50, 'QR code buffer should contain valid image bytes');
  console.log('  ✔ QR code generation and verification payload verified');

  // 2. Verify Tax Breakdown in Kobo and Naira calculations
  const subtotalKobo = 9600000; // ₦96,000.00
  const vatRateBps = 750; // 7.5%
  const taxKobo = Math.round((subtotalKobo * vatRateBps) / 10000); // 720,000 kobo (₦7,200.00)
  const grandTotalKobo = subtotalKobo + taxKobo; // 10,320,000 kobo (₦103,200.00)

  assert.strictEqual(taxKobo, 720000, '7.5% VAT must be exactly 720,000 kobo');
  assert.strictEqual(grandTotalKobo, 10320000, 'Grand total must be exactly 10,320,000 kobo');
  assert.strictEqual(formatKoboToNaira(taxKobo), '₦7,200.00');
  assert.strictEqual(formatKoboToNaira(grandTotalKobo), '₦103,200.00');
  console.log('  ✔ Tax breakdown in minor units (Kobo) and formatted Naira verified');

  // 3. Verify PDF generation creates valid binary stream
  const doc = new PDFDocument({ size: 'A5' });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));

  const pdfPromise = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(16).text('MAMA CHINEDU SUPERMARKET & PROVISIONS');
  doc.fontSize(10).text('Official Tax Invoice & Receipt # SALE-2026-00042');
  doc.image(qrBuffer, 30, doc.y + 10, { width: 80 });
  doc.end();

  const generatedPdf = await pdfPromise;
  assert(Buffer.isBuffer(generatedPdf), 'Generated PDF must be a buffer');
  assert(generatedPdf.length > 500, 'PDF buffer must contain substantial document content');
  const pdfHeader = generatedPdf.subarray(0, 5).toString('ascii');
  assert.strictEqual(pdfHeader, '%PDF-', 'Buffer must begin with standard PDF signature "%PDF-"');
  console.log(`  ✔ Vector PDF document rendered successfully (${generatedPdf.length} bytes, header: ${pdfHeader})`);

  console.log('✅ PDF Receipt & QR Verification tests passed!');
}
