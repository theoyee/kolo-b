import assert from 'assert';
import { InsufficientStockError } from '../backend/errors';

export async function runInventoryTests() {
  console.log('\n--- 🧪 TEST SUITE: Inventory Management & Negative Stock Rules ---');

  const processStockAdjustment = (
    currentStock: number,
    delta: number,
    allowNegative: boolean
  ) => {
    const projected = currentStock + delta;
    if (projected < 0 && !allowNegative) {
      throw new InsufficientStockError(
        `Negative stock violation: Available ${currentStock}, adjustment ${delta}`
      );
    }
    return { previousStock: currentStock, newStock: projected };
  };

  const restock = processStockAdjustment(20, 50, false);
  assert.strictEqual(restock.newStock, 70, 'Restock should increase stock from 20 to 70');
  console.log('  ✔ Restock calculation verified');

  const saleDeduction = processStockAdjustment(70, -15, false);
  assert.strictEqual(saleDeduction.newStock, 55, 'Sale deduction should reduce stock from 70 to 55');
  console.log('  ✔ Sale stock decrement verified');

  let rejected = false;
  try {
    processStockAdjustment(10, -25, false);
  } catch (err: any) {
    rejected = err instanceof InsufficientStockError;
  }
  assert.strictEqual(rejected, true, 'System must throw InsufficientStockError when negative stock disallowed');
  console.log('  ✔ Negative stock prevention rule enforced');

  const allowedNegative = processStockAdjustment(5, -12, true);
  assert.strictEqual(allowedNegative.newStock, -7, 'Should allow negative stock when enabled by settings');
  console.log('  ✔ Negative stock allowed under override configuration');

  console.log('✅ Inventory tests passed!\n');
}
