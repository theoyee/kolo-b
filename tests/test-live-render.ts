/**
 * Comprehensive Live API Test Runner for https://kolo-b.onrender.com
 * Tests all 43 registered OpenAPI endpoints on the live deployment.
 */

const BASE_URL = process.env.LIVE_URL || 'https://kolo-b.onrender.com';

interface TestRecord {
  endpoint: string;
  method: string;
  status: number;
  expected: number | number[];
  success: boolean;
  info?: string;
  error?: string;
}

const records: TestRecord[] = [];

async function callApi(
  method: string,
  path: string,
  opts: {
    body?: any;
    token?: string;
    businessId?: string;
    headers?: Record<string, string>;
  } = {}
) {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };

  if (opts.token) {
    headers['Authorization'] = `Bearer ${opts.token}`;
  }
  if (opts.businessId) {
    headers['X-Business-Id'] = opts.businessId;
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    const cType = res.headers.get('content-type') || '';
    let data: any = null;
    if (cType.includes('application/json')) {
      data = await res.json();
    } else if (cType.includes('application/pdf')) {
      const buf = await res.arrayBuffer();
      data = { isPdf: true, bytes: buf.byteLength };
    } else {
      data = await res.text();
    }

    return { status: res.status, data, headers: res.headers };
  } catch (err: any) {
    return { status: 0, data: null, error: err.message };
  }
}

function assertEndpoint(
  endpoint: string,
  method: string,
  status: number,
  expected: number | number[],
  info?: string,
  rawError?: any
) {
  const isOk = Array.isArray(expected) ? expected.includes(status) : status === expected;
  records.push({
    endpoint,
    method,
    status,
    expected,
    success: isOk,
    info,
    error: isOk ? undefined : JSON.stringify(rawError),
  });

  const mark = isOk ? '✔' : '✖';
  console.log(`  ${mark} [${method.toUpperCase()}] ${endpoint} => HTTP ${status} ${info ? `(${info})` : ''}`);
  if (!isOk && rawError) {
    console.log(`     Details: ${JSON.stringify(rawError).slice(0, 150)}`);
  }
}

