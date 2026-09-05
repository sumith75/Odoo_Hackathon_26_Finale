/**
 * verify-manager-approvals.js
 * End-to-end verification of Sales Manager / Approver Portal & Governance Engine
 */

const BASE_URL = 'http://localhost:5000/api';

async function runVerification() {
  console.log('🚀 Starting Sales Manager / Approver Portal Verification...\n');

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Sales Manager Login
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Step 1: Logging in as Sales Manager (arjun@techworld.com)...');
    const mgrLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'arjun@techworld.com',
        password: 'Arjun@123',
      }),
    });
    const mgrLoginData = await mgrLoginRes.json();
    if (!mgrLoginRes.ok || !mgrLoginData.token) {
      throw new Error('Manager login failed: ' + JSON.stringify(mgrLoginData));
    }
    const managerToken = mgrLoginData.token;
    const managerUser = mgrLoginData.user;
    console.log(`✅ Manager logged in: ${managerUser.name} [${managerUser.role}] — Tenant: ${managerUser.organizationName}\n`);

    // Also log in as Sales Rep (Rahul) for authoring & revision tests
    const salesLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rahul@techworld.com',
        password: 'Rahul@123',
      }),
    });
    const salesLoginData = await salesLoginRes.json();
    const salesToken = salesLoginData.token;
    const salesUser = salesLoginData.user;
    console.log(`✅ Sales Rep logged in: ${salesUser.name} [${salesUser.role}]\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Create a fresh High-Risk Quotation as Sales Rep
    // (10x Laptop X [12%], 1x Installation [18% - violates 10% ceiling], 10x Support [5%])
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Step 2: Creating and submitting High-Risk Demo Quote as Sales Rep...');
    const custRes = await fetch(`${BASE_URL}/customers`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const custData = await custRes.json();
    const acmeCustomer = custData.data.find((c) => c.name.includes('Acme')) || custData.data[0];

    const prodRes = await fetch(`${BASE_URL}/products`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const prodData = await prodRes.json();
    const laptop = prodData.data.find((p) => p.name.includes('Laptop X')) || prodData.data[0];
    const install = prodData.data.find((p) => p.name.includes('Installation')) || prodData.data[1];
    const support = prodData.data.find((p) => p.name.includes('Support')) || prodData.data[2];

    // Create Draft
    const createRes = await fetch(`${BASE_URL}/quotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salesToken}`,
      },
      body: JSON.stringify({
        customerId: acmeCustomer.id,
        items: [
          { productId: laptop.id, quantity: 10, discountPercentage: 12 },
          { productId: install.id, quantity: 1, discountPercentage: 18 }, // Ceiling violation (18% > 10%)
          { productId: support.id, quantity: 10, discountPercentage: 5 },
        ],
        notes: 'Enterprise fleet deal with high service discount',
      }),
    });
    const createData = await createRes.json();
    const quoteId = createData.data.id;
    const quoteNumber = createData.data.quoteNumber;
    console.log(`✅ Draft created: ${quoteNumber} (ID: ${quoteId})`);

    // Submit Quote (triggers approval requirement)
    const submitRes = await fetch(`${BASE_URL}/quotations/${quoteId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const submitData = await submitRes.json();
    console.log(`✅ Quote submitted: Status is ${submitData.data.status} (${submitData.data.approvalStatus}), Risk: ${submitData.data.riskLevel} (${submitData.data.riskScore}/100)\n`);

    if (submitData.data.status !== 'PENDING_APPROVAL' || submitData.data.approvalStatus !== 'PENDING_MANAGER') {
      throw new Error(`Expected PENDING_APPROVAL / PENDING_MANAGER, got ${submitData.data.status} / ${submitData.data.approvalStatus}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3: Fetch Manager Dashboard Metrics
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Step 3: Fetching Manager Dashboard via GET /api/manager/dashboard...');
    const dashRes = await fetch(`${BASE_URL}/manager/dashboard`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const dashData = await dashRes.json();
    if (!dashRes.ok || !dashData.success) {
      throw new Error('Manager dashboard failed: ' + JSON.stringify(dashData));
    }
    const kpis = dashData.data.kpis;
    console.log(`✅ Dashboard KPIs loaded:`);
    console.log(`   Pending Approvals: ${kpis.pendingApprovals}`);
    console.log(`   High Risk Deals: ${kpis.highRiskDeals}`);
    console.log(`   Total Pending Value: ₹${kpis.totalPendingValue}`);
    console.log(`   Approved Today: ${kpis.approvedToday}`);
    console.log(`   Returned Count: ${kpis.returnedCount}\n`);

    if (kpis.pendingApprovals < 1) {
      throw new Error('Expected at least 1 pending approval on dashboard');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4: Fetch Approval Inbox
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Step 4: Fetching Approval Inbox via GET /api/manager/approvals...');
    const inboxRes = await fetch(`${BASE_URL}/manager/approvals?status=PENDING`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const inboxData = await inboxRes.json();
    if (!inboxRes.ok || !inboxData.success) {
      throw new Error('Approval inbox failed: ' + JSON.stringify(inboxData));
    }

    const foundInInbox = inboxData.data.find((q) => q.id === quoteId);
    if (!foundInInbox) {
      throw new Error(`Quotation ${quoteNumber} not found in Manager Approval Inbox`);
    }
    console.log(`✅ Quotation ${quoteNumber} found in Approval Inbox!`);
    console.log(`   Waiting Time: ${foundInInbox.waitingTime}`);
    console.log(`   Violations: ${foundInInbox.violationsCount} ceiling violation(s)`);
    console.log(`   Margin Delta: ${foundInInbox.marginDeltaPercentage}%\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 5: Fetch Approval Decision Dossier
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`Step 5: Fetching Decision Dossier via GET /api/manager/approvals/${quoteId}...`);
    const dossierRes = await fetch(`${BASE_URL}/manager/approvals/${quoteId}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const dossierData = await dossierRes.json();
    if (!dossierRes.ok || !dossierData.success) {
      throw new Error('Dossier fetch failed: ' + JSON.stringify(dossierData));
    }

    const telemetry = dossierData.data.telemetry;
    const violations = telemetry.violations;
    console.log(`✅ Dossier telemetry verified:`);
    console.log(`   Violations Detected: ${violations.length}`);
    violations.forEach((v) => {
      console.log(`   • ${v.productName} (${v.productType}): applied ${v.appliedDiscount}% exceeds ceiling of ${v.maxAllowed}% (+${v.excessPercentage}% excess)`);
    });
    console.log(`   Base Margin: ${telemetry.marginDelta.baseMarginPercentage}% vs Proposed: ${telemetry.marginDelta.currentMarginPercentage}% (Delta: ${telemetry.marginDelta.marginDeltaPercentage}%)`);
    console.log(`   Approval Chain: ${telemetry.approvalChain.map((s) => `${s.label} [${s.status}]`).join(' -> ')}\n`);

    if (violations.length === 0) {
      throw new Error('Expected discount ceiling violation to be reported');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 6: Test Self-Approval Prevention
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Step 6: Testing Self-Approval Prevention (Sales Rep attempting to approve own quote)...');
    const selfApproveRes = await fetch(`${BASE_URL}/manager/approvals/${quoteId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salesToken}`,
      },
      body: JSON.stringify({ comment: 'Self approving' }),
    });

    if (selfApproveRes.status === 403) {
      console.log(`✅ Self-approval correctly blocked with HTTP 403 Forbidden!\n`);
    } else {
      throw new Error(`Expected HTTP 403 Forbidden for self-approval, got ${selfApproveRes.status}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 7: Test Mandatory Reason Validation for Reject & Return
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Step 7: Testing mandatory reason validation on Reject and Return...');
    const blankRejectRes = await fetch(`${BASE_URL}/manager/approvals/${quoteId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ reason: '' }), // Blank
    });
    if (blankRejectRes.status === 400) {
      console.log(`✅ Blank rejection reason rejected with HTTP 400 Bad Request!`);
    } else {
      throw new Error(`Expected HTTP 400 for blank rejection reason, got ${blankRejectRes.status}`);
    }

    const blankReturnRes = await fetch(`${BASE_URL}/manager/approvals/${quoteId}/return-for-revision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ reason: '   ' }), // Blank spaces
    });
    if (blankReturnRes.status === 400) {
      console.log(`✅ Blank revision reason rejected with HTTP 400 Bad Request!\n`);
    } else {
      throw new Error(`Expected HTTP 400 for blank revision reason, got ${blankReturnRes.status}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 8: Return for Revision Flow (Section 17 & 40)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Step 8: Executing Return for Revision as Manager...');
    const returnRes = await fetch(`${BASE_URL}/manager/approvals/${quoteId}/return-for-revision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        reason: 'Reduce Installation Service discount to 10% or provide commercial justification.',
      }),
    });
    const returnData = await returnRes.json();
    if (!returnRes.ok || !returnData.success) {
      throw new Error('Return for revision failed: ' + JSON.stringify(returnData));
    }
    console.log(`✅ Quote returned for revision: Status is now ${returnData.data.status} (${returnData.data.approvalStatus})\n`);

    if (returnData.data.status !== 'RETURNED_FOR_REVISION') {
      throw new Error(`Expected status RETURNED_FOR_REVISION, got ${returnData.data.status}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 9: Sales Rep Edits and Resubmits the Revised Quote (Section 17 & 40)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Step 9: Sales Rep receives returned quote, adjusts Installation discount (18% -> 10%), and resubmits...');
    // Update quote items
    const updateRes = await fetch(`${BASE_URL}/quotations/${quoteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salesToken}`,
      },
      body: JSON.stringify({
        items: [
          { productId: laptop.id, quantity: 10, discountPercentage: 12 },
          { productId: install.id, quantity: 1, discountPercentage: 10 }, // Compliant discount (10% == 10% ceiling)
          { productId: support.id, quantity: 10, discountPercentage: 5 },
        ],
        notes: 'Revised as requested: reduced installation discount to 10%',
      }),
    });
    const updateData = await updateRes.json();
    if (!updateRes.ok || !updateData.success) {
      throw new Error('Failed to update returned quotation: ' + JSON.stringify(updateData));
    }
    console.log(`✅ Sales Rep successfully modified returned quote draft`);

    // Resubmit
    const resubmitRes = await fetch(`${BASE_URL}/quotations/${quoteId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const resubmitData = await resubmitRes.json();
    if (!resubmitRes.ok || !resubmitData.success) {
      throw new Error('Resubmission failed: ' + JSON.stringify(resubmitData));
    }
    console.log(`✅ Quote resubmitted! Authoritative recalculation applied.`);
    console.log(`   New Status: ${resubmitData.data.status} (${resubmitData.data.approvalStatus})`);
    console.log(`   New Risk Score: ${resubmitData.data.riskScore} (${resubmitData.data.riskLevel})\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 10: Create and Approve another deal as Manager
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Step 10: Testing Manager Approval action on a fresh quotation...');
    // Create another high-risk quote to test direct Manager approval
    const q2CreateRes = await fetch(`${BASE_URL}/quotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salesToken}`,
      },
      body: JSON.stringify({
        customerId: acmeCustomer.id,
        items: [
          { productId: laptop.id, quantity: 5, discountPercentage: 14 },
          { productId: install.id, quantity: 1, discountPercentage: 16 }, // Exceeds 10%
        ],
      }),
    });
    const q2Id = (await q2CreateRes.json()).data.id;
    await fetch(`${BASE_URL}/quotations/${q2Id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${salesToken}` },
    });

    // Manager Approves
    const approveRes = await fetch(`${BASE_URL}/manager/approvals/${q2Id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        comment: 'Approved due to strategic enterprise partnership with Acme.',
      }),
    });
    const approveData = await approveRes.json();
    if (!approveRes.ok || !approveData.success) {
      throw new Error('Approval failed: ' + JSON.stringify(approveData));
    }
    console.log(`✅ Manager successfully approved deal! Status: ${approveData.data.status} (${approveData.data.approvalStatus})\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 11: Concurrency Protection (Double Approval Prevention)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Step 11: Testing Double Approval / Stale State Concurrency Protection...');
    const secondApproveRes = await fetch(`${BASE_URL}/manager/approvals/${q2Id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ comment: 'Attempting duplicate approval' }),
    });

    if (secondApproveRes.status === 409) {
      console.log(`✅ Concurrency protection verified: Stale approval attempt rejected with HTTP 409 Conflict!\n`);
    } else {
      throw new Error(`Expected HTTP 409 Conflict for duplicate approval, got ${secondApproveRes.status}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 12: Approval History & Audit Trail Verification
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Step 12: Fetching Approval History via GET /api/manager/history...');
    const histRes = await fetch(`${BASE_URL}/manager/history`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const histData = await histRes.json();
    if (!histRes.ok || !histData.success) {
      throw new Error('Failed to fetch approval history: ' + JSON.stringify(histData));
    }
    console.log(`✅ Approval History verified: ${histData.data.length} historical action(s) found.`);
    histData.data.slice(0, 3).forEach((h) => {
      console.log(`   • [${h.status}] Quote ${h.quotation?.quoteNumber} by ${h.approver?.name} (${h.reason || h.comment || 'Approved'})`);
    });

    console.log('\n🎉 ALL 12 SALES MANAGER & APPROVER PORTAL CHECKS PASSED PERFECTLY!');
  } catch (err) {
    console.error('\n❌ Verification failed:', err.message);
    process.exit(1);
  }
}

runVerification();
