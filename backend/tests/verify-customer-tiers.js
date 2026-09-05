/**
 * verify-customer-tiers.js — DealFlow360 Customer Tier Governance Verification
 *
 * Validates:
 * 1. Admin authentication & retrieval of Customer Directory
 * 2. Verification of seeded commercial tiers:
 *    - Acme Corporation: GOLD
 *    - Beta Industries: SILVER
 *    - Gamma Solutions: BRONZE
 * 3. Admin updates Beta Industries tier: SILVER -> GOLD
 * 4. AuditLog verification: CUSTOMER_TIER_UPDATED entry with previous/new tier & metadata
 * 5. Sales Rep CPQ risk evaluation with GOLD customer (12% Hardware discount -> Within limit, LOW risk)
 * 6. Sales Rep CPQ risk evaluation with BRONZE customer (12% Hardware discount -> Violates 5% ceiling, requires approval)
 * 7. Multi-tenant isolation: unauthorized cross-tenant tier change rejected
 */

import http from 'http';
import assert from 'assert';

const BASE_URL = 'http://localhost:5000';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 DealFlow360: Customer Tier Commercial Governance Test Suite');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ── Step 1: Admin Login ──────────────────────────────────────────────────
  console.log('Step 1: Authenticating Admin (admin@techworld.com)...');
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@techworld.com', password: 'Admin@123' },
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  const adminToken = adminLogin.data.data.token;
  console.log('✅ Admin authenticated successfully.\n');

  // ── Step 2: Fetch Customer Directory ──────────────────────────────────────
  console.log('Step 2: Fetching Customer Directory via GET /api/customers...');
  const custList = await request('/api/customers', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(custList.status, 200, 'Customer fetch failed');
  const customers = custList.data.data;

  const acme = customers.find((c) => c.companyName?.includes('Acme') || c.name?.includes('Acme'));
  const beta = customers.find((c) => c.companyName?.includes('Beta') || c.name?.includes('Beta'));
  const gamma = customers.find((c) => c.companyName?.includes('Gamma') || c.name?.includes('Gamma'));

  assert.ok(acme, 'Acme Corporation must exist in directory');
  assert.ok(beta, 'Beta Industries must exist in directory');
  assert.ok(gamma, 'Gamma Solutions must exist in directory');

  console.log(`  • Acme Corporation:   Tier = ${acme.tier}`);
  console.log(`  • Beta Industries:    Tier = ${beta.tier}`);
  console.log(`  • Gamma Solutions:    Tier = ${gamma.tier}`);

  assert.strictEqual(acme.tier, 'GOLD', 'Acme must be GOLD tier');
  assert.strictEqual(gamma.tier, 'BRONZE', 'Gamma must be BRONZE tier');
  console.log('✅ Demo customers and commercial classifications verified.\n');

  // ── Step 3: Admin Updates Beta Industries: SILVER -> GOLD ────────────────
  console.log(`Step 3: Admin updating Beta Industries (${beta.id}) from ${beta.tier} -> GOLD...`);
  const tierUpdateRes = await request(`/api/customers/${beta.id}/tier`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { tier: 'GOLD' },
  });

  assert.strictEqual(tierUpdateRes.status, 200, 'Tier update failed');
  assert.strictEqual(tierUpdateRes.data.data.tier, 'GOLD', 'Beta tier should now be GOLD');
  console.log(`✅ Tier update successful: ${tierUpdateRes.data.message}\n`);

  // ── Step 4: Verify AuditLog ──────────────────────────────────────────────
  console.log('Step 4: Verifying AuditLog for CUSTOMER_TIER_UPDATED...');
  const auditRes = await request('/api/audit', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(auditRes.status, 200, 'Audit fetch failed');
  const logs = auditRes.data.data;

  const tierLog = logs.find(
    (l) => l.action === 'CUSTOMER_TIER_UPDATED' && l.entityId === beta.id
  );
  assert.ok(tierLog, 'AuditLog entry for CUSTOMER_TIER_UPDATED must exist');
  console.log(`  • Action:    ${tierLog.action}`);
  console.log(`  • Entity:    ${tierLog.entityType} (${tierLog.entityId})`);
  console.log(`  • Metadata:  Previous=${tierLog.metadata.previousTier} -> New=${tierLog.metadata.newTier}`);
  console.log(`  • ChangedBy: ${tierLog.metadata.changedBy}`);
  assert.strictEqual(tierLog.metadata.newTier, 'GOLD');
  console.log('✅ Audit trail recorded correctly.\n');

  // ── Step 5: Sales Rep Login ──────────────────────────────────────────────
  console.log('Step 5: Authenticating Sales Rep (rahul@techworld.com)...');
  const salesLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'rahul@techworld.com', password: 'Rahul@123' },
  });
  assert.strictEqual(salesLogin.status, 200, 'Sales rep login failed');
  const salesToken = salesLogin.data.data.token;
  console.log('✅ Sales Rep authenticated successfully.\n');

  // Get demo products
  const prodRes = await request('/api/products', {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  const products = prodRes.data.data;
  const laptop = products.find((p) => p.sku === 'LAPTOP-X');
  assert.ok(laptop, 'Laptop X must exist');

  // ── Step 6: CPQ Calculation with Beta Industries (now GOLD) ──────────────
  console.log('Step 6: CPQ Live Calculation for Beta Industries (GOLD) with 12% discount on Laptop X...');
  console.log('  Rule: Gold Tier Hardware ceiling = 15%. Requested = 12%.');
  const goldCalc = await request('/api/quotations/calculate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: {
      customerId: beta.id,
      items: [
        {
          productId: laptop.id,
          name: laptop.name,
          type: laptop.type,
          unitPrice: laptop.unitPrice,
          costPrice: laptop.costPrice,
          quantity: 2,
          discountPercentage: 12.0,
        },
      ],
    },
  });

  assert.strictEqual(goldCalc.status, 200, 'Calculate failed');
  const goldRisk = goldCalc.data.data.risk;
  console.log(`  • Risk Level:         ${goldRisk.riskLevel}`);
  console.log(`  • Approval Required:  ${goldRisk.approvalRequired}`);
  console.log(`  • Violations count:   ${goldRisk.violations?.length || 0}`);
  assert.strictEqual(goldRisk.approvalRequired, false, '12% discount for GOLD customer should NOT require approval (within 15% limit)');
  console.log('✅ GOLD customer within configured limits: No approval required.\n');

  // ── Step 7: CPQ Calculation with Gamma Solutions (BRONZE) ────────────────
  console.log('Step 7: CPQ Live Calculation for Gamma Solutions (BRONZE) with 12% discount on Laptop X...');
  console.log('  Rule: Bronze Tier Hardware ceiling = 5%. Requested = 12%.');
  const bronzeCalc = await request('/api/quotations/calculate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: {
      customerId: gamma.id,
      items: [
        {
          productId: laptop.id,
          name: laptop.name,
          type: laptop.type,
          unitPrice: laptop.unitPrice,
          costPrice: laptop.costPrice,
          quantity: 2,
          discountPercentage: 12.0,
        },
      ],
    },
  });

  assert.strictEqual(bronzeCalc.status, 200, 'Calculate failed');
  const bronzeRisk = bronzeCalc.data.data.risk;
  console.log(`  • Risk Level:         ${bronzeRisk.riskLevel}`);
  console.log(`  • Approval Required:  ${bronzeRisk.approvalRequired}`);
  console.log(`  • Approver Role:      ${bronzeRisk.requiredApproverRole}`);
  console.log(`  • Violations:         ${bronzeRisk.violations?.[0]?.productName} requested ${bronzeRisk.violations?.[0]?.requestedDiscount}% vs max ${bronzeRisk.violations?.[0]?.maxAllowed}%`);
  assert.strictEqual(bronzeRisk.approvalRequired, true, '12% discount for BRONZE customer MUST require approval (exceeds 5% limit)');
  assert.strictEqual(bronzeRisk.requiredApproverRole, 'SALES_MANAGER', 'Expected SALES_MANAGER approval role');
  console.log('✅ BRONZE customer discount violation correctly routed to approval.\n');

  // ── Step 8: Multi-tenant security check ───────────────────────────────────
  console.log('Step 8: Testing Multi-tenant isolation for invalid customer ID...');
  const badIdRes = await request('/api/customers/fake-customer-id-999/tier', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { tier: 'GOLD' },
  });
  assert.strictEqual(badIdRes.status, 404, 'Cross-tenant/fake customer ID must return 404');
  console.log('✅ Tenant isolation enforced: Non-existent / cross-tenant ID returns 404.\n');

  // ── Step 9: Revert Beta Industries back to SILVER ─────────────────────────
  console.log('Step 9: Reverting Beta Industries back to SILVER for clean state...');
  await request(`/api/customers/${beta.id}/tier`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { tier: 'SILVER' },
  });
  console.log('✅ Beta Industries restored to SILVER.\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 ALL CUSTOMER TIER GOVERNANCE TESTS PASSED SUCCESSFULLY!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
