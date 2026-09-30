import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { config } from './config';
import { globalErrorHandler } from './middlewares/errorHandler';

// Route modules
import { authRoutes } from './modules/auth/auth.routes';
import { businessRoutes } from './modules/businesses/business.routes';
import { memberRoutes } from './modules/members/member.routes';
import { productRoutes } from './modules/products/product.routes';
import { inventoryRoutes } from './modules/inventory/inventory.routes';
import { customerRoutes } from './modules/customers/customer.routes';
import { saleRoutes } from './modules/sales/sale.routes';
import { orderRoutes } from './modules/orders/order.routes';
import { paymentRoutes } from './modules/payments/payment.routes';
import { expenseRoutes } from './modules/expenses/expense.routes';
import { reportRoutes } from './modules/reports/report.routes';
import { settingRoutes } from './modules/settings/setting.routes';
import { auditRoutes } from './modules/audit/audit.routes';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    trustProxy: true,
  });

  app.register(helmet, { contentSecurityPolicy: false });

  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Business-Id',
      'Idempotency-Key',
      'x-idempotency-key',
      'x-paystack-signature',
      'verif-hash',
    ],
  });

  app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindowMs,
  });

  app.register(jwt, {
    secret: config.jwtSecret,
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: 'Kolo API - Nigerian SME Business Management Backend',
        description:
          'Multi-tenant, transactional SaaS backend for Nigerian retail & wholesale businesses. Primary payment flow: Direct bank transfers with receipt upload and admin verification.',
        version: '1.0.0',
      },
      servers: [{ url: 'http://localhost:3000' }],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          'BusinessId Header': {
            type: 'apiKey',
            name: 'X-Business-Id',
            in: 'header',
          },
        },
      },
    },
  });

  app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: { docExpansion: 'list' },
  });

  app.setErrorHandler(globalErrorHandler);

  // Root endpoint with API index
  app.get('/', async () => ({
    service: 'Kolo SME Business Management Backend API 🇳🇬',
    status: 'online',
    version: '1.0.0',
    documentation: '/documentation',
    healthCheck: '/health',
    endpoints: {
      auth: '/api/v1/auth',
      businesses: '/api/v1/businesses',
      members: '/api/v1/members',
      products: '/api/v1/products',
      inventory: '/api/v1/inventory',
      customers: '/api/v1/customers',
      sales: '/api/v1/sales',
      orders: '/api/v1/orders',
      payments: '/api/v1/payments',
      expenses: '/api/v1/expenses',
      reports: '/api/v1/reports',
      settings: '/api/v1/settings',
      auditLogs: '/api/v1/audit-logs',
    },
  }));

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'kolo-backend-api',
  }));

  // Register Core API Modules under /api/v1
  app.register(
    async (v1) => {
      v1.register(authRoutes, { prefix: '/auth' });
      v1.register(businessRoutes, { prefix: '/businesses' });
      v1.register(memberRoutes, { prefix: '/members' });
      v1.register(productRoutes, { prefix: '/products' });
      v1.register(inventoryRoutes, { prefix: '/inventory' });
      v1.register(customerRoutes, { prefix: '/customers' });
      v1.register(saleRoutes, { prefix: '/sales' });
      v1.register(orderRoutes, { prefix: '/orders' });
      v1.register(paymentRoutes, { prefix: '/payments' });
      v1.register(expenseRoutes, { prefix: '/expenses' });
      v1.register(reportRoutes, { prefix: '/reports' });
      v1.register(settingRoutes, { prefix: '/settings' });
      v1.register(auditRoutes, { prefix: '/audit-logs' });
    },
    { prefix: '/api/v1' }
  );

  return app;
}
