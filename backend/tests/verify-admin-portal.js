// Comprehensive E2E Verification for Admin Portal & Multi-Tenancy
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
  console.log('🚀 Starting Admin Portal & Multi-Tenancy Automated Verification...\n');

  // 1. Login as Seeded Admin
  console.log('Step 1: Authenticating as TechWorld Admin (admin@techworld.com)...');
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@techworld.com', password: 'Admin@123' }),
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  assert.strictEqual(adminLogin.data.success, true);
  assert.strictEqual(adminLogin.data.user.role, 'ADMIN');
  const adminToken = adminLogin.data.token;
  const techworldTenantId = adminLogin.data.user.tenantId;
  console.log(`✅ Admin logged in. TenantId: ${techworldTenantId}\n`);

  // 2. Fetch Admin Dashboard
  console.log('Step 2: Testing GET /api/admin/dashboard...');
  const dashRes = await request('/api/admin/dashboard', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(dashRes.status, 200);
  assert.strictEqual(dashRes.data.success, true);
  assert.ok(dashRes.data.data.team.total >= 4, 'Expected at least 4 team members in TechWorld');
  assert.ok(dashRes.data.data.products.total >= 5, 'Expected at least 5 products in TechWorld');
  console.log(`✅ Dashboard metrics verified: ${dashRes.data.data.team.total} members, ${dashRes.data.data.products.total} products\n`);

  // 3. Update Organization Settings
  console.log('Step 3: Testing GET & PUT /api/organization...');
  const orgGet = await request('/api/organization', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(orgGet.status, 200);
  assert.strictEqual(orgGet.data.data.name, 'TechWorld Solutions');

  const orgPut = await request('/api/organization', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      phone: '+91 91234 56789',
      address: 'Plot 42, Hitech City Phase 2, Hyderabad, Telangana',
    }),
  });
  assert.strictEqual(orgPut.status, 200);
  assert.strictEqual(orgPut.data.data.phone, '+91 91234 56789');
  console.log('✅ Organization profile updated successfully\n');

  // 4. Provision a new employee (direct active account)
  console.log('Step 4: Provisioning new Sales Representative via POST /api/team...');
  const testEmail = `sales.rep.${Date.now()}@techworld.com`;
  const teamPost = await request('/api/team', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Kavita Iyer',
      email: testEmail,
      password: 'Kavita@123Password',
      role: 'SALES_REP',
      phone: '+91 98888 11111',
    }),
  });
  assert.strictEqual(teamPost.status, 201);
  assert.strictEqual(teamPost.data.data.status, 'ACTIVE');
  const newMemberId = teamPost.data.data.id;
  console.log(`✅ Provisioned new member ${testEmail} with status ACTIVE\n`);

  // 5. Test direct login for the newly provisioned employee
  console.log('Step 5: Testing immediate login of the newly created employee...');
  const empLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: 'Kavita@123Password' }),
  });
  assert.strictEqual(empLogin.status, 200, 'Newly created employee failed to log in');
  assert.strictEqual(empLogin.data.user.role, 'SALES_REP');
  assert.strictEqual(empLogin.data.user.tenantId, techworldTenantId);
  console.log('✅ Employee logged in successfully with zero verification hurdles!\n');

  // 6. Toggle team member status
  console.log('Step 6: Testing status toggle via PATCH /api/team/:id/status...');
  const toggleRes = await request(`/api/team/${newMemberId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'INACTIVE' }),
  });
  assert.strictEqual(toggleRes.status, 200);
  assert.strictEqual(toggleRes.data.data.status, 'INACTIVE');

  // Inactive user should not be allowed to log in
  const blockedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: 'Kavita@123Password' }),
  });
  assert.strictEqual(blockedLogin.status, 403, 'Inactive user should be rejected');
  console.log('✅ Inactive member correctly blocked from logging in\n');

  // 7. Product Catalog Management
  console.log('Step 7: Testing Product Catalog CRUD (POST & GET /api/products)...');
  const sku = `SRV-${Date.now()}`;
  const prodPost = await request('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Cloud Security Audit Service',
      sku,
      type: 'SERVICE',
      category: 'SERVICE',
      unitPrice: 45000,
      taxRate: 18,
      maxDiscountPercentage: 15,
      isInventoryTracked: false,
    }),
  });
  assert.strictEqual(prodPost.status, 201);
  assert.strictEqual(prodPost.data.data.sku, sku);
  console.log(`✅ Product ${sku} created successfully\n`);

  // 8. Discount & Approval Rules
  console.log('Step 8: Testing Discount Rules & Approval Ladder...');
  const rulePost = await request('/api/discount-rules', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Q3 Enterprise Hardware Discount',
      productType: 'HARDWARE',
      customerTier: 'GOLD',
      maxDiscountPercentage: 25,
      requiresApprovalAbove: 12,
      requiresFinanceApprovalAbove: 20,
    }),
  });
  assert.strictEqual(rulePost.status, 201);

  const approvalPost = await request('/api/approval-rules', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'High Risk Escalation Tier',
      productType: 'HARDWARE',
      minDiscountPercentage: 20.01,
      maxDiscountPercentage: 35.0,
      requiredRole: 'FINANCE_OPERATIONS',
      priority: 2,
    }),
  });
  assert.strictEqual(approvalPost.status, 201);
  console.log('✅ Discount rule and Approval ladder tier created successfully\n');

  // 9. Audit Activity Log Check
  console.log('Step 9: Testing Audit Trail Stream (GET /api/audit)...');
  const auditRes = await request('/api/audit', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(auditRes.status, 200);
  assert.ok(auditRes.data.data.length >= 5, 'Expected multiple audit log records');
  console.log(`✅ Audit trail verified (${auditRes.data.data.length} records retrieved)\n`);

  // 10. STRICT MULTI-TENANT ISOLATION TEST
  console.log('Step 10: Multi-Tenant Isolation Verification...');
  const uniqueOrgEmail = `admin.apex.${Date.now()}@apexenterprises.com`;
  const registerApex = await request('/api/auth/register-organization', {
    method: 'POST',
    body: JSON.stringify({
      organizationName: 'Apex Enterprises',
      adminName: 'Rohan Verma',
      email: uniqueOrgEmail,
      password: 'ApexPassword@123',
      currency: 'USD',
      industry: 'Manufacturing',
    }),
  });
  assert.strictEqual(registerApex.status, 201);
  const apexToken = registerApex.data.token;
  const apexTenantId = registerApex.data.user.tenantId;
  assert.notStrictEqual(apexTenantId, techworldTenantId, 'Tenant IDs must be strictly different');

  // Verify Apex Admin sees 0 TechWorld products
  const apexProducts = await request('/api/products', {
    headers: { Authorization: `Bearer ${apexToken}` },
  });
  assert.strictEqual(apexProducts.status, 200);
  assert.strictEqual(apexProducts.data.data.length, 0, 'New tenant must have 0 products initially');

  // Verify Apex Admin sees only themselves in team roster
  const apexTeam = await request('/api/team', {
    headers: { Authorization: `Bearer ${apexToken}` },
  });
  assert.strictEqual(apexTeam.status, 200);
  assert.strictEqual(apexTeam.data.data.length, 1, 'New tenant must only have 1 member (the admin)');
  assert.strictEqual(apexTeam.data.data[0].email, uniqueOrgEmail);

  // Verify TechWorld Admin does not see Apex's admin
  const techworldTeam = await request('/api/team', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const leakedUser = techworldTeam.data.data.find((m) => m.email === uniqueOrgEmail);
  assert.strictEqual(leakedUser, undefined, 'TechWorld must NOT see Apex users!');

  console.log('✅ Multi-Tenant Isolation Verified: Zero cross-tenant leakage!\n');

  console.log('🎉 ALL 10 E2E VERIFICATION CHECKS PASSED PERFECTLY!');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
