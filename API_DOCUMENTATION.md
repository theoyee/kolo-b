# 🇳🇬 Kolo SME Backend API Reference Documentation

> **Base URL (Production - Render):** `https://kolo-b.onrender.com`  
> **Interactive Swagger UI:** [https://kolo-b.onrender.com/documentation](https://kolo-b.onrender.com/documentation)  
> **OpenAPI 3.0 JSON:** `https://kolo-b.onrender.com/documentation/json`  
> **Local Development:** `http://localhost:3000`

---

## 📑 Table of Contents

1. [Architectural Overview & Core Conventions](#1-architectural-overview--core-conventions)
2. [Authentication & Multi-Tenant Headers](#2-authentication--multi-tenant-headers)
3. [Standard Error Format](#3-standard-error-format)
4. [Endpoints Reference](#4-endpoints-reference)
   - [System & Health](#system--health)
   - [Authentication & User Profile](#authentication--user-profile)
   - [Businesses (Multi-Tenancy)](#businesses-multi-tenancy)
   - [Staff Members & Role-Based Access Control (RBAC)](#staff-members--role-based-access-control-rbac)
   - [Products & Categories](#products--categories)
   - [Inventory & Stock Control](#inventory--stock-control)
   - [Customers & Debtors](#customers--debtors)
   - [Sales Engine, PDF Receipts & QR Verification](#sales-engine-pdf-receipts--qr-verification)
   - [Customer Orders & Wholesale Quotes](#customer-orders--wholesale-quotes)
   - [Nigerian Bank Transfers & Admin Verification](#nigerian-bank-transfers--admin-verification)
   - [Operating Expenses (Diesel, Rent, Salaries)](#operating-expenses-diesel-rent-salaries)
   - [Reports & Business Intelligence](#reports--business-intelligence)
   - [Business Settings](#business-settings)
   - [Security Audit Logs](#security-audit-logs)
   - [Payment Gateway Webhooks](#payment-gateway-webhooks)
5. [Client Integration Example (TypeScript / JavaScript)](#5-client-integration-example-typescript--javascript)

---

## 1. Architectural Overview & Core Conventions

### 🇳🇬 Nigerian Currency Precision (Strict Minor Units — Kobo)
All monetary values in requests and responses are strictly stored and computed as **positive integers in Kobo** (`100 Kobo = ₦1.00`).
- `₦5,000.00` is represented as `500000`
- `₦12,500.50` is represented as `1250050`
- **Floating point math is strictly forbidden** to eliminate rounding drift across invoices, ledger balances, and bank statements.

### 🏢 Multi-Tenant Data Isolation
Every business store or branch is strictly isolated by `businessId`. All tenant resources (products, categories, stock, sales, expenses, customers, staff, audit logs) require resolving the tenant context via:
- The HTTP Header: `X-Business-Id: <business-uuid>`
- The user's active membership resolved from the JWT token.

### 🛡️ Role-Based Access Control (RBAC)
User permissions are verified using role hierarchies:
- **`OWNER`**: Complete ownership, business profile modification, bank details setup, wildcard `*` permissions.
- **`ADMIN`**: Catalog management, staff management, inventory adjustments, settings, receipt verification.
- **`MANAGER`**: Daily store management, inventory adjustments, sales voiding, receipt verification.
- **`CASHIER`**: POS checkout, customer creation, catalog browsing.
- **`ACCOUNTANT`**: Financial reports, P&L statements, expense auditing, payment tracking.

---

## 2. Authentication & Multi-Tenant Headers

Most endpoints require authentication. Include the JWT access token and active business ID in request headers:

```http
Authorization: Bearer <accessToken>
X-Business-Id: <businessId>
Content-Type: application/json
```

### Optional Idempotency Header
For payment submissions and sales checkout, you can provide an `Idempotency-Key` header:
```http
Idempotency-Key: c9b1d1f0-4e2b-42b7-848e-28c04e2849b2
```
If a duplicate request is received within 24 hours, the cached original response is returned without re-executing stock deductions or payment captures.

---

## 3. Standard Error Format

All responses follow a predictable JSON schema. Successful calls return `{ "success": true, "data": ... }`. Errors return `{ "success": false, "error": ... }`:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data provided",
    "details": [
      {
        "field": "sellingPriceKobo",
        "message": "Selling price must be greater than zero in kobo",
        "rule": "invalid_type"
      }
    ]
  }
}
```

### Common HTTP Error Codes
| Code | Error Name | Meaning |
|---|---|---|
| `400` | `BAD_REQUEST` / `VALIDATION_ERROR` | Malformed body, missing required fields, or illegal argument. |
| `401` | `UNAUTHORIZED` | Missing, expired, or invalid JWT Bearer token. |
| `403` | `FORBIDDEN` | Authenticated user lacks the RBAC permission for this resource. |
| `404` | `NOT_FOUND` | The requested entity does not exist or does not belong to your business. |
| `409` | `CONFLICT` | Resource already exists (e.g. duplicate email or SKU). |
| `422` | `INSUFFICIENT_STOCK` | Product inventory level is lower than the requested sale quantity. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server exception. |

---

## 4. Endpoints Reference

### System & Health

#### 1. API Root Discovery
- **`GET /`**
- **Auth:** Public
- **Description:** Returns API branding and version status.
- **Response:**
  ```json
  {
    "service": "Kolo SME Business Management Backend API 🇳🇬",
    "status": "operational",
    "version": "1.0.0",
    "docs": "/documentation"
  }
  ```

#### 2. Health Probe
- **`GET /health`**
- **Auth:** Public
- **Description:** Health check for load balancers (Render, Cloud Run, Kubernetes).
- **Response:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-09-30T14:17:36.746Z",
    "service": "kolo-backend-api"
  }
  ```

---

### Authentication & User Profile

#### 3. Register Business & Owner Account
- **`POST /api/v1/auth/register`**
- **Auth:** Public
- **Body:**
  ```json
  {
    "businessName": "Alaba Electronics Ventures",
    "businessType": "RETAIL",
    "firstName": "Emeka",
    "lastName": "Okafor",
    "email": "emeka@alabaelectronics.ng",
    "phone": "08031234567",
    "password": "SecurePassword123!"
  }
  ```
- **Response (201):**
  ```json
  {
    "success": true,
    "message": "Account successfully registered",
    "data": {
      "user": {
        "id": "2394d547-c10b-479e-8516-168f17549a1a",
        "email": "emeka@alabaelectronics.ng",
        "firstName": "Emeka",
        "lastName": "Okafor",
        "phone": "08031234567"
      },
      "business": {
        "id": "eb225aa1-56d4-49c6-ad1d-813567b19586",
        "name": "Alaba Electronics Ventures",
        "slug": "alaba-electronics-ventures",
        "role": "OWNER"
      },
      "tokens": {
        "accessToken": "eyJhbGciOiJIUzI1Ni...",
        "refreshToken": "5bec4280a3c66aff9b73...",
        "expiresIn": "1h"
      }
    }
  }
  ```

#### 4. Login User
- **`POST /api/v1/auth/login`**
- **Auth:** Public
- **Body:**
  ```json
  {
    "email": "emeka@alabaelectronics.ng",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200):** Returns user profile, active memberships, and JWT tokens.

#### 5. Get Current User Profile
- **`GET /api/v1/auth/me`**
- **Auth:** Bearer Token
- **Response (200):** Current authenticated user and their business memberships.

#### 6. Refresh Access Token (Rotation)
- **`POST /api/v1/auth/refresh`**
- **Auth:** Public
- **Body:**
  ```json
  {
    "refreshToken": "5bec4280a3c66aff9b73..."
  }
  ```
- **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1Ni..."
    }
  }
  ```

#### 7. Logout (Invalidate Refresh Token)
- **`POST /api/v1/auth/logout`**
- **Auth:** Bearer Token
- **Body:** `{ "refreshToken": "..." }`
- **Response (200):** `{ "success": true, "message": "Logged out successfully" }`

---

### Businesses (Multi-Tenancy)

#### 8. Create Additional Business Store / Branch
- **`POST /api/v1/businesses/`**
- **Auth:** Bearer Token
- **Body:**
  ```json
  {
    "name": "Alaba Electronics - Ikeja Branch",
    "legalName": "Alaba Electronics Nigeria Ltd",
    "rcNumber": "RC-1928374",
    "address": "Computer Village, Ikeja",
    "city": "Ikeja",
    "state": "Lagos",
    "phone": "08039876543",
    "currency": "NGN"
  }
  ```

#### 9. List User's Businesses
- **`GET /api/v1/businesses/`**
- **Auth:** Bearer Token
- **Response (200):** List of all businesses the user has an active membership in.

#### 10. Get Business Details
- **`GET /api/v1/businesses/:id`**
- **Auth:** Bearer Token

#### 11. Update Business Details
- **`PATCH /api/v1/businesses/:id`**
- **Auth:** Bearer Token + `X-Business-Id` (`OWNER` or `ADMIN` permission)

---

### Staff Members & Role-Based Access Control (RBAC)

#### 12. List Business Staff
- **`GET /api/v1/members/`**
- **Auth:** Bearer Token + `X-Business-Id`

#### 13. Invite / Add Staff Member
- **`POST /api/v1/members/invite`**
- **Auth:** Bearer Token + `X-Business-Id` (`OWNER` or `ADMIN`)
- **Body:**
  ```json
  {
    "email": "amina.cashier@store.ng",
    "role": "CASHIER",
    "firstName": "Amina",
    "lastName": "Bello"
  }
  ```
- **Allowed Roles:** `'OWNER'`, `'ADMIN'`, `'MANAGER'`, `'CASHIER'`, `'ACCOUNTANT'`

#### 14. Update Staff Role / Status
- **`PATCH /api/v1/members/:id`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Body:** `{ "role": "MANAGER", "isActive": true }`

#### 15. Deactivate Staff Member
- **`DELETE /api/v1/members/:id`**
- **Auth:** Bearer Token + `X-Business-Id`

---

### Products & Categories

#### 16. Create Product Category
- **`POST /api/v1/products/categories`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Body:**
  ```json
  {
    "name": "Refrigerators & Freezers",
    "description": "Chest freezers and double-door fridges"
  }
  ```

#### 17. List Product Categories
- **`GET /api/v1/products/categories`**

#### 18. Create Product
- **`POST /api/v1/products/`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Body:**
  ```json
  {
    "name": "Haier Thermocool 200L Chest Freezer",
    "sku": "HTF-200L-SILVER",
    "barcode": "8901234567890",
    "categoryId": "4b6e5e8a-...",
    "unit": "PIECE",
    "costPriceKobo": 24000000,
    "sellingPriceKobo": 28500000,
    "initialStock": 25,
    "minStockAlert": 5
  }
  ```
  *(Note: `24000000` kobo = ₦240,000.00; `28500000` kobo = ₦285,000.00)*

#### 19. List Products (Paginated with Search & Filters)
- **`GET /api/v1/products/?page=1&limit=20&search=Freezer&categoryId=...`**

#### 20. Get Product by ID
- **`GET /api/v1/products/:id`**

#### 21. Update Product
- **`PATCH /api/v1/products/:id`**
- **Body:** `{ "sellingPriceKobo": 29000000, "minStockAlert": 8 }`

#### 22. Delete Product
- **`DELETE /api/v1/products/:id`**

---

### Inventory & Stock Control

#### 23. Adjust Inventory / Restock
- **`POST /api/v1/inventory/adjust`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Body:**
  ```json
  {
    "productId": "35e52372-615e-43ad-ad9d-22d072c45706",
    "type": "RESTOCK",
    "quantity": 10,
    "reason": "Shipment arrival from Apapa Wharf container"
  }
  ```
- **Allowed Movement Types:** `'RESTOCK'`, `'SALE_DEDUCTION'`, `'DAMAGE'`, `'LOSS'`, `'RETURN'`, `'ADJUSTMENT'`

#### 24. Inventory Movement Audit Trail
- **`GET /api/v1/inventory/movements?productId=...&page=1&limit=50`**
- **Description:** Complete chronological audit trail of all quantity deltas, movement types, and timestamps.

#### 25. Low-Stock Alerts
- **`GET /api/v1/inventory/low-stock`**
- **Description:** Returns all products whose `currentStock <= minStockAlert`.

---

### Customers & Debtors

#### 26. Create Customer
- **`POST /api/v1/customers/`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Body:**
  ```json
  {
    "fullName": "Alhaji Musa Danladi",
    "phone": "08141234567",
    "email": "musa@kanotraders.ng",
    "address": "24 Commercial Avenue, Kano",
    "initialBalanceKobo": 0
  }
  ```

#### 27. List Customers (With Outstanding Balances)
- **`GET /api/v1/customers/?search=Musa&page=1`**

#### 28. Get Customer Details
- **`GET /api/v1/customers/:id`**
- **Response:** Returns customer profile and total outstanding debt balance.

#### 29. Update Customer
- **`PATCH /api/v1/customers/:id`**

---

### Sales Engine, PDF Receipts & QR Verification

#### 30. Create Sale (POS Checkout with Split Payment & VAT)
- **`POST /api/v1/sales/`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Header (Optional):** `Idempotency-Key: <unique-uuid>`
- **Body:**
  ```json
  {
    "customerId": "d1b57a13-e7ad-4d94-8a1a-ff84d6bcf3c2",
    "items": [
      {
        "productId": "35e52372-615e-43ad-ad9d-22d072c45706",
        "quantity": 2,
        "unitSellingPriceKobo": 28500000,
        "discountAmountKobo": 1000000
      }
    ],
    "applyVat": true,
    "discountAmountKobo": 0,
    "payments": [
      {
        "method": "CASH",
        "amountKobo": 20000000
      },
      {
        "method": "BANK_TRANSFER",
        "amountKobo": 39775000,
        "reference": "NIBSS-SESSION-9921",
        "receiptUrl": "https://storage.googleapis.com/.../receipt.jpg"
      }
    ],
    "notes": "Split payment with cash and direct bank transfer"
  }
  ```
- **Response (201):**
  ```json
  {
    "success": true,
    "message": "Sale completed successfully",
    "data": {
      "id": "a4bb3711-0289-4231-93d0-e3a765845690",
      "saleNumber": "SALE-2026-00001",
      "subtotalKobo": 56000000,
      "taxAmountKobo": 3775000,
      "grandTotalKobo": 59775000,
      "amountPaidKobo": 59775000,
      "balanceDueKobo": 0,
      "paymentStatus": "SUCCESS",
      "status": "COMPLETED",
      "receiptFormatted": {
        "receiptNumber": "SALE-2026-00001",
        "formattedTotal": "₦597,750.00",
        "currency": "NGN"
      }
    }
  }
  ```

#### 31. List Sales Transactions
- **`GET /api/v1/sales/?page=1&limit=20&status=COMPLETED`**

#### 32. Get Sale Details
- **`GET /api/v1/sales/:id`**

#### 33. Download Vector PDF Receipt
- **`GET /api/v1/sales/:id/receipt-pdf`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Response:** Binary stream of `application/pdf` with vector typography, 7.5% Nigerian VAT breakdown, itemized line tables, and an embedded verification QR Code.

#### 34. Verify Sale via QR Code
- **`GET /api/v1/sales/verify/:saleNumber`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "isValid": true,
      "saleNumber": "SALE-2026-00001",
      "businessName": "Alaba Electronics Ventures",
      "status": "COMPLETED",
      "paymentStatus": "SUCCESS",
      "grandTotalKobo": 59775000,
      "formattedTotal": "₦597,750.00",
      "itemCount": 2,
      "customerName": "Alhaji Musa Danladi"
    }
  }
  ```

#### 35. Void Sale & Restore Inventory
- **`POST /api/v1/sales/:id/void`**
- **Auth:** Bearer Token + `X-Business-Id` (`OWNER`, `ADMIN`, or `MANAGER`)
- **Body:** `{ "reason": "Customer cancelled goods at the counter" }`
- **Response (200):** Reverses payments, voids the receipt, and automatically restocks all products in an atomic transaction.

---

### Customer Orders & Wholesale Quotes

#### 36. Create Wholesale Order / Quotation
- **`POST /api/v1/orders/`**
- **Body:**
  ```json
  {
    "customerId": "d1b57a13-e7ad-4d94-8a1a-ff84d6bcf3c2",
    "items": [
      {
        "productId": "35e52372-615e-43ad-ad9d-22d072c45706",
        "quantity": 5,
        "unitPriceKobo": 28500000
      }
    ],
    "notes": "Bulk order to be dispatched upon confirmation"
  }
  ```

#### 37. List Orders
- **`GET /api/v1/orders/?status=DRAFT`**

#### 38. Get Order by ID
- **`GET /api/v1/orders/:id`**

#### 39. Update Order Status
- **`PATCH /api/v1/orders/:id/status`**
- **Body:** `{ "status": "CONFIRMED" }`
- **Allowed Statuses:** `'DRAFT'`, `'CONFIRMED'`, `'COMPLETED'`, `'CANCELLED'`

#### 40. Fulfill Order into Completed Sale
- **`POST /api/v1/orders/:id/fulfill`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Body:**
  ```json
  {
    "payments": [
      {
        "method": "BANK_TRANSFER",
        "amountKobo": 142500000,
        "reference": "NIBSS-BULK-TRANSFER-01"
      }
    ]
  }
  ```
- **Response (201):** Converts the quotation into an active Sale, decrements stock, records payments, and marks the order as `COMPLETED`.

---

### Nigerian Bank Transfers & Admin Verification

#### 41. Get Official Business Bank Account Details
- **`GET /api/v1/payments/bank-account`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Description:** Returns the business's official 10-digit NUBAN bank account for receiving customer transfers.
- **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "bankName": "Moniepoint Microfinance Bank",
      "accountNumber": "8239019201",
      "accountName": "Alaba Electronics Ventures",
      "instructions": "Transfer to this account and upload your payment receipt or enter session ID."
    }
  }
  ```

#### 42. Submit Bank Transfer with Receipt Proof
- **`POST /api/v1/payments/bank-transfer`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Body:**
  ```json
  {
    "saleId": "a4bb3711-0289-4231-93d0-e3a765845690",
    "amountKobo": 15000000,
    "transferReference": "NIBSS-SESSION-20260930-8812",
    "receiptUrl": "https://storage.googleapis.com/.../receipt.png",
    "senderName": "Alhaji Musa Danladi",
    "senderBank": "First Bank of Nigeria",
    "notes": "Paid from First Bank Mobile App"
  }
  ```
- **Response (201):** Payment saved with `status: "PENDING"`.

#### 43. List Pending Transfer Receipts (Admin Verification Queue)
- **`GET /api/v1/payments/pending-transfers`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Description:** Returns all bank transfer payments awaiting admin review against the business's bank app.

#### 44. Admin Verifies & Approves Transfer
- **`POST /api/v1/payments/:id/verify-transfer`**
- **Auth:** Bearer Token + `X-Business-Id` (`OWNER`, `ADMIN`, or `MANAGER`)
- **Body:**
  ```json
  {
    "status": "SUCCESS",
    "adminNotes": "Confirmed credit alert on Moniepoint Business App at 2:15 PM"
  }
  ```
- **Response (200):** Flips status to `SUCCESS`, clears balance due on the related sale, updates customer ledger, and logs an audit trail.

#### 45. Record Direct / POS Payment
- **`POST /api/v1/payments/`**
- **Body:**
  ```json
  {
    "saleId": "a4bb3711-...",
    "amountKobo": 2500000,
    "method": "POS_TERMINAL",
    "reference": "STANBIC-POS-TERM-881"
  }
  ```

#### 46. List All Payment Transactions
- **`GET /api/v1/payments/?method=BANK_TRANSFER&status=SUCCESS`**

#### 47. Initialize Online Payment Gateway (Paystack / Flutterwave)
- **`POST /api/v1/payments/initialize-online`**
- **Body:**
  ```json
  {
    "amountKobo": 500000,
    "gateway": "PAYSTACK",
    "customerEmail": "customer@gmail.com"
  }
  ```

---

### Operating Expenses (Diesel, Rent, Salaries)

#### 48. Record Business Expense
- **`POST /api/v1/expenses/`**
- **Auth:** Bearer Token + `X-Business-Id`
- **Body:**
  ```json
  {
    "category": "DIESEL_GENERATOR",
    "title": "50 Litres of Diesel for Mikano Generator",
    "amountKobo": 6500000,
    "payee": "NNPC Retail Station Marina",
    "receiptUrl": "https://storage.googleapis.com/.../fuel_receipt.jpg"
  }
  ```
- **Allowed Categories:** `'RENT'`, `'DIESEL_GENERATOR'`, `'SALARIES'`, `'UTILITIES'`, `'MAINTENANCE'`, `'SUPPLIES'`, `'MARKETING'`, `'LOGISTICS'`, `'OTHER'`

#### 49. List Expenses
- **`GET /api/v1/expenses/?category=DIESEL_GENERATOR&page=1`**

#### 50. Expense Category Summary & Aggregates
- **`GET /api/v1/expenses/summary`**
- **Response (200):** Total expenses in Kobo and breakdown grouped by category.

---

### Reports & Business Intelligence

#### 51. Daily Store Summary
- **`GET /api/v1/reports/daily-summary`**
- **Response (200):** Today's total sales count, gross revenue, collected cash/transfers, and total expenses.

#### 52. Profit & Loss Statement (P&L)
- **`GET /api/v1/reports/profit-loss`**
- **Response (200):** Revenue, Cost of Goods Sold (COGS), Gross Profit, Operating Expenses, and Net Profit.

#### 53. Top-Selling Products Ranking
- **`GET /api/v1/reports/top-products`**
- **Response (200):** Ranked list of best-performing products by volume and total generated revenue.

#### 54. Inventory Valuation
- **`GET /api/v1/reports/inventory-valuation`**
- **Response (200):** Total product count, aggregate unit quantity in stock, total cost valuation, and projected retail value.

---

### Business Settings

#### 55. Get Business Settings
- **`GET /api/v1/settings/`**
- **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "allowNegativeStock": false,
      "vatRateBps": 750,
      "currencySymbol": "₦",
      "bankName": "Moniepoint Microfinance Bank",
      "bankAccountNumber": "8239019201",
      "bankAccountName": "Alaba Electronics Ventures",
      "receiptNotes": "Goods sold in good condition are not returnable."
    }
  }
  ```

#### 56. Update Business Settings
- **`PATCH /api/v1/settings/`**
- **Auth:** Bearer Token + `X-Business-Id` (`OWNER` or `ADMIN`)
- **Body:**
  ```json
  {
    "allowNegativeStock": false,
    "vatRateBps": 750,
    "bankName": "Moniepoint Microfinance Bank",
    "bankAccountNumber": "8239019201",
    "bankAccountName": "Alaba Electronics Ventures",
    "receiptNotes": "Thank you for shopping with us!"
  }
  ```

---

### Security Audit Logs

#### 57. Query Audit Logs
- **`GET /api/v1/audit-logs/?page=1&limit=50`**
- **Auth:** Bearer Token + `X-Business-Id` (`OWNER`, `ADMIN`, or `ACCOUNTANT`)
- **Description:** Returns an immutable record of all sensitive business actions (sales voided, inventory restocked, staff invited, settings changed).

---

### Payment Gateway Webhooks

#### 58. Paystack Webhook
- **`POST /api/v1/payments/webhooks/paystack`**
- **Headers:** `x-paystack-signature: <HMAC-SHA512>`
- **Description:** Verifies signature against `PAYSTACK_SECRET_KEY` and updates payment transactions.

#### 59. Flutterwave Webhook
- **`POST /api/v1/payments/webhooks/flutterwave`**
- **Headers:** `verif-hash: <FLUTTERWAVE_SECRET_HASH>`
- **Description:** Verifies secret hash and reconciles customer payments.

---

## 5. Client Integration Example (TypeScript / JavaScript)

Here is a ready-to-use TypeScript client with automatic header injection and token refresh:

```typescript
// apiClient.ts
export class KoloClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private businessId: string | null = null;

  constructor(baseUrl: string = 'https://kolo-b.onrender.com') {
    this.baseUrl = baseUrl;
  }

  setSession(tokens: { accessToken: string; refreshToken: string }, businessId: string) {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.businessId = businessId;
  }

  async request<T = any>(method: string, path: string, body?: any): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    if (this.businessId) {
      headers['X-Business-Id'] = this.businessId;
    }

    let response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Auto-refresh on 401
    if (response.status === 401 && this.refreshToken && path !== '/api/v1/auth/refresh') {
      const refreshed = await this.refreshTokens();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      }
    }

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error?.message || 'API request failed');
    }
    return json;
  }

  private async refreshTokens(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      const data = await res.json();
      if (data.success && data.data?.accessToken) {
        this.accessToken = data.data.accessToken;
        return true;
      }
    } catch {
      // Fallback
    }
    return false;
  }
}
```
