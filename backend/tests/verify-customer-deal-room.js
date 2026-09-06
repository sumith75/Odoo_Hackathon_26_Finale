/**
 * verify-customer-deal-room.js
 * Comprehensive automated verification of Customer Deal Room & Negotiation Engine
 */

const BASE_URL = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runCustomerVerification() {
  console.log('🧪 ========================================================');
  console.log('🧪 STARTING DEALFLOW360 CUSTOMER DEAL ROOM VERIFICATION');
  console.log('🧪 ========================================================\n');

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
    // 1. Authenticate as Customer
    console.log('1️⃣ Authenticating Customer (customer@acme.com)...');
    const customerLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'customer@acme.com',
        password: 'Customer@123',
      }),
    });
    assert(customerLogin.data?.success, 'Customer login succeeded');
    const customerToken = customerLogin.data?.token;
    const customerUser = customerLogin.data?.user;
    assert(customerUser?.role === 'CUSTOMER', 'Authenticated role is CUSTOMER');
    assert(customerUser?.companyName === 'Acme Corporation', 'Customer company is Acme Corporation');

    const customerHeaders = { Authorization: `Bearer ${customerToken}` };

    // 2. Fetch Customer Dashboard
    console.log('\n2️⃣ Fetching Customer Dashboard...');
    const dashRes = await req(`${BASE_URL}/customer/dashboard`, { headers: customerHeaders });
    assert(dashRes.data?.success, 'Dashboard API returned success');
    assert(dashRes.data?.data?.stats !== undefined, 'Dashboard stats present');
    assert(dashRes.data?.data?.customer?.companyName === 'Acme Corporation', 'Customer details returned');
    console.log('     Dashboard Stats:', dashRes.data?.data?.stats);

    // 3. Prepare an approved / sent quote for testing
    console.log('\n3️⃣ Preparing active quote for Acme Corporation...');
    const repLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'rahul@techworld.com',
        password: 'Rahul@123',
      }),
    });
    const repHeaders = { Authorization: `Bearer ${repLogin.data?.token}` };

    // Fetch rep's quotes for Acme specifically (search + a high limit) rather
    // than relying on default pagination/sort order — this suite runs against
    // a shared, ever-growing dev database, and other suites deliberately leave
    // behind malformed/edge-case fixture quotes (e.g. "DF360-STALE-*" expired
    // fixtures with no line items), so both robustness measures matter.
    const repQuotesRes = await req(`${BASE_URL}/quotations/my?search=Acme&limit=100`, { headers: repHeaders });
    const isUsableQuote = (q) =>
      q.customer?.name === 'Acme Corporation' &&
      !String(q.quoteNumber || '').includes('STALE') &&
      Number(q.totalAmount) > 0;
    let activeQuote = repQuotesRes.data?.data?.find(
      (q) => isUsableQuote(q) && (q.status === 'SENT_TO_CUSTOMER' || q.status === 'APPROVED')
    );

    if (!activeQuote) {
      // Find or create quote for Acme
      const draftQuote = repQuotesRes.data?.data?.find(
        (q) => isUsableQuote(q)
      );
      if (draftQuote) {
        // Send to customer
        const sendRes = await req(`${BASE_URL}/quotations/${draftQuote.id}/send-to-customer`, {
          method: 'POST',
          headers: repHeaders,
          body: JSON.stringify({ validityDays: 14, notes: 'Special seasonal pricing for Acme.' }),
        });
        activeQuote = sendRes.data?.data;
      } else {
        // Create one — search explicitly rather than trusting default
        // pagination to surface the seeded Acme customer / laptop product.
        const custRes = await req(`${BASE_URL}/customers?search=${encodeURIComponent('customer@acme.com')}`, { headers: repHeaders });
        const acmeCustomer = custRes.data?.data?.find((c) => c.email === 'customer@acme.com');
        if (!acmeCustomer) throw new Error('Could not locate seeded customer@acme.com to build a test quote');
        const prodRes = await req(`${BASE_URL}/products?search=${encodeURIComponent('HW-LAP-001')}&limit=100`, { headers: repHeaders });
        const laptop = prodRes.data?.data?.find((p) => p.sku === 'HW-LAP-001') || prodRes.data?.data?.[0];
        if (!laptop) throw new Error('Could not locate a product to build a test quote');

        const createRes = await req(`${BASE_URL}/quotations`, {
          method: 'POST',
          headers: repHeaders,
          body: JSON.stringify({
            customerId: acmeCustomer.id,
            items: [{ productId: laptop.id, quantity: 10, discountPercentage: 12 }],
            notes: 'Test Acme quote',
          }),
        });
        const newQuoteId = createRes.data?.data?.id;
        // Submit
        await req(`${BASE_URL}/quotations/${newQuoteId}/submit`, { method: 'POST', headers: repHeaders });
        // Send
        const sendRes = await req(`${BASE_URL}/quotations/${newQuoteId}/send-to-customer`, {
          method: 'POST',
          headers: repHeaders,
          body: JSON.stringify({ validityDays: 14 }),
        });
        activeQuote = sendRes.data?.data;
      }
    }
    assert(activeQuote && activeQuote.id, `Active quote established: ${activeQuote.quoteNumber || activeQuote.id}`);

    // 4. Fetch Quotes List as Customer
    console.log('\n4️⃣ Fetching Customer Quotes List...');
    const listRes = await req(`${BASE_URL}/customer/quotes`, { headers: customerHeaders });
    assert(listRes.data?.success, 'Customer quotes list returned success');
    assert(Array.isArray(listRes.data?.data), 'Quotes array returned');
    const hasActive = listRes.data?.data?.some((q) => q.id === activeQuote.id);
    assert(hasActive, 'Active quote appears in Customer My Quotes list');

    // 5. Fetch Single Quote Deal Room Dossier & Verify Strict Data Masking
    console.log('\n5️⃣ Inspecting Deal Room Dossier & Data Masking...');
    const detailRes = await req(`${BASE_URL}/customer/quotes/${activeQuote.id}`, { headers: customerHeaders });
    assert(detailRes.data?.success, 'Customer Deal Room detail returned');
    const quoteDossier = detailRes.data?.data;

    assert(quoteDossier?.quoteNumber !== undefined, 'Quote number is visible');
    assert(quoteDossier?.seller?.organizationName !== undefined, 'Seller organization visible');
    assert(quoteDossier?.financials?.totalAmount > 0, 'Total financial amount visible');
    assert(quoteDossier?.items?.length > 0, 'Items present in customer view');

    // Strict Masking Checks: None of these confidential internal fields should be present!
    assert(quoteDossier?.costAmount === undefined, 'CONFIDENTIAL MASKED: costAmount is stripped');
    assert(quoteDossier?.marginAmount === undefined, 'CONFIDENTIAL MASKED: marginAmount is stripped');
    assert(quoteDossier?.marginPercentage === undefined, 'CONFIDENTIAL MASKED: marginPercentage is stripped');
    assert(quoteDossier?.riskScore === undefined, 'CONFIDENTIAL MASKED: riskScore is stripped');
    assert(quoteDossier?.riskLevel === undefined, 'CONFIDENTIAL MASKED: riskLevel is stripped');
    assert(quoteDossier?.riskReasons === undefined, 'CONFIDENTIAL MASKED: riskReasons is stripped');
    assert(quoteDossier?.requiredApproverRole === undefined, 'CONFIDENTIAL MASKED: requiredApproverRole is stripped');

    const firstItem = quoteDossier?.items?.[0];
    assert(firstItem?.costPrice === undefined, 'CONFIDENTIAL MASKED: Item costPrice is stripped');
    assert(firstItem?.marginAmount === undefined, 'CONFIDENTIAL MASKED: Item marginAmount is stripped');
    assert(firstItem?.marginPercentage === undefined, 'CONFIDENTIAL MASKED: Item marginPercentage is stripped');
    assert(firstItem?.unitPrice > 0, 'Item unitPrice is customer visible');
    assert(firstItem?.lineTotal > 0, 'Item lineTotal is customer visible');

    // 6. IDOR Security Verification
    console.log('\n6️⃣ Verifying IDOR Prevention (Customer A cannot access Customer B quotes)...');
    // Customer B is created by an Admin — customer self-signup no longer exists.
    const adminLoginForB = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@techworld.com', password: 'Admin@123' }),
    });
    const adminHeadersForB = { Authorization: `Bearer ${adminLoginForB.data?.token}` };
    const custBEmail = `buyer-test-${Date.now()}@beta.com`;
    await req(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: adminHeadersForB,
      body: JSON.stringify({
        name: 'Beta Buyer',
        email: custBEmail,
        password: 'Password@123',
        companyName: 'Beta Industries',
      }),
    });
    const regB = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: custBEmail, password: 'Password@123' }),
    });
    const customerBToken = regB.data?.token;
    const customerBHeaders = { Authorization: `Bearer ${customerBToken}` };

    // Customer B attempts to access Acme's quote
    const idorRes = await req(`${BASE_URL}/customer/quotes/${activeQuote.id}`, { headers: customerBHeaders });
    assert(idorRes.status === 404, 'IDOR PREVENTED: Customer B received 404 Not Found for Quote A');

    // 7. Delivery Date Request
    console.log('\n7️⃣ Submitting Delivery Date Request...');
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 10);
    const delRes = await req(`${BASE_URL}/customer/quotes/${activeQuote.id}/delivery-request`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        requestedDate: deliveryDate.toISOString(),
        note: 'Please deliver to Pune central facility by 10 AM.',
      }),
    });
    assert(delRes.data?.success, 'Delivery request submitted successfully');
    assert(delRes.data?.data?.status === 'REQUESTED', 'Delivery request status is REQUESTED');

    // 8. Line-Level Comment
    console.log('\n8️⃣ Submitting Line-Level Comment...');
    const commentRes = await req(`${BASE_URL}/customer/quotes/${activeQuote.id}/comments`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        quotationItemId: firstItem.id,
        message: 'Can installation be bundled with the delivery schedule?',
      }),
    });
    assert(commentRes.data?.success, 'Line comment posted successfully');
    assert(commentRes.data?.data?.authorRole === 'CUSTOMER', 'Comment author role is CUSTOMER');

    // 9. Line-Level Change Request
    console.log('\n9️⃣ Submitting Line-Level Change Request...');
    const changeReqRes = await req(`${BASE_URL}/customer/quotes/${activeQuote.id}/change-requests`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        quotationItemId: firstItem.id,
        requestType: 'QUANTITY_CHANGE',
        currentValue: firstItem.quantity,
        requestedValue: firstItem.quantity + 5,
        comment: 'Requesting to increase quantity to 15 units.',
      }),
    });
    assert(changeReqRes.data?.success, 'Line change request submitted successfully');
    assert(changeReqRes.data?.data?.status === 'CUSTOMER_SUBMITTED', 'Change request status is CUSTOMER_SUBMITTED');

    // 10. Counter-Offer Negotiation & Automated Manager Re-Approval Trigger
    console.log('\n🔟 Submitting Counter-Offer Discount (e.g. 12% -> 20%)...');
    const counterRes = await req(`${BASE_URL}/customer/quotes/${activeQuote.id}/counter-offer`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        quotationItemId: firstItem.id,
        proposedDiscount: 20,
        reason: 'Our procurement volume qualifies for enterprise 20% discount tier.',
      }),
    });
    assert(counterRes.data?.success, 'Counter offer submitted successfully');
    assert(counterRes.data?.data?.status === 'UNDER_NEGOTIATION', 'Status is UNDER_NEGOTIATION');
    console.log('     Proposed Total Amount:', counterRes.data?.data?.proposedTotal);

    // Verify Sales Manager sees the deal in Approval Inbox
    console.log('\n1️⃣1️⃣ Verifying Manager Re-Approval Routing...');
    const managerLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'arjun@techworld.com',
        password: 'Arjun@123',
      }),
    });
    const managerHeaders = { Authorization: `Bearer ${managerLogin.data?.token}` };

    const managerApprovals = await req(`${BASE_URL}/manager/approvals?search=${encodeURIComponent(activeQuote.quoteNumber)}`, { headers: managerHeaders });
    const pendingInManager = managerApprovals.data?.data?.find((q) => q.id === activeQuote.id);
    assert(pendingInManager !== undefined, 'Quote is present in Sales Manager Approval Inbox awaiting decision');

    // Sales Manager approves the revised counter-offer terms
    console.log('     Sales Manager approving counter-offer terms...');
    const approveRes = await req(`${BASE_URL}/manager/approvals/${activeQuote.id}/approve`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ comment: 'Counter-offer 20% approved to secure Acme renewal.' }),
    });
    assert(approveRes.data?.success, 'Sales Manager successfully approved customer counter-offer');

    // 12. Order Confirmation & Idempotency
    console.log('\n1️⃣2️⃣ Customer Accepts & Confirms Order...');
    const confirmRes = await req(`${BASE_URL}/customer/quotes/${activeQuote.id}/confirm`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({ termsAccepted: true }),
    });
    assert(confirmRes.data?.success, 'Order confirmed successfully');
    assert(confirmRes.data?.data?.status === 'CUSTOMER_CONFIRMED', 'Quote status is now CUSTOMER_CONFIRMED');
    assert(confirmRes.data?.data?.displayStatus === 'CONFIRMED', 'Display status is CONFIRMED');

    // Idempotency Test: Confirm again
    console.log('     Testing confirmation idempotency (clicking confirm twice)...');
    const secondConfirmRes = await req(`${BASE_URL}/customer/quotes/${activeQuote.id}/confirm`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({ termsAccepted: true }),
    });
    assert(secondConfirmRes.data?.success, 'Second confirm returned clean 200 response');
    assert(secondConfirmRes.data?.alreadyConfirmed === true, 'Idempotency detected: alreadyConfirmed is true');

    // 13. Customer Notifications
    console.log('\n1️⃣3️⃣ Fetching Customer Notifications...');
    const notifRes = await req(`${BASE_URL}/customer/notifications`, { headers: customerHeaders });
    assert(notifRes.data?.success, 'Customer notifications fetched successfully');
    assert(notifRes.data?.data?.length > 0, 'Customer has received milestone notifications');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`VERIFICATION COMPLETE: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) process.exit(1);
}

runCustomerVerification();
