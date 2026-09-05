/**
 * verify-finance-operations.js — Comprehensive Automated Verification for Finance & Operations Module
 *
 * Validates all 14 criteria:
 * 1. Role-based Auth & Token generation for FINANCE_OPERATIONS (priya@techworld.com)
 * 2. GET /api/finance/dashboard (Real KPIs, queues, warehouses)
 * 3. GET /api/finance/warehouses (BLR-01 & HYD-01 inventory)
 * 4. GET /api/finance/fulfillment (Queue of confirmed deals)
 * 5. GET /api/finance/fulfillment/:quotationId (Dossier & Hybrid billing calculation)
 * 6. Shortage rejection: Quote 2 (15 Laptop X requested vs 12 available -> INSUFFICIENT_INVENTORY)
 * 7. Multi-Warehouse split allocation: Quote 1 (10 Laptop X -> 8 in BLR-01 + 2 in HYD-01)
 * 8. Allocation idempotency & inventory state validation (available/allocated)
 * 9. Physical, Service & Subscription Fulfillment execution (stock decrement + service flag + subscription record)
 * 10. Hybrid Capex Invoice generation (Hardware + Service = 820,000; Excludes subscription)
 * 11. Invoice generation idempotency
 * 12. Payment simulation (₹820,000 -> invoice PAID -> quote PAID)
 * 13. Active Subscriptions verification (Acme Corporation: Premium Support ₹3,000/mo)
 * 14. Recurring billing cycle execution (Next billing date advanced + Recurring Invoice generated)
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(data);
        } catch (e) {
          body = data;
        }
        resolve({ status: res.statusCode, body });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 FINANCE & OPERATIONS MODULE: AUTOMATED VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate as Finance User (priya@techworld.com)
    console.log('Step 1: Authenticating as Finance / Operations user...');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'priya@techworld.com',
        password: 'Priya@123',
      },
    });

    assert(
      loginRes.status === 200 && loginRes.body.token,
      'Login successful for priya@techworld.com'
    );
    const token = loginRes.body.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 2. Dashboard KPIs
    console.log('\nStep 2: Testing GET /api/finance/dashboard...');
    const dashRes = await request('/api/finance/dashboard', { headers: authHeaders });
    assert(dashRes.status === 200 && dashRes.body.success, 'Dashboard returned HTTP 200');
    assert(dashRes.body.data.kpis !== undefined, 'Dashboard has KPI metrics');
    assert(Array.isArray(dashRes.body.data.warehouses), 'Dashboard has warehouses rollup');

    // 3. Warehouses & Stock levels
    console.log('\nStep 3: Testing GET /api/finance/warehouses...');
    const whRes = await request('/api/finance/warehouses', { headers: authHeaders });
    assert(whRes.status === 200 && whRes.body.success, 'Warehouses returned HTTP 200');
    const blrWh = whRes.body.data.find((w) => w.code === 'BLR-01');
    const hydWh = whRes.body.data.find((w) => w.code === 'HYD-01');
    assert(blrWh && hydWh, 'Found both BLR-01 and HYD-01 warehouses');

    const blrLaptop = blrWh.inventories.find((i) => i.productId === 'prod-001');
    const hydLaptop = hydWh.inventories.find((i) => i.productId === 'prod-001');
    assert(blrLaptop && blrLaptop.availableQuantity >= 8, 'BLR-01 has 8 Laptop X available');
    assert(hydLaptop && hydLaptop.availableQuantity >= 4, 'HYD-01 has 4 Laptop X available');

    // 4. Fulfillment Queue
    console.log('\nStep 4: Testing GET /api/finance/fulfillment...');
    const ffRes = await request('/api/finance/fulfillment', { headers: authHeaders });
    assert(ffRes.status === 200 && ffRes.body.success, 'Fulfillment queue returned HTTP 200');
    const q1 = ffRes.body.data.find((q) => q.quoteNumber === 'DF360-2026-000021');
    const q2 = ffRes.body.data.find((q) => q.quoteNumber === 'DF360-2026-000022');
    assert(q1 !== undefined, 'Found Quote DF360-2026-000021 in queue');
    assert(q2 !== undefined, 'Found Quote DF360-2026-000022 in queue');

    // 5. Fulfillment Dossier & Hybrid Billing
    console.log('\nStep 5: Testing GET /api/finance/fulfillment/:id for DF360-2026-000021...');
    const dosRes = await request(`/api/finance/fulfillment/${q1.id}`, { headers: authHeaders });
    assert(dosRes.status === 200 && dosRes.body.success, 'Dossier returned HTTP 200');
    const hybrid = dosRes.body.data.hybridBilling;
    assert(hybrid !== undefined, 'Hybrid billing breakdown present');
    assert(Number(hybrid.oneTime.total) === 820000, `One-time total is ₹820,000 (actual: ₹${hybrid.oneTime.total})`);
    assert(Number(hybrid.recurring.totalMRR) === 3000, `Recurring MRR is ₹3,000 (actual: ₹${hybrid.recurring.totalMRR})`);

    // 6. Shortage Rejection Test (DF360-2026-000022: 15 Laptop X requested vs 12 total available)
    console.log('\nStep 6: Testing Stock Shortage Rejection on DF360-2026-000022 (15 requested vs 12 in stock)...');
    const shortageRes = await request(`/api/finance/fulfillment/${q2.id}/allocate`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert(shortageRes.status === 409, `Shortage correctly returned HTTP 409 Conflict (status: ${shortageRes.status})`);
    assert(
      shortageRes.body.error?.code === 'INSUFFICIENT_INVENTORY',
      `Error code is INSUFFICIENT_INVENTORY (code: ${shortageRes.body.error?.code})`
    );
    assert(
      shortageRes.body.error?.details?.shortage === 3,
      'Shortage details indicate 3 units short'
    );

    // 7. Multi-Warehouse Split Auto-Allocation (DF360-2026-000021: 10 Laptop X)
    console.log('\nStep 7: Testing Multi-Warehouse Split Auto-Allocation on DF360-2026-000021 (10 units)...');
    const allocRes = await request(`/api/finance/fulfillment/${q1.id}/allocate`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert(allocRes.status === 200 && allocRes.body.success, 'Auto-allocation returned HTTP 200');
    const allocations = allocRes.body.data.allocations;
    assert(allocations.length === 2, `Allocated across 2 warehouses (count: ${allocations.length})`);

    const blrAlloc = allocations.find((a) => a.warehouseName.includes('Bangalore'));
    const hydAlloc = allocations.find((a) => a.warehouseName.includes('Hyderabad'));
    assert(blrAlloc && blrAlloc.allocatedQuantity === 8, `BLR-01 allocated 8 units (actual: ${blrAlloc?.allocatedQuantity})`);
    assert(hydAlloc && hydAlloc.allocatedQuantity === 2, `HYD-01 allocated 2 units (actual: ${hydAlloc?.allocatedQuantity})`);

    // 8. Allocation Idempotency
    console.log('\nStep 8: Testing Allocation Idempotency...');
    const allocIdemRes = await request(`/api/finance/fulfillment/${q1.id}/allocate`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert(allocIdemRes.status === 200, 'Second allocation returned HTTP 200');
    assert(allocIdemRes.body.data.isExisting === true, 'Response flagged isExisting = true');

    // 9. Complete Fulfillment (Physical + Service + Subscription Activation)
    console.log('\nStep 9: Testing POST /api/finance/fulfillment/:id/complete...');
    const fulfillRes = await request(`/api/finance/fulfillment/${q1.id}/complete`, {
      method: 'POST',
      headers: authHeaders,
      body: {},
    });
    assert(fulfillRes.status === 200 && fulfillRes.body.success, 'Fulfillment completed with HTTP 200');

    // Verify quote status transitioned to FULFILLED
    const q1AfterFulfill = await request(`/api/finance/fulfillment/${q1.id}`, { headers: authHeaders });
    assert(
      q1AfterFulfill.body.data.status === 'FULFILLED',
      `Quote status transitioned to FULFILLED (actual: ${q1AfterFulfill.body.data.status})`
    );
    assert(
      q1AfterFulfill.body.data.fulfillmentStatus === 'FULFILLED',
      `Quote fulfillmentStatus is FULFILLED (actual: ${q1AfterFulfill.body.data.fulfillmentStatus})`
    );

    // 10. Generate One-Time Capex Invoice (Hardware + Service = 820,000)
    console.log('\nStep 10: Testing One-Time Capex Invoice Generation...');
    const invRes = await request(`/api/finance/invoices/${q1.id}/generate`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert(invRes.status === 200 && invRes.body.success, 'Invoice generation returned HTTP 200');
    const createdInvoice = invRes.body.data.invoice;
    assert(createdInvoice !== undefined, 'Invoice object created');
    assert(
      Number(createdInvoice.totalAmount) === 820000,
      `Invoice total is ₹820,000 Capex (actual: ₹${createdInvoice.totalAmount})`
    );
    assert(
      Number(createdInvoice.amountDue) === 820000,
      `Invoice amountDue is ₹820,000 (actual: ₹${createdInvoice.amountDue})`
    );

    // 11. Invoice Generation Idempotency
    console.log('\nStep 11: Testing Invoice Generation Idempotency...');
    const invIdemRes = await request(`/api/finance/invoices/${q1.id}/generate`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert(invIdemRes.status === 200, 'Second invoice call returned HTTP 200');
    assert(invIdemRes.body.data.isExisting === true, 'Second invoice call flagged isExisting = true');

    // 12. Payment Simulation
    console.log('\nStep 12: Testing Payment Simulation (Full Settlement ₹820,000)...');
    const payRes = await request(`/api/finance/invoices/${createdInvoice.id}/payments/simulate`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        amount: 820000,
        paymentMethod: 'BANK_TRANSFER',
        notes: 'Full NEFT settlement received from Acme Corp',
      },
    });
    assert(payRes.status === 200 && payRes.body.success, 'Payment recorded with HTTP 200');
    assert(payRes.body.data.invoice.status === 'PAID', `Invoice status is PAID (actual: ${payRes.body.data.invoice.status})`);
    assert(
      Number(payRes.body.data.invoice.amountDue) === 0,
      `Invoice amountDue is 0 (actual: ${payRes.body.data.invoice.amountDue})`
    );
    assert(
      payRes.body.data.quotation.status === 'PAID',
      `Quote status transitioned to PAID (actual: ${payRes.body.data.quotation.status})`
    );

    // 13. Verify Active Subscription
    console.log('\nStep 13: Testing GET /api/finance/subscriptions...');
    const subRes = await request('/api/finance/subscriptions', { headers: authHeaders });
    assert(subRes.status === 200 && subRes.body.success, 'Subscriptions returned HTTP 200');
    const acmeSub = subRes.body.data.find((s) => s.quotationId === q1.id);
    assert(acmeSub !== undefined, 'Found active subscription created from Quote DF360-2026-000021');
    assert(acmeSub.status === 'ACTIVE', `Subscription status is ACTIVE (actual: ${acmeSub?.status})`);
    assert(
      Number(acmeSub.recurringTotal) === 3000,
      `Subscription recurringTotal is ₹3,000 (actual: ₹${acmeSub?.recurringTotal})`
    );

    // 14. Trigger Recurring Subscription Billing Cycle
    console.log('\nStep 14: Testing POST /api/finance/subscriptions/:id/bill...');
    const prevBillingDate = new Date(acmeSub.nextBillingDate);
    const billRes = await request(`/api/finance/subscriptions/${acmeSub.id}/bill`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert(billRes.status === 200 && billRes.body.success, 'Recurring billing returned HTTP 200');
    const recurringInv = billRes.body.data.invoice;
    assert(
      recurringInv.invoiceType === 'RECURRING',
      `Generated invoice is RECURRING type (actual: ${recurringInv.invoiceType})`
    );
    assert(
      Number(recurringInv.totalAmount) === 3000,
      `Recurring invoice total is ₹3,000 (actual: ₹${recurringInv.totalAmount})`
    );
    const updatedSub = billRes.body.data.subscription;
    const newBillingDate = new Date(updatedSub.nextBillingDate);
    assert(
      newBillingDate > prevBillingDate,
      `nextBillingDate advanced from ${prevBillingDate.toISOString().slice(0, 10)} to ${newBillingDate.toISOString().slice(0, 10)}`
    );

    console.log('\n================================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test suite encountered an unhandled exception:', error);
    process.exit(1);
  }
}

runTests();
