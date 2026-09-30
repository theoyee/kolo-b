import assert from 'assert';
import { ROLE_PERMISSIONS } from '../backend/types';

export async function runRBACTests() {
  console.log('\n--- 🧪 TEST SUITE: Permissions & RBAC ---');

  assert.ok(ROLE_PERMISSIONS.OWNER.includes('*'), 'Owner must have wildcard (*) permissions');
  assert.ok(ROLE_PERMISSIONS.ADMIN.includes('members:manage'), 'Admin must have members:manage permission');
  assert.ok(ROLE_PERMISSIONS.CASHIER.includes('sales:create'), 'Cashier must have sales:create permission');
  assert.strictEqual(
    ROLE_PERMISSIONS.CASHIER.includes('settings:manage'),
    false,
    'Cashier must NOT have settings:manage permission'
  );
  assert.strictEqual(
    ROLE_PERMISSIONS.CASHIER.includes('inventory:adjust'),
    false,
    'Cashier must NOT have inventory:adjust permission'
  );
  console.log('  ✔ Role permissions matrix validated');

  console.log('✅ RBAC tests passed!\n');
}