async function startSuite() {
  console.log(`\n================================================================`);
  console.log(`🚀 COMPREHENSIVE LIVE API TEST FOR: ${BASE_URL}`);
  console.log(`================================================================\n`);

  const tId = Date.now().toString().slice(-6);
  const email = `test.owner.${tId}@nigerian-sme.ng`;
  const phone = `0802${Math.floor(1000000 + Math.random() * 8999999)}`;

  let token = '';
  let refreshToken = '';
  let businessId = '';
  let memberId = '';
  let categoryId = '';
  let productId = '';
  let product2Id = '';
  let customerId = '';
  let saleId = '';
  let saleNumber = '';
  let orderId = '';
  let bankPaymentId = '';

  // 1. SYSTEM & DISCOVERY ENDPOINTS
  console.log('📌 1. System & Discovery');
  const root = await callApi('GET', '/');
  assertEndpoint('/', 'GET', root.status, 200, root.data?.service, root.data);

  const health = await callApi('GET', '/health');
  assertEndpoint('/health', 'GET', health.status, 200, `Health: ${health.data?.status}`, health.data);

  const docs = await callApi('GET', '/documentation/json');
  assertEndpoint('/documentation/json', 'GET', docs.status, 200, `OpenAPI 3.0.3 paths: ${Object.keys(docs.data?.paths || {}).length}`, docs.data);

  // 2. AUTHENTICATION MODULE
  console.log('\n📌 2. Authentication & JWT');
  const reg = await callApi('POST', '/api/v1/auth/register', {
    body: {
      businessName: `Kolo Lagos Hub ${tId}`,
      businessType: 'RETAIL',
      firstName: 'Babajide',
      lastName: 'Sanwo',
      email,
      phone,
      password: 'SecurePassword123!',
    },
  });
  assertEndpoint('/api/v1/auth/register', 'POST', reg.status, [200, 201], `User: ${reg.data?.data?.user?.email}`, reg.data);

  if (reg.data?.data) {
    token = reg.data.data.tokens.accessToken;
    refreshToken = reg.data.data.tokens.refreshToken;
    businessId = reg.data.data.business.id;
  }

  const login = await callApi('POST', '/api/v1/auth/login', {
    body: { email, password: 'SecurePassword123!' },
  });
  assertEndpoint('/api/v1/auth/login', 'POST', login.status, 200, 'JWT issuance', login.data);
  if (login.data?.data?.tokens) {
    token = login.data.data.tokens.accessToken;
    refreshToken = login.data.data.tokens.refreshToken;
  }

  const me = await callApi('GET', '/api/v1/auth/me', { token, businessId });
  assertEndpoint('/api/v1/auth/me', 'GET', me.status, 200, `Authenticated: ${me.data?.data?.user?.firstName}`, me.data);

  const refresh = await callApi('POST', '/api/v1/auth/refresh', { body: { refreshToken } });
  assertEndpoint('/api/v1/auth/refresh', 'POST', refresh.status, 200, 'Rotated access token', refresh.data);
  if (refresh.data?.data?.accessToken) {
    token = refresh.data.data.accessToken;
  }

  // 3. BUSINESSES MODULE
  console.log('\n📌 3. Businesses');
  const createBiz = await callApi('POST', '/api/v1/businesses/', {
    token,
    body: {
      name: `Kolo Abuja Branch ${tId}`,
      city: 'Abuja',
      state: 'FCT',
      currency: 'NGN',
    },
  });
  assertEndpoint('/api/v1/businesses/', 'POST', createBiz.status, [200, 201], createBiz.data?.data?.name, createBiz.data);

  const listBiz = await callApi('GET', '/api/v1/businesses/', { token });
  assertEndpoint('/api/v1/businesses/', 'GET', listBiz.status, 200, `Owned businesses: ${listBiz.data?.data?.length}`, listBiz.data);

  const getBiz = await callApi('GET', `/api/v1/businesses/${businessId}`, { token });
  assertEndpoint(`/api/v1/businesses/${businessId}`, 'GET', getBiz.status, 200, getBiz.data?.data?.name, getBiz.data);

  const updateBiz = await callApi('PATCH', `/api/v1/businesses/${businessId}`, {
    token,
    businessId,
    body: { address: 'Plot 44 Marina, Lagos Island' },
  });
  assertEndpoint(`/api/v1/businesses/${businessId}`, 'PATCH', updateBiz.status, 200, 'Updated business address', updateBiz.data);

  // 4. MEMBERS MODULE
  console.log('\n📌 4. Members & Team RBAC');
  const listMembers = await callApi('GET', '/api/v1/members/', { token, businessId });
  assertEndpoint('/api/v1/members/', 'GET', listMembers.status, 200, `Members count: ${listMembers.data?.data?.length}`, listMembers.data);

  const inviteMember = await callApi('POST', '/api/v1/members/invite', {
    token,
    businessId,
    body: {
      email: `cashier.${tId}@nigerian-sme.ng`,
      role: 'CASHIER',
      firstName: 'Chioma',
      lastName: 'Eze',
    },
  });
  assertEndpoint('/api/v1/members/invite', 'POST', inviteMember.status, [200, 201], `Invited CASHIER`, inviteMember.data);
  memberId = inviteMember.data?.data?.id;

  if (memberId) {
    const updateMember = await callApi('PATCH', `/api/v1/members/${memberId}`, {
      token,
      businessId,
      body: { role: 'MANAGER' },
    });
    assertEndpoint(`/api/v1/members/${memberId}`, 'PATCH', updateMember.status, 200, 'Promoted to MANAGER', updateMember.data);

    const deleteMember = await callApi('DELETE', `/api/v1/members/${memberId}`, { token, businessId });
    assertEndpoint(`/api/v1/members/${memberId}`, 'DELETE', deleteMember.status, [200, 204], 'Member removed', deleteMember.data);
  }

  // 5. PRODUCTS & CATEGORIES MODULE
  console.log('\n📌 5. Products & Categories');
  const createCat = await callApi('POST', '/api/v1/products/categories', {
    token,
    businessId,
    body: { name: `Groceries & Provisions ${tId}`, description: 'FMCG Wholesale' },
  });
  assertEndpoint('/api/v1/products/categories', 'POST', createCat.status, [200, 201], createCat.data?.data?.name, createCat.data);
  categoryId = createCat.data?.data?.id;

  const listCat = await callApi('GET', '/api/v1/products/categories', { token, businessId });
  assertEndpoint('/api/v1/products/categories', 'GET', listCat.status, 200, `Total categories: ${listCat.data?.data?.length}`, listCat.data);

  const createProd1 = await callApi('POST', '/api/v1/products/', {
    token,
    businessId,
    body: {
      name: 'Golden Penny Semovita 10kg',
      sku: `GPS-10KG-${tId}`,
      categoryId,
      costPriceKobo: 950000,    // ₦9,500.00
      sellingPriceKobo: 1150000, // ₦11,500.00
      initialStock: 50,
      minStockAlert: 10,
      unit: 'BAG',
    },
  });
  assertEndpoint('/api/v1/products/', 'POST', createProd1.status, [200, 201], createProd1.data?.data?.name, createProd1.data);
  productId = createProd1.data?.data?.id;

  const createProd2 = await callApi('POST', '/api/v1/products/', {
    token,
    businessId,
    body: {
      name: 'Dangote Sugar 50kg',
      sku: `DS-50KG-${tId}`,
      categoryId,
      costPriceKobo: 6800000,   // ₦68,000.00
      sellingPriceKobo: 7400000, // ₦74,000.00
      initialStock: 30,
      minStockAlert: 5,
      unit: 'BAG',
    },
  });
  product2Id = createProd2.data?.data?.id;

  const listProd = await callApi('GET', '/api/v1/products/', { token, businessId });
  assertEndpoint('/api/v1/products/', 'GET', listProd.status, 200, `Products: ${listProd.data?.data?.length}`, listProd.data);

  if (productId) {
    const getProd = await callApi('GET', `/api/v1/products/${productId}`, { token, businessId });
    assertEndpoint(`/api/v1/products/${productId}`, 'GET', getProd.status, 200, getProd.data?.data?.name, getProd.data);

    const patchProd = await callApi('PATCH', `/api/v1/products/${productId}`, {
      token,
      businessId,
      body: { sellingPriceKobo: 1200000 },
    });
    assertEndpoint(`/api/v1/products/${productId}`, 'PATCH', patchProd.status, 200, 'Price updated to ₦12,000', patchProd.data);
  }

  // 6. INVENTORY MODULE
  console.log('\n📌 6. Inventory Movements & Stock Control');
  if (productId) {
    const adjustStock = await callApi('POST', '/api/v1/inventory/adjust', {
      token,
      businessId,
      body: {
        productId,
        type: 'RESTOCK',
        quantity: 20,
        reason: 'Factory delivery from Flour Mills of Nigeria',
      },
    });
    assertEndpoint('/api/v1/inventory/adjust', 'POST', adjustStock.status, 200, `New stock: ${adjustStock.data?.data?.newStock}`, adjustStock.data);
  }

  const listMovements = await callApi('GET', '/api/v1/inventory/movements', { token, businessId });
  assertEndpoint('/api/v1/inventory/movements', 'GET', listMovements.status, 200, `Inventory audits: ${listMovements.data?.data?.length}`, listMovements.data);

  const listLowStock = await callApi('GET', '/api/v1/inventory/low-stock', { token, businessId });
  assertEndpoint('/api/v1/inventory/low-stock', 'GET', listLowStock.status, 200, `Low-stock products: ${listLowStock.data?.data?.length}`, listLowStock.data);

  // 7. CUSTOMERS MODULE
  console.log('\n📌 7. Customers & Debtors');
  const createCust = await callApi('POST', '/api/v1/customers/', {
    token,
    businessId,
    body: {
      fullName: 'Hajiya Fatima Aliko',
      phone: `0809${Math.floor(1000000 + Math.random() * 8999999)}`,
      email: `fatima.${tId}@kadunastore.ng`,
      address: '15 Ahmadu Bello Way, Kaduna',
    },
  });
  assertEndpoint('/api/v1/customers/', 'POST', createCust.status, [200, 201], createCust.data?.data?.fullName, createCust.data);
  customerId = createCust.data?.data?.id;

  const listCust = await callApi('GET', '/api/v1/customers/', { token, businessId });
  assertEndpoint('/api/v1/customers/', 'GET', listCust.status, 200, `Customers: ${listCust.data?.data?.length}`, listCust.data);

  if (customerId) {
    const getCust = await callApi('GET', `/api/v1/customers/${customerId}`, { token, businessId });
    assertEndpoint(`/api/v1/customers/${customerId}`, 'GET', getCust.status, 200, getCust.data?.data?.fullName, getCust.data);

    const patchCust = await callApi('PATCH', `/api/v1/customers/${customerId}`, {
      token,
      businessId,
      body: { address: '30 Ahmadu Bello Way, Kaduna' },
    });
    assertEndpoint(`/api/v1/customers/${customerId}`, 'PATCH', patchCust.status, 200, 'Customer address updated', patchCust.data);
  }

  // 8. SALES ENGINE, SPLIT PAYMENTS & RECEIPTS
  console.log('\n📌 8. Sales Engine & Receipts');
  if (productId) {
    const createSale = await callApi('POST', '/api/v1/sales/', {
      token,
      businessId,
      body: {
        customerId,
        items: [
          {
            productId,
            quantity: 2,
            unitSellingPriceKobo: 1200000,
            discountAmountKobo: 0,
          },
        ],
        applyVat: true,
        payments: [
          {
            method: 'CASH',
            amountKobo: 1000000, // ₦10,000 cash
          },
          {
            method: 'BANK_TRANSFER',
            amountKobo: 1580000, // remaining balance (24000 + 7.5% VAT = 25800 minus 10000 = 15800)
            reference: `NIBSS-TX-${tId}`,
          },
        ],
        notes: 'Semovita sale with cash and bank transfer split',
      },
    });
    assertEndpoint('/api/v1/sales/', 'POST', createSale.status, [200, 201], `Sale: ${createSale.data?.data?.saleNumber}`, createSale.data);
    saleId = createSale.data?.data?.id;
    saleNumber = createSale.data?.data?.saleNumber;
  }

  const listSales = await callApi('GET', '/api/v1/sales/', { token, businessId });
  assertEndpoint('/api/v1/sales/', 'GET', listSales.status, 200, `Sales count: ${listSales.data?.data?.length}`, listSales.data);

  if (saleId) {
    const getSale = await callApi('GET', `/api/v1/sales/${saleId}`, { token, businessId });
    assertEndpoint(`/api/v1/sales/${saleId}`, 'GET', getSale.status, 200, `Payment status: ${getSale.data?.data?.paymentStatus}`, getSale.data);

    // PDF Vector Receipt
    const receiptPdf = await callApi('GET', `/api/v1/sales/${saleId}/receipt-pdf`, { token, businessId });
    assertEndpoint(`/api/v1/sales/${saleId}/receipt-pdf`, 'GET', receiptPdf.status, 200, `Vector PDF (${receiptPdf.data?.bytes || 0} bytes)`, receiptPdf.data);

    // Public QR verification endpoint (no auth needed)
    if (saleNumber) {
      const verifySale = await callApi('GET', `/api/v1/sales/verify/${saleNumber}`);
      assertEndpoint(`/api/v1/sales/verify/${saleNumber}`, 'GET', verifySale.status, 200, `Verified store: ${verifySale.data?.data?.businessName}`, verifySale.data);
    }
  }

  // 9. ORDERS MODULE
  console.log('\n📌 9. Customer Orders');
  if (productId) {
    const createOrder = await callApi('POST', '/api/v1/orders/', {
      token,
      businessId,
      body: {
        customerId,
        items: [{ productId, quantity: 5, unitPriceKobo: 1200000 }],
        notes: 'Bulk order for Kaduna retail branch',
      },
    });
    assertEndpoint('/api/v1/orders/', 'POST', createOrder.status, [200, 201], `Order: ${createOrder.data?.data?.orderNumber}`, createOrder.data);
    orderId = createOrder.data?.data?.id;

    if (orderId) {
      const getOrder = await callApi('GET', `/api/v1/orders/${orderId}`, { token, businessId });
      assertEndpoint(`/api/v1/orders/${orderId}`, 'GET', getOrder.status, 200, `Status: ${getOrder.data?.data?.status}`, getOrder.data);

      const patchOrderStatus = await callApi('PATCH', `/api/v1/orders/${orderId}/status`, {
        token,
        businessId,
        body: { status: 'CONFIRMED' },
      });
      assertEndpoint(`/api/v1/orders/${orderId}/status`, 'PATCH', patchOrderStatus.status, 200, 'Order status -> CONFIRMED', patchOrderStatus.data);

      const fulfillOrder = await callApi('POST', `/api/v1/orders/${orderId}/fulfill`, {
        token,
        businessId,
      });
      assertEndpoint(`/api/v1/orders/${orderId}/fulfill`, 'POST', fulfillOrder.status, 200, 'Order fulfilled & stock decremented', fulfillOrder.data);
    }
  }

  const listOrders = await callApi('GET', '/api/v1/orders/', { token, businessId });
  assertEndpoint('/api/v1/orders/', 'GET', listOrders.status, 200, `Orders: ${listOrders.data?.data?.length}`, listOrders.data);

  // 10. PAYMENTS, BANK TRANSFERS & ADMIN VERIFICATION
  console.log('\n📌 10. Nigerian Bank Transfer Flow & Admin Verification');
  const getBankAcc = await callApi('GET', '/api/v1/payments/bank-account', { token, businessId });
  assertEndpoint('/api/v1/payments/bank-account', 'GET', getBankAcc.status, 200, `${getBankAcc.data?.data?.bankName} - ${getBankAcc.data?.data?.accountNumber}`, getBankAcc.data);

  const submitTransfer = await callApi('POST', '/api/v1/payments/bank-transfer', {
    token,
    businessId,
    body: {
      amountKobo: 5000000, // ₦50,000
      transferReference: `NIBSS-SESSION-${tId}`,
      receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      senderName: 'Hajiya Fatima Aliko',
      senderBank: 'Guaranty Trust Bank',
      notes: 'Transfer from GTBank mobile app',
    },
  });
  assertEndpoint('/api/v1/payments/bank-transfer', 'POST', submitTransfer.status, [200, 201], `Status: ${submitTransfer.data?.data?.status}`, submitTransfer.data);
  bankPaymentId = submitTransfer.data?.data?.id;

  const pendingTransfers = await callApi('GET', '/api/v1/payments/pending-transfers', { token, businessId });
  assertEndpoint('/api/v1/payments/pending-transfers', 'GET', pendingTransfers.status, 200, `Pending receipts queue: ${pendingTransfers.data?.data?.length}`, pendingTransfers.data);

  if (bankPaymentId) {
    const verifyTransfer = await callApi('POST', `/api/v1/payments/${bankPaymentId}/verify-transfer`, {
      token,
      businessId,
      body: {
        status: 'SUCCESS',
        adminNotes: 'Verified credit in Moniepoint MFB mobile app at 14:30',
      },
    });
    assertEndpoint(`/api/v1/payments/${bankPaymentId}/verify-transfer`, 'POST', verifyTransfer.status, 200, `Approved! Status: ${verifyTransfer.data?.data?.status}`, verifyTransfer.data);
  }

  const directPayment = await callApi('POST', '/api/v1/payments/', {
    token,
    businessId,
    body: {
      amountKobo: 2500000,
      method: 'POS_TERMINAL',
      reference: `STANBIC-POS-${tId}`,
    },
  });
  assertEndpoint('/api/v1/payments/', 'POST', directPayment.status, [200, 201], 'Recorded direct POS payment', directPayment.data);

  const listPayments = await callApi('GET', '/api/v1/payments/', { token, businessId });
  assertEndpoint('/api/v1/payments/', 'GET', listPayments.status, 200, `Total payments: ${listPayments.data?.data?.length}`, listPayments.data);

  const initOnline = await callApi('POST', '/api/v1/payments/initialize-online', {
    token,
    businessId,
    body: {
      amountKobo: 500000,
      gateway: 'PAYSTACK',
      customerEmail: 'customer@nigeria.ng',
    },
  });
  assertEndpoint('/api/v1/payments/initialize-online', 'POST', initOnline.status, 200, 'Online checkout initialization', initOnline.data);

  // 11. EXPENSES MODULE
  console.log('\n📌 11. Operating Expenses');
  const recordExp = await callApi('POST', '/api/v1/expenses/', {
    token,
    businessId,
    body: {
      category: 'DIESEL_GENERATOR',
      title: '50L Diesel purchase for Mikano gen',
      amountKobo: 6500000, // ₦65,000
      payee: 'NNPC Retail Station Marina',
    },
  });
  assertEndpoint('/api/v1/expenses/', 'POST', recordExp.status, [200, 201], recordExp.data?.data?.title, recordExp.data);

  const listExp = await callApi('GET', '/api/v1/expenses/', { token, businessId });
  assertEndpoint('/api/v1/expenses/', 'GET', listExp.status, 200, `Expenses count: ${listExp.data?.data?.length}`, listExp.data);

  const expSummary = await callApi('GET', '/api/v1/expenses/summary', { token, businessId });
  assertEndpoint('/api/v1/expenses/summary', 'GET', expSummary.status, 200, `Total expenses: ₦${((expSummary.data?.data?.totalExpensesKobo || 0) / 100).toLocaleString()}`, expSummary.data);

  // 12. REPORTS & BUSINESS INTELLIGENCE
  console.log('\n📌 12. Reports & Analytics');
  const dailySummary = await callApi('GET', '/api/v1/reports/daily-summary', { token, businessId });
  assertEndpoint('/api/v1/reports/daily-summary', 'GET', dailySummary.status, 200, `Today sales: ₦${((dailySummary.data?.data?.totalSalesRevenueKobo || 0) / 100).toLocaleString()}`, dailySummary.data);

  const pnl = await callApi('GET', '/api/v1/reports/profit-loss', { token, businessId });
  assertEndpoint('/api/v1/reports/profit-loss', 'GET', pnl.status, 200, `Net profit: ₦${((pnl.data?.data?.netProfitKobo || 0) / 100).toLocaleString()}`, pnl.data);

  const topProds = await callApi('GET', '/api/v1/reports/top-products', { token, businessId });
  assertEndpoint('/api/v1/reports/top-products', 'GET', topProds.status, 200, `Top product rank count: ${topProds.data?.data?.length}`, topProds.data);

  const invVal = await callApi('GET', '/api/v1/reports/inventory-valuation', { token, businessId });
  assertEndpoint('/api/v1/reports/inventory-valuation', 'GET', invVal.status, 200, `Inventory valuation: ₦${((invVal.data?.data?.totalRetailValueKobo || 0) / 100).toLocaleString()}`, invVal.data);

  // 13. SETTINGS MODULE
  console.log('\n📌 13. Business Settings');
  const getSettings = await callApi('GET', '/api/v1/settings/', { token, businessId });
  assertEndpoint('/api/v1/settings/', 'GET', getSettings.status, 200, `Negative stock allowed: ${getSettings.data?.data?.allowNegativeStock}`, getSettings.data);

  const patchSettings = await callApi('PATCH', '/api/v1/settings/', {
    token,
    businessId,
    body: {
      vatRateBps: 750,
      allowNegativeStock: false,
      receiptNotes: 'Kolo Business Suite: Thank you for shopping with us!',
    },
  });
  assertEndpoint('/api/v1/settings/', 'PATCH', patchSettings.status, 200, 'Settings successfully patched', patchSettings.data);

  // 14. AUDIT LOGS MODULE
  console.log('\n📌 14. Security Audit Logs');
  const auditLogs = await callApi('GET', '/api/v1/audit-logs/', { token, businessId });
  assertEndpoint('/api/v1/audit-logs/', 'GET', auditLogs.status, 200, `Recorded audit logs: ${auditLogs.data?.data?.length}`, auditLogs.data);

  // 15. VOID SALE & CLEANUP
  console.log('\n📌 15. Lifecycle & Deletion Endpoints');
  if (saleId) {
    const voidSale = await callApi('POST', `/api/v1/sales/${saleId}/void`, {
      token,
      businessId,
      body: { reason: 'Customer requested return of items' },
    });
    assertEndpoint(`/api/v1/sales/${saleId}/void`, 'POST', voidSale.status, [200, 201], 'Sale voided & stock restored', voidSale.data);
  }

  if (product2Id) {
    const delProd = await callApi('DELETE', `/api/v1/products/${product2Id}`, { token, businessId });
    assertEndpoint(`/api/v1/products/${product2Id}`, 'DELETE', delProd.status, [200, 204], 'Product deleted', delProd.data);
  }

  const logout = await callApi('POST', '/api/v1/auth/logout', { token, body: { refreshToken } });
  assertEndpoint('/api/v1/auth/logout', 'POST', logout.status, 200, 'Session cleared', logout.data);

  // SUMMARY & METRICS
  const total = records.length;
  const passed = records.filter((r) => r.success).length;
  const failed = total - passed;
  const pct = Math.round((passed / total) * 100);

  console.log(`\n================================================================`);
  console.log(`📊 TEST REPORT FOR ${BASE_URL}`);
  console.log(`================================================================`);
  console.log(`Total Endpoints Tested : ${total}`);
  console.log(`Endpoints Passed       : ${passed}`);
  console.log(`Endpoints Failed       : ${failed}`);
  console.log(`Success Rate           : ${pct}%`);
  console.log(`================================================================\n`);
}

startSuite().catch((err) => {
  console.error('Fatal testing error:', err);
  process.exit(1);
});
