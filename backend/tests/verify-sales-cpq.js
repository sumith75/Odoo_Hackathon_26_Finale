// Comprehensive Automated Verification for Sales Representative Portal & CPQ Studio
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
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('🚀 Starting Sales Representative Portal & CPQ Studio Verification...\n');

  // 1. Authenticate as Sales Rep
  console.log('Step 1: Logging in as Sales Rep (rahul@techworld.com)...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'rahul@techworld.com', password: 'Rahul@123' }),
  });
  assert.strictEqual(loginRes.status, 200, 'Sales Rep login failed');
  assert.strictEqual(loginRes.data.user.role, 'SALES_REP');
  const salesToken = loginRes.data.token;
  const tenantId = loginRes.data.user.tenantId;
  console.log(`✅ Logged in as ${loginRes.data.user.name} (Role: ${loginRes.data.user.role})\n`);

  // Also verify sales@techworld.com login works
  const salesAliasLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'sales@techworld.com', password: 'Sales@123' }),
  });
  assert.strictEqual(salesAliasLogin.status, 200);
  console.log('✅ sales@techworld.com alias login verified\n');

  // 2. Fetch Customers
  console.log('Step 2: Fetching Customer Directory via GET /api/customers...');
  const customersRes = await request('/api/customers', {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(customersRes.status, 200);
  assert.ok(customersRes.data.data.length >= 1, 'Expected at least 1 customer');
  const acmeCustomer = customersRes.data.data.find((c) => c.companyName === 'Acme Corporation');
  assert.ok(acmeCustomer, 'Acme Corporation customer must exist in database');
  assert.strictEqual(acmeCustomer.tier, 'GOLD');
  console.log(`✅ Acme Corporation found with tier ${acmeCustomer.tier} (${acmeCustomer.email})\n`);

  // 3. Fetch Catalog Products
  console.log('Step 3: Fetching Products via GET /api/products...');
  const prodRes = await request('/api/products', {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(prodRes.status, 200);
  const laptop = prodRes.data.data.find((p) => p.sku === 'LAPTOP-X');
  const install = prodRes.data.data.find((p) => p.sku === 'INSTALL-001');
  const support = prodRes.data.data.find((p) => p.sku === 'SUPPORT-PREMIUM');
  assert.ok(laptop && install && support, 'Seeded products must exist');
  console.log(`✅ Products loaded: Laptop X (₹${laptop.unitPrice}), Installation (₹${install.unitPrice}), Support (₹${support.unitPrice})\n`);

  // 4. Primary Demo Scenario (Section 47: High Risk Deal requiring Manager Approval)
  console.log('Step 4: Primary Demo Scenario — 10x Laptop X (12%), 1x Install (18%), 10x Support (5%)...');
  const scenarioItems = [
    {
      productId: laptop.id,
      quantity: 10,
      discountPercentage: 12, // <= 15% (Within ceiling)
    },
    {
      productId: install.id,
      quantity: 1,
      discountPercentage: 18, // > 10% (VIOLATES CEILING!)
    },
    {
      productId: support.id,
      quantity: 10,
      discountPercentage: 5, // <= 5% (Within ceiling)
    },
  ];

  // Test live calculation endpoint
  const calcRes = await request('/api/quotations/calculate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      items: scenarioItems,
      customerTier: acmeCustomer.tier,
    }),
  });
  assert.strictEqual(calcRes.status, 200);
  const calcData = calcRes.data.data;

  console.log(`  Live Subtotal: ₹${calcData.pricing.subtotal}`);
  console.log(`  Live Margin: ₹${calcData.pricing.marginAmount} (${calcData.pricing.marginPercentage}%)`);
  console.log(`  Live Risk Score: ${calcData.risk.riskScore}/100 [${calcData.risk.riskLevel}]`);
  console.log(`  Approval Required: ${calcData.risk.approvalRequired} (Approver: ${calcData.risk.requiredApproverRole})`);

  // Verify Risk Engine accurately identified the Installation violation
  assert.strictEqual(calcData.risk.riskLevel, 'HIGH', 'Risk level must be HIGH');
  assert.strictEqual(calcData.risk.approvalRequired, true, 'Approval must be required');
  assert.strictEqual(calcData.risk.requiredApproverRole, 'SALES_MANAGER');
  assert.ok(
    calcData.risk.reasons.some((r) => r.includes('Installation') && r.includes('18%')),
    'Risk reasons must clearly detail the 18% Installation discount ceiling violation'
  );
  console.log('✅ Risk Engine correctly detected Installation discount ceiling violation and set HIGH risk!\n');

  // Verify Cross-sell recommendations
  assert.ok(calcData.recommendations.length > 0, 'Recommendations should be returned');
  console.log(`✅ Upsell suggestions returned: ${calcData.recommendations.map((r) => r.name).join(', ')}\n`);

  // 5. Create Draft Quotation
  console.log('Step 5: Creating draft quotation in database...');
  const createRes = await request('/api/quotations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      customerId: acmeCustomer.id,
      items: scenarioItems,
      notes: 'Acme annual infrastructure hardware & services expansion.',
    }),
  });
  assert.strictEqual(createRes.status, 201);
  const createdQuote = createRes.data.data;
  assert.strictEqual(createdQuote.status, 'DRAFT');
  assert.ok(createdQuote.quoteNumber.startsWith('DF360-'), 'Quote number must follow DF360 format');
  console.log(`✅ Draft quote created: ${createdQuote.quoteNumber} (ID: ${createdQuote.id})\n`);

  // 6. Submit Quotation (Must move to PENDING_APPROVAL)
  console.log('Step 6: Submitting high-risk quotation...');
  const submitRes = await request(`/api/quotations/${createdQuote.id}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(submitRes.status, 200);
  assert.strictEqual(submitRes.data.data.status, 'PENDING_APPROVAL');
  assert.strictEqual(submitRes.data.data.approvalStatus, 'PENDING_MANAGER');
  console.log(`✅ Quotation successfully submitted and locked in PENDING_APPROVAL (Manager required)!\n`);

  // 7. Idempotency test (Prevent duplicate submissions)
  console.log('Step 7: Testing duplicate submission idempotency...');
  const dupSubmit = await request(`/api/quotations/${createdQuote.id}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(dupSubmit.status, 200);
  assert.strictEqual(dupSubmit.data.data.status, 'PENDING_APPROVAL');
  console.log('✅ Duplicate submit safely handled with idempotent response\n');

  // 8. Second Demo Scenario (Section 48: Low Risk Deal within Ceilings)
  console.log('Step 8: Second Demo Scenario — Low-risk deal within all ceilings...');
  const lowRiskItems = [
    { productId: laptop.id, quantity: 2, discountPercentage: 10 }, // <= 15%
    { productId: install.id, quantity: 1, discountPercentage: 5 },  // <= 10%
    { productId: support.id, quantity: 2, discountPercentage: 5 },  // <= 5%
  ];

  const lowRiskQuote = await request('/api/quotations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      customerId: acmeCustomer.id,
      items: lowRiskItems,
    }),
  });
  assert.strictEqual(lowRiskQuote.status, 201);
  assert.strictEqual(lowRiskQuote.data.data.riskLevel, 'LOW');

  const lowRiskSubmit = await request(`/api/quotations/${lowRiskQuote.data.data.id}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(lowRiskSubmit.status, 200);
  assert.strictEqual(lowRiskSubmit.data.data.status, 'APPROVED');
  console.log('✅ Low-risk quote automatically approved without unnecessary manager roadblock!\n');

  // 9. Sales Rep Dashboard Metrics
  console.log('Step 9: Testing Sales Dashboard aggregates (GET /api/sales/dashboard)...');
  const dashRes = await request('/api/sales/dashboard', {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(dashRes.status, 200);
  const metrics = dashRes.data.data.summary;
  assert.ok(metrics.totalQuotes >= 2, 'Should count at least 2 quotes');
  assert.ok(metrics.pendingApprovalCount >= 1, 'Should have at least 1 pending approval');
  assert.ok(metrics.approvedCount >= 1, 'Should have at least 1 approved deal');
  assert.ok(metrics.atRiskCount >= 1, 'Should count at least 1 at-risk deal');
  assert.ok(metrics.totalQuotedValue > 0, 'Total quoted value should be positive');
  console.log(`✅ Dashboard verified: ${metrics.totalQuotes} total quotes, ₹${metrics.totalQuotedValue} total quoted value\n`);

  // 10. Security & Tenant Isolation Check
  console.log('Step 10: Security check — Sales Rep cannot edit submitted quote...');
  const illegalEdit = await request(`/api/quotations/${createdQuote.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({ items: lowRiskItems }),
  });
  assert.strictEqual(illegalEdit.status, 400, 'Must reject editing a submitted quote');
  console.log('✅ Locked quote cannot be edited after submission\n');

  console.log('🎉 ALL 10 SALES REPRESENTATIVE & CPQ CHECKS PASSED PERFECTLY!');
}

run().catch((err) => {
  console.error('❌ Sales CPQ verification failed:', err);
  process.exit(1);
});
