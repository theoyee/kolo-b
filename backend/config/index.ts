import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  apiPrefix: '/api/v1',
  
  // Database & Cache
  databaseUrl: process.env.DATABASE_URL || 'postgresql://kolo_user:kolo_secure_pass_2026@localhost:5432/kolo_db?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Authentication & Security
  jwtSecret: process.env.JWT_SECRET || 'kolo_super_secure_jwt_access_token_secret_key_2026_xyz',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'kolo_super_secure_jwt_refresh_token_secret_key_2026_abc',
  jwtRefreshExpiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '30', 10),
  saltRounds: 10,
  
  // Payment Gateways (Nigerian SME defaults)
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || 'sk_test_kolo_dummy_paystack_secret_key',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_kolo_dummy_paystack_public_key',
  },
  flutterwave: {
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY || 'FLWSECK_TEST-kolo_dummy_secret_key',
    secretHash: process.env.FLUTTERWAVE_SECRET_HASH || 'kolo_flw_webhook_secret_hash_2026',
  },

  // Business Defaults
  defaultCurrency: 'NGN',
  defaultCurrencySymbol: '₦',
  defaultVatRateBps: 750, // 7.5% Nigerian VAT
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '500', 10),
  rateLimitWindowMs: 60 * 1000,
} as const;
