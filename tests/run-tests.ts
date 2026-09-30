import { runAuthTests } from './auth.test';
import { runRBACTests } from './rbac.test';
import { runTenancyTests } from './tenancy.test';
import { runInventoryTests } from './inventory.test';
import { runSalesTests } from './sales.test';
import { runPaymentsTests } from './payments.test';
import { runReceiptTests } from './receipt.test';

async function main() {
  const startTime = Date.now();
  console.log('====================================================');
  console.log('🇳🇬 KOLO SME BACKEND SUITE: RUNNING INTEGRATION TESTS');
  console.log('====================================================');

  try {
    await runAuthTests();
    await runRBACTests();
    await runTenancyTests();
    await runInventoryTests();
    await runSalesTests();
    await runPaymentsTests();
    await runReceiptTests();

    const elapsed = Date.now() - startTime;
    console.log('====================================================');
    console.log(`🎉 ALL TEST SUITES PASSED SUCCESSFULLY in ${elapsed}ms!`);
    console.log('  ✔ Authentication & JWT Rotation');
    console.log('  ✔ Role-Based Access Control (RBAC)');
    console.log('  ✔ Multi-Tenant Data Isolation');
    console.log('  ✔ Inventory Movements & Negative Stock Prevention');
    console.log('  ✔ Sales Engine & Minor Unit Arithmetic');
    console.log('  ✔ Bank Transfer, Receipt Upload & Admin Verification');
    console.log('  ✔ Downloadable PDF Receipt & QR Verification');
    console.log('====================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST SUITE FAILED:');
    console.error(err);
    process.exit(1);
  }
}

main();
