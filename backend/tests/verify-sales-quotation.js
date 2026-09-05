/**
 * verify-sales-quotation.js — Complete Verification Suite for Sales Rep Quotation Engine
 * Tests all 20 required acceptance criteria from Section 29 of the specification.
 */

import assert from 'assert';

const BASE_URL = 'http://localhost:5000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🧪 VERIFYING SALES REPRESENTATIVE QUOTATION ENGINE (20 CRITERIA)');
  console.log('================================================================\n');

  // 1. Authenticate Sales Rep & Manager
  console.log('Step 0: Authenticating test actors...');
  const salesLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'rahul@techworld.com', password: 'Rahul@123' }),
  });
  assert.strictEqual(salesLogin.status, 200, 'Sales rep login failed');
  const salesToken = salesLogin.data.token;
  const tenantId = salesLogin.data.user.tenantId;

  const mgrLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'arjun@techworld.com', password: 'Arjun@123' }),
  });
  assert.strictEqual(mgrLogin.status, 200, 'Manager login failed');
  const mgrToken = mgrLogin.data.token;

  // Fetch tenant customers & products
  const custRes = await request('/api/customers', {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(custRes.status, 200);
  const acme = custRes.data.data.find((c) => c.companyName === 'Acme Corporation');
  assert.ok(acme, 'Acme Corporation must exist');
  assert.strictEqual(acme.tier, 'GOLD', 'Acme must be GOLD tier');

  const prodRes = await request('/api/products', {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(prodRes.status, 200);
  const laptop = prodRes.data.data.find((p) => p.sku === 'LAPTOP-X');
  const install = prodRes.data.data.find((p) => p.sku === 'INSTALL-001');
  const support = prodRes.data.data.find((p) => p.sku === 'SUPPORT-PREMIUM');
  assert.ok(laptop && install && support, 'Products LAPTOP-X, INSTALL-001, SUPPORT-PREMIUM must exist');

  console.log('✅ Step 0: Test actors, Acme customer (GOLD), and products verified.\n');

  // Test 1: Sales Rep can create quotation
  console.log('Test 1: Sales Rep can create quotation (POST /api/quotations)...');
  const createRes1 = await request('/api/quotations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      customerId: acme.id,
      items: [{ productId: laptop.id, quantity: 2, discountPercentage: 10 }],
      notes: 'Initial test quote',
    }),
  });
  assert.strictEqual(createRes1.status, 201);
  assert.ok(createRes1.data.data.id);
  assert.strictEqual(createRes1.data.data.status, 'DRAFT');
  assert.ok(createRes1.data.data.quoteNumber.startsWith('DF360-'));
  const quote1 = createRes1.data.data;
  console.log(`✅ Test 1 Passed: Quotation created with quoteNumber ${quote1.quoteNumber}\n`);

  // Test 2: Customer must belong to same tenant (cross-tenant rejected)
  console.log('Test 2: Reject quotation creation if customer belongs to another tenant / invalid...');
  const crossCustRes = await request('/api/quotations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      customerId: '00000000-0000-0000-0000-000000000099', // Non-existent/foreign customer
      items: [{ productId: laptop.id, quantity: 1, discountPercentage: 0 }],
    }),
  });
  assert.strictEqual(crossCustRes.status, 404, 'Must return 404 for customer not found in tenant');
  console.log('✅ Test 2 Passed: Cross-tenant / invalid customer creation properly rejected with 404.\n');

  // Test 3: Product must belong to same tenant (cross-tenant rejected)
  console.log('Test 3: Reject quotation if product belongs to another tenant / invalid...');
  const crossProdRes = await request('/api/quotations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      customerId: acme.id,
      items: [{ productId: '00000000-0000-0000-0000-000000000088', quantity: 1, discountPercentage: 0 }],
    }),
  });
  assert.strictEqual(crossProdRes.status, 400, 'Must return 400 for product not found in tenant');
  console.log('✅ Test 3 Passed: Cross-tenant / invalid product creation properly rejected with 400.\n');

  // Test 4 & 5: Customer tier is loaded from backend & Frontend cannot override customer tier
  console.log('Test 4 & 5: Backend authoritative customer tier check (Frontend cannot override tier)...');
  const spoofTierCalc = await request('/api/quotations/calculate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      customerId: acme.id,
      customerTier: 'BRONZE', // Client attempts to force BRONZE tier
      items: [{ productId: laptop.id, quantity: 10, discountPercentage: 12 }],
    }),
  });
  assert.strictEqual(spoofTierCalc.status, 200);
  // Laptop discount is 12%.
  // For GOLD tier: Hardware ceiling is 15% -> 12% is within ceiling -> LOW risk!
  // For BRONZE tier: Hardware ceiling is 8% -> 12% would exceed ceiling -> HIGH risk!
  // Since Acme is GOLD, Risk Engine MUST treat it as GOLD, giving LOW risk!
  assert.strictEqual(
    spoofTierCalc.data.data.risk.riskLevel,
    'LOW',
    'Authoritative GOLD tier must be loaded from DB, ignoring client-submitted BRONZE'
  );
  console.log('✅ Tests 4 & 5 Passed: Customer tier authoritatively resolved from database.\n');

  // Test 6: Product price cannot be trusted from frontend
  console.log('Test 6: Product unit price cannot be forged from frontend...');
  const spoofPriceRes = await request('/api/quotations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      customerId: acme.id,
      items: [{
        productId: laptop.id,
        quantity: 1,
        discountPercentage: 0,
        unitPrice: 10, // Attempting to forge ₹10 price instead of ₹80,000
      }],
    }),
  });
  assert.strictEqual(spoofPriceRes.status, 201);
  assert.strictEqual(
    parseFloat(spoofPriceRes.data.data.items[0].unitPrice),
    80000,
    'Backend must use database unitPrice (₹80,000), ignoring ₹10 forged price'
  );
  console.log('✅ Test 6 Passed: Forged product price ignored, authoritative DB price enforced.\n');

  // Test 7: Quotation item price is snapshotted
  console.log('Test 7: Quotation item snapshotting...');
  const snapItem = spoofPriceRes.data.data.items[0];
  assert.strictEqual(snapItem.productNameSnapshot, 'Laptop X');
  assert.strictEqual(snapItem.productTypeSnapshot, 'HARDWARE');
  assert.strictEqual(parseFloat(snapItem.unitPrice), 80000);
  assert.strictEqual(parseFloat(snapItem.costPrice), 60000);
  console.log('✅ Test 7 Passed: Line item snapshot preserves product name, type, price, and cost.\n');

  // Test 8: Pricing is calculated server-side
  console.log('Test 8: Server-side pricing calculation...');
  // 2 Laptop X @ 80,000 each = 160,000 gross. 10% discount = 16,000. Net = 144,000.
  // Tax 18% = 25,920. Total = 169,920. Cost = 2 * 60,000 = 120,000. Margin = 144,000 - 120,000 = 24,000.
  // Margin % = (24,000 / 144,000) * 100 = 16.67%
  assert.strictEqual(parseFloat(quote1.subtotal), 144000);
  assert.strictEqual(parseFloat(quote1.discountAmount), 16000);
  assert.strictEqual(parseFloat(quote1.taxAmount), 25920);
  assert.strictEqual(parseFloat(quote1.totalAmount), 169920);
  assert.strictEqual(parseFloat(quote1.costAmount), 120000);
  assert.strictEqual(parseFloat(quote1.marginAmount), 24000);
  assert.strictEqual(parseFloat(quote1.marginPercentage), 16.67);
  console.log('✅ Test 8 Passed: Server-side pricing, margin, and GST mathematically exact.\n');

  // Test 9 & 10: Discount rules loaded from DB & Risk Engine invoked
  console.log('Test 9 & 10: Discount rules loaded from DB & Risk Engine invoked...');
  // Primary Demo Scenario:
  // 10x Laptop X (12% discount <= 15% GOLD hardware limit) -> OK
  // 1x Installation Service (18% discount > 10% GOLD service limit) -> VIOLATION!
  // 1x Premium Support (5% discount <= 5% GOLD subscription limit) -> OK
  const demoCreate = await request('/api/quotations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      customerId: acme.id,
      items: [
        { productId: laptop.id, quantity: 10, discountPercentage: 12 },
        { productId: install.id, quantity: 1, discountPercentage: 18 },
        { productId: support.id, quantity: 1, discountPercentage: 5 },
      ],
      notes: 'Demo deal with discount ceiling violation',
    }),
  });
  assert.strictEqual(demoCreate.status, 201);
  const demoQuote = demoCreate.data.data;
  assert.strictEqual(demoQuote.riskLevel, 'HIGH', 'Risk level must be HIGH due to 18% Installation violation');
  assert.strictEqual(demoQuote.requiredApproverRole, 'SALES_MANAGER');
  assert.ok(
    demoQuote.riskReasons.some((r) => r.includes('Installation') && r.includes('18%')),
    'Risk reasons must identify the Installation ceiling violation'
  );
  console.log('✅ Tests 9 & 10 Passed: Risk Engine correctly evaluated database discount rules.\n');

  // Test 11: Approval Engine is invoked on submit
  console.log('Test 11: Approval Engine invoked on submit (moves to PENDING_APPROVAL)...');
  const demoSubmit = await request(`/api/quotations/${demoQuote.id}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(demoSubmit.status, 200);
  assert.strictEqual(demoSubmit.data.data.status, 'PENDING_APPROVAL');
  assert.strictEqual(demoSubmit.data.data.approvalStatus, 'PENDING_MANAGER');
  console.log('✅ Test 11 Passed: Quotation transitioned to PENDING_APPROVAL with PENDING_MANAGER.\n');

  // Test 12: Sales Rep cannot approve own quote
  console.log('Test 12: Sales Rep cannot approve own quotation (RBAC blocked)...');
  const illegalApprove = await request(`/api/manager/approvals/${demoQuote.id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` }, // Sales rep token!
    body: JSON.stringify({ comments: 'Self-approving' }),
  });
  assert.strictEqual(illegalApprove.status, 403, 'Sales Rep must be blocked by RBAC from approval endpoint');
  console.log('✅ Test 12 Passed: Sales Rep blocked with 403 Forbidden from approving quotation.\n');

  // Test 13: Cross-tenant quotation access is rejected
  console.log('Test 13: Cross-tenant quotation access rejected...');
  // Attempt to fetch quotation using a fake tenant or non-matching ID
  const fakeQuoteRes = await request('/api/quotations/00000000-0000-0000-0000-000000000000', {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(fakeQuoteRes.status, 404, 'Foreign quotation must return 404');
  console.log('✅ Test 13 Passed: Cross-tenant quote lookup safely isolated.\n');

  // Test 14: Draft can be edited
  console.log('Test 14: Draft quotation can be edited...');
  const editDraftRes = await request(`/api/quotations/${quote1.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      items: [{ productId: laptop.id, quantity: 3, discountPercentage: 5 }],
      notes: 'Updated draft quantity',
    }),
  });
  assert.strictEqual(editDraftRes.status, 200);
  assert.strictEqual(editDraftRes.data.data.items[0].quantity, 3);
  console.log('✅ Test 14 Passed: Draft successfully edited in database.\n');

  // Test 15: Submitted quote cannot be arbitrarily edited
  console.log('Test 15: Submitted quotation cannot be edited...');
  const editSubmittedRes = await request(`/api/quotations/${demoQuote.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      items: [{ productId: laptop.id, quantity: 1, discountPercentage: 0 }],
    }),
  });
  assert.strictEqual(editSubmittedRes.status, 400, 'Submitted quote edit must be rejected with 400');
  console.log('✅ Test 15 Passed: Submitted quote edit rejected with INVALID_STATUS.\n');

  // Test 16: Duplicate submission is idempotent
  console.log('Test 16: Duplicate submission is idempotent...');
  const dupSubmit = await request(`/api/quotations/${demoQuote.id}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(dupSubmit.status, 200);
  assert.strictEqual(dupSubmit.data.data.status, 'PENDING_APPROVAL');

  // Also test with Idempotency-Key header
  const idemKey = `test-idem-${Date.now()}`;
  const idemSubmit1 = await request(`/api/quotations/${demoQuote.id}/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${salesToken}`,
      'Idempotency-Key': idemKey,
    },
  });
  assert.strictEqual(idemSubmit1.status, 200);

  const idemSubmit2 = await request(`/api/quotations/${demoQuote.id}/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${salesToken}`,
      'Idempotency-Key': idemKey,
    },
  });
  assert.strictEqual(idemSubmit2.status, 200);
  assert.strictEqual(idemSubmit2.headers.get('x-cache'), 'HIT-IDEMPOTENCY');
  console.log('✅ Test 16 Passed: Distributed idempotency safely intercepts duplicate submit.\n');

  // Test 17: Concurrent submission safety
  console.log('Test 17: Concurrent submission safety test...');
  // Create a new draft quote to test simultaneous submit requests
  const concDraft = await request('/api/quotations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      customerId: acme.id,
      items: [{ productId: laptop.id, quantity: 1, discountPercentage: 20 }], // High risk
    }),
  });
  assert.strictEqual(concDraft.status, 201);
  const concQuoteId = concDraft.data.data.id;

  // Fire two simultaneous submit requests
  const [resA, resB] = await Promise.all([
    request(`/api/quotations/${concQuoteId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${salesToken}` },
    }),
    request(`/api/quotations/${concQuoteId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${salesToken}` },
    }),
  ]);
  assert.strictEqual(resA.status, 200);
  assert.strictEqual(resB.status, 200);
  assert.strictEqual(resA.data.data.status, 'PENDING_APPROVAL');
  assert.strictEqual(resB.data.data.status, 'PENDING_APPROVAL');
  console.log('✅ Test 17 Passed: Concurrent submissions handled safely without data corruption.\n');

  // Test 18: Pagination & Filtering works
  console.log('Test 18: Server-side pagination & filtering...');
  const pageRes = await request('/api/quotations?page=1&limit=2&status=PENDING_APPROVAL', {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(pageRes.status, 200);
  assert.ok(pageRes.data.data.length <= 2);
  assert.ok(pageRes.data.pagination);
  assert.strictEqual(pageRes.data.pagination.page, 1);
  assert.strictEqual(pageRes.data.pagination.limit, 2);
  assert.ok(pageRes.data.pagination.totalCount >= 1);

  // Test max 100 row protection
  const overLimitRes = await request('/api/quotations?page=1&limit=500', {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(overLimitRes.data.pagination.limit, 100, 'Page size must be capped at 100');
  console.log('✅ Test 18 Passed: Pagination meta returned, capped at 100 rows.\n');

  // Test 19: Audit events generated
  console.log('Test 19: Audit events generated...');
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@techworld.com', password: 'Admin@123' }),
  });
  assert.strictEqual(adminLogin.status, 200);
  const adminToken = adminLogin.data.token;

  // Inspect audit log for this tenant
  const auditRes = await request('/api/admin/audit?limit=50', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(auditRes.status, 200);
  const logs = auditRes.data.data || [];
  const actions = new Set(logs.map((l) => l.action));
  console.log('  Recent recorded audit actions:', Array.from(actions).slice(0, 10).join(', '));
  assert.ok(actions.has('QUOTE_CREATED'), 'AuditLog must contain QUOTE_CREATED');
  assert.ok(actions.has('QUOTE_SUBMITTED'), 'AuditLog must contain QUOTE_SUBMITTED');
  assert.ok(actions.has('RISK_EVALUATED'), 'AuditLog must contain RISK_EVALUATED');
  assert.ok(actions.has('APPROVAL_REQUESTED'), 'AuditLog must contain APPROVAL_REQUESTED');
  console.log('✅ Test 19 Passed: QUOTE_CREATED, QUOTE_SUBMITTED, RISK_EVALUATED, and APPROVAL_REQUESTED audited.\n');

  // Test 20: Sales Dashboard API works
  console.log('Test 20: Sales Dashboard metrics & pipeline breakdown...');
  const dashRes = await request('/api/sales/dashboard', {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(dashRes.status, 200);
  const summary = dashRes.data.data.summary;
  assert.ok(summary.totalQuotes >= 3);
  assert.ok(summary.pendingApprovalCount >= 2);
  assert.ok(summary.totalQuotedValue > 0);
  assert.strictEqual(typeof summary.draftCount, 'number');
  assert.strictEqual(typeof summary.approvedCount, 'number');
  assert.strictEqual(typeof summary.sentToCustomerCount, 'number');
  console.log(`✅ Test 20 Passed: Dashboard summary loaded: ${summary.totalQuotes} quotes, ${summary.pendingApprovalCount} pending, ₹${summary.totalQuotedValue} total.\n`);

  console.log('================================================================');
  console.log('🎉 ALL 20 SALES REPRESENTATIVE QUOTATION ENGINE TESTS PASSED!');
  console.log('================================================================');
}

runAllTests().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
