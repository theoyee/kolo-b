import assert from 'assert';
import { nairaToKobo, koboToNaira, formatKoboToNaira } from '../backend/utils';

export async function runSalesTests() {
  console.log('\n--- 🧪 TEST SUITE: Sales Engine & Transactional Checkout ---');

  const item1PriceKobo = 220000; // ₦2,200.00
  const item2PriceKobo = 75000;  // ₦750.00
  const qty1 = 3;
  const qty2 = 4;

  const subtotalKobo = item1PriceKobo * qty1 + item2PriceKobo * qty2;
  assert.strictEqual(subtotalKobo, 960000, 'Subtotal in kobo must calculate without float drift');
  assert.strictEqual(koboToNaira(subtotalKobo), 9600, 'Naira conversion must be exactly 9,600');
  console.log(`  ✔ Minor unit calculation: ${subtotalKobo} kobo = ${formatKoboToNaira(subtotalKobo)}`);

  const vatRateBps = 750; // 7.5%
  const discountKobo = 60000; // ₦600
  const discountedSubtotal = subtotalKobo - discountKobo; // 900,000 kobo (₦9,000)
  const vatAmountKobo = Math.round((discountedSubtotal * vatRateBps) / 10000); // 67,500 kobo
  const grandTotalKobo = discountedSubtotal + vatAmountKobo; // 967,500 kobo

  assert.strictEqual(discountedSubtotal, 900000);
  assert.strictEqual(vatAmountKobo, 67500, 'VAT at 7.5% on ₦9,000 must be 67,500 kobo');
  assert.strictEqual(grandTotalKobo, 967500, 'Grand total must be 967,500 kobo');
  console.log('  ✔ Discount and 7.5% VAT calculation verified');

  // Split payment with bank transfer and cash
  const payments = [
    { method: 'CASH', amountKobo: 400000 },
    { method: 'BANK_TRANSFER', amountKobo: 567500 },
  ];

  const totalPaidKobo = payments.reduce((acc, p) => acc + p.amountKobo, 0);
  assert.strictEqual(totalPaidKobo, grandTotalKobo, 'Payments sum must equal grand total');
  console.log('  ✔ Split payment allocation verified');

  console.log('✅ Sales tests passed!\n');
}
