# Kolo — Nigerian SME Business Management Backend 🇳🇬

A production-ready, multi-tenant modular monolith backend for Nigerian retail and wholesale SMEs (supermarkets, distributors, pharmacies, agro-merchants, and provision stores). Built with **Fastify**, **TypeScript**, **PostgreSQL**, **Prisma**, **Redis + BullMQ**, **JWT + Refresh Token rotation**, and **Docker**.

---

## 💳 Payment Architecture & Bank Transfer Flow

Per operational requirements, **Direct Bank Transfer with Receipt Verification** is the primary active payment flow, while **Paystack** and **Flutterwave** gateway hooks are preserved in the architecture for future activation.

### 🏦 Official Business Bank Account & Admin Receipt Verification
1. **Retrieve Official Account**: Call `GET /api/v1/payments/bank-account` to fetch the business's official NUBAN account number (e.g. Moniepoint MFB, GTBank, Zenith), account name, and payment narration instructions.
2. **Transfer & Upload Proof**: The customer/cashier makes the bank transfer and submits proof via `POST /api/v1/payments/bank-transfer` with:
   - `transferReference` (NIBSS session ID or bank reference)
   - `receiptUrl` (image/screenshot or PDF link)
   - `senderName` & `senderBank` (e.g., "Alhaji Ibrahim Danjuma", "GTBank")
   - The payment is saved with `status: "PENDING"`.
3. **Admin Verification & Approval**: Any business Admin or Manager reviews the receipt and verifies it against the live business bank statement/app:
   - Call `POST /api/v1/payments/:id/verify-transfer` with `{ "status": "SUCCESS", "adminNotes": "Confirmed in Moniepoint app" }`.
   - On approval: Payment flips to `SUCCESS`, `verifiedByUserId` and `verifiedAt` are recorded, the sale balance is cleared, and customer debt ledger is updated in an atomic transaction.
4. **Gateway Integrations**: Paystack and Flutterwave webhook verifiers and SDK initializers remain dormant in `/api/v1/payments/webhooks/paystack` and `/api/v1/payments/initialize-online`, ready to be activated whenever API keys are toggled.

---

## 🌟 Key Architectural Principles

1. **Multi-Tenant Data Isolation**: Every business's products, stock, sales, customers, and financial ledger are strictly isolated by `businessId`. Requests resolve tenant context via `X-Business-Id` header or the authenticated user's active membership.
2. **Kobo Financial Precision**: All monetary values are strictly stored in integer minor units (**Kobo**, where `₦1.00 = 100 kobo`). Floating-point numbers are completely banned from database schemas and arithmetic.
3. **Transactional Sales Checkout Engine**: The product feature is called **Sales** (not POS). A checkout operation is executed within an ACID database transaction:
   $$\text{Sale Creation} \longrightarrow \text{Split Payments} \longrightarrow \text{Inventory Deduction} \longrightarrow \text{Customer Debt Adjustment}$$
4. **Zero-Negative-Stock Safeguards**: Enforces strict stock validation before checkout. If an item has insufficient stock, the transaction is rejected unless the business has explicitly toggled `allowNegativeStock: true` in its settings.
5. **Idempotency Protection**: Accepts an `Idempotency-Key` HTTP header on critical mutations (`/sales`, `/payments`). Duplicate requests replay the original response instantly.
6. **Role-Based Access Control (RBAC)**: Fine-grained permissions matrix across 5 standard roles:
   - **`OWNER`**: Full business ownership, billing, member management, and wildcard `*` permissions.
   - **`ADMIN`**: Catalog management, staff management, inventory adjustments, settings, receipt verification.
   - **`MANAGER`**: Daily store operations, inventory adjustments, sales voiding, receipt verification.
   - **`CASHIER`**: Sales checkout, customer registration, catalog browsing.
   - **`ACCOUNTANT`**: Financial reports, P&L statements, expense auditing, payment tracking.
7. **Asynchronous Background Jobs**: Uses BullMQ backed by Redis for offloading receipt SMS/WhatsApp dispatches, stock deficit alerts, and audit streaming (with automatic in-memory fallback for local development).

---

## 📁 Modular Project Structure

```
├── prisma/
│   ├── schema.prisma              # Database models, enums, indexes, and relations
│   ├── seed.ts                    # Realistic Nigerian SME seed data
│   └── migrations/                # Version-controlled SQL DDL migrations
├── backend/
│   ├── config/                    # Environment variables and gateway secrets
│   ├── errors/                    # AppError, InsufficientStockError, NotFoundError, etc.
│   ├── types/                     # Shared TypeScript interfaces & RBAC definitions
│   ├── utils/                     # Pagination, Kobo/Naira converters
│   ├── db/prisma.ts               # Prisma singleton with BigInt JSON serialization
│   ├── queue/bullmq.ts            # BullMQ queue & worker with resilience fallback
│   ├── middlewares/               # Auth, Tenant, RBAC, Idempotency, Audit, Error Handler
│   ├── modules/
│   │   ├── auth/                  # Register, login, refresh, logout, profile
│   │   ├── businesses/            # Tenant creation and profile management
│   │   ├── members/               # Staff invitations and RBAC updates
│   │   ├── products/              # Products catalog, barcodes, categories
│   │   ├── inventory/             # Stock adjustments and movement logs
│   │   ├── customers/             # Customer CRM and credit/debt ledger
│   │   ├── sales/                 # Multi-item checkout, VAT, split payments
│   │   ├── orders/                # SME quotations and order fulfillments
│   │   ├── payments/              # Direct bank transfers, receipt verification, webhooks
│   │   ├── expenses/              # Diesel fuel, generator, rent, utility expenses
│   │   ├── reports/               # P&L, daily summaries, top products, valuation
│   │   ├── settings/              # Bank account config, negative stock toggle, VAT
│   │   └── audit/                 # System audit log query
│   ├── app.ts                     # Fastify application builder & plugin registration
│   └── server.ts                  # Server entry point with graceful shutdown
├── tests/                         # Unit and integration test suites
├── docker-compose.yml             # App + Postgres + Redis orchestration
├── Dockerfile                     # Multi-stage production container build
├── .env.example                   # Environment configuration template
└── README.md
```

---

## 🚀 Quick Start Guide

```bash
# 1. Start Postgres & Redis
docker compose up -d postgres redis

# 2. Run Prisma Migrations & Seed Data
npm run db:generate
npx prisma migrate deploy
npm run db:seed

# 3. Run Test Suite
npm test

# 4. Start Fastify Server on Port 3000
npm run server
```

Open `http://localhost:3000/documentation` for Swagger UI.
