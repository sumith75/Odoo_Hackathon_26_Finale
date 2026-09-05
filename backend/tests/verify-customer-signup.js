const BASE_URL = 'http://localhost:5000/api';

async function verifyCustomerSignup() {
  console.log('🧪 Starting Customer Sign-Up and Auth Verification...\n');

  try {
    // 1. Fetch public organizations
    console.log('Step 1: Fetching public organizations via GET /api/auth/organizations...');
    const orgsRes = await fetch(`${BASE_URL}/auth/organizations`);
    const orgsData = await orgsRes.json();
    if (!orgsData.success || !Array.isArray(orgsData.data) || orgsData.data.length === 0) {
      throw new Error('Failed to fetch organizations list: ' + JSON.stringify(orgsData));
    }
    const primaryOrg = orgsData.data[0];
    console.log(`✅ Organizations fetched: Found ${orgsData.data.length} organization(s). Primary: ${primaryOrg.name} (${primaryOrg.id})\n`);

    // 2. Register a new customer
    const testEmail = `newcustomer.${Date.now()}@testcorp.com`;
    console.log(`Step 2: Registering a new customer (${testEmail})...`);
    const regRes = await fetch(`${BASE_URL}/auth/register-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Robert Fox',
        email: testEmail,
        password: 'Customer@123',
        companyName: 'Fox Technologies LLC',
        tenantId: primaryOrg.id,
      }),
    });
    const regData = await regRes.json();

    if (!regRes.ok || !regData.success || !regData.token || !regData.user) {
      throw new Error('Customer registration failed: ' + JSON.stringify(regData));
    }
    const regUser = regData.user;
    console.log(`✅ Customer registered successfully!`);
    console.log(`   ID: ${regUser.id}`);
    console.log(`   Name: ${regUser.name}`);
    console.log(`   Email: ${regUser.email}`);
    console.log(`   Role: ${regUser.role}`);
    console.log(`   Company: ${regUser.companyName}`);
    console.log(`   Tenant: ${regUser.organizationName} (${regUser.tenantId})\n`);

    if (regUser.role !== 'CUSTOMER') {
      throw new Error(`Expected role to be CUSTOMER, got ${regUser.role}`);
    }

    // 3. Login with newly registered customer
    console.log('Step 3: Testing login with the newly created customer credentials...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Customer@123',
      }),
    });
    const loginData = await loginRes.json();

    if (!loginRes.ok || !loginData.success || !loginData.token) {
      throw new Error('Customer login failed with valid credentials: ' + JSON.stringify(loginData));
    }
    console.log(`✅ Customer login verified! Token received: ${loginData.token.slice(0, 20)}...\n`);

    // 4. Duplicate registration protection
    console.log('Step 4: Testing duplicate email registration protection...');
    const dupRes = await fetch(`${BASE_URL}/auth/register-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Fox',
        email: testEmail,
        password: 'Customer@123',
        tenantId: primaryOrg.id,
      }),
    });

    if (dupRes.status === 409) {
      console.log(`✅ Duplicate registration correctly rejected with HTTP 409 Conflict!\n`);
    } else {
      throw new Error(`Expected 409 Conflict for duplicate registration, got status ${dupRes.status}`);
    }

    // 5. Test seeded customer login
    console.log('Step 5: Testing seeded demo customer (customer@acme.com)...');
    const seededRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@acme.com',
        password: 'Customer@123',
      }),
    });
    const seededData = await seededRes.json();

    if (seededRes.ok && seededData.success && seededData.user.role === 'CUSTOMER') {
      console.log(`✅ Seeded customer login verified: ${seededData.user.name} (${seededData.user.tier} Tier)\n`);
    } else {
      throw new Error('Seeded customer login failed: ' + JSON.stringify(seededData));
    }

    console.log('🎉 ALL CUSTOMER SIGN-UP AND AUTH CHECKS PASSED PERFECTLY!');
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  }
}

verifyCustomerSignup();
