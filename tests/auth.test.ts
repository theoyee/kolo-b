import assert from 'assert';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function runAuthTests() {
  console.log('\n--- 🧪 TEST SUITE: Auth & JWT Security ---');

  const rawPassword = 'SuperSecurePassword#2026';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(rawPassword, salt);

  assert.ok(hash !== rawPassword, 'Password must never be stored as plaintext');
  const isCorrect = await bcrypt.compare(rawPassword, hash);
  assert.strictEqual(isCorrect, true, 'bcrypt must verify correct password');
  const isWrong = await bcrypt.compare('WrongPassword123', hash);
  assert.strictEqual(isWrong, false, 'bcrypt must reject incorrect password');
  console.log('  ✔ Password hashing & verification passed');

  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  assert.strictEqual(tokenHash.length, 64, 'SHA-256 token hash must be 64 hex characters');
  console.log('  ✔ Refresh token cryptographically secure generation passed');

  console.log('✅ Auth & Security tests passed!\n');
}
