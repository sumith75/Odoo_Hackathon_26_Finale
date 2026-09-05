// Comprehensive Automated Verification for Admin Product Catalog Management
// Tests: Adding, Editing, Deleting, and Filtering across All Products, Hardware, Service, Subscription, Bundle
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
  console.log('🚀 Starting Admin Product Catalog Management Verification...\n');

  // 1. Authenticate as Admin
  console.log('Step 1: Authenticating as Admin (admin@techworld.com)...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@techworld.com', password: 'Admin@123' }),
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login failed');
  const adminToken = loginRes.data.token;
  const adminTenantId = loginRes.data.user.tenantId;
  console.log(`✅ Admin authenticated. Tenant: ${adminTenantId}\n`);

  // 2. Authenticate as Sales Rep (to test RBAC protections)
  console.log('Step 2: Authenticating as Sales Rep (sales@techworld.com)...');
  const salesLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'sales@techworld.com', password: 'Sales@123' }),
  });
  assert.strictEqual(salesLogin.status, 200, 'Sales login failed');
  const salesToken = salesLogin.data.token;
  console.log('✅ Sales rep authenticated for RBAC tests\n');

  const timestamp = Date.now();

  // 3. Adding Products of all 4 types: HARDWARE, SERVICE, SUBSCRIPTION, BUNDLE
  console.log('Step 3: Creating products across all 4 types...');

  // 3A. HARDWARE
  const hwSku = `HW-TEST-${timestamp}`;
  const hwRes = await request('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'High-Density Rack Server',
      sku: hwSku,
      type: 'HARDWARE',
      category: 'Hardware',
      unitPrice: 125000,
      currency: 'INR',
      billingType: 'ONE_TIME',
      taxRate: 18,
      maxDiscountPercentage: 15,
      isInventoryTracked: true,
      description: 'Dual Xeon 32-core rackmount enterprise server',
    }),
  });
  assert.strictEqual(hwRes.status, 201, `Failed to create HARDWARE: ${JSON.stringify(hwRes.data)}`);
  assert.strictEqual(hwRes.data.data.type, 'HARDWARE');
  assert.strictEqual(hwRes.data.data.isInventoryTracked, true);
  const hwProduct = hwRes.data.data;
  console.log(`✅ HARDWARE created: ${hwProduct.name} (${hwProduct.sku})`);

  // 3B. SERVICE
  const srvSku = `SRV-TEST-${timestamp}`;
  const srvRes = await request('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Cloud Migration & Deployment Service',
      sku: srvSku,
      type: 'SERVICE',
      category: 'Professional Services',
      unitPrice: 45000,
      currency: 'INR',
      billingType: 'ONE_TIME',
      taxRate: 18,
      maxDiscountPercentage: 20,
      isInventoryTracked: false,
      description: 'End-to-end cloud infrastructure cutover support',
    }),
  });
  assert.strictEqual(srvRes.status, 201, `Failed to create SERVICE: ${JSON.stringify(srvRes.data)}`);
  assert.strictEqual(srvRes.data.data.type, 'SERVICE');
  assert.strictEqual(srvRes.data.data.isInventoryTracked, false);
  const srvProduct = srvRes.data.data;
  console.log(`✅ SERVICE created: ${srvProduct.name} (${srvProduct.sku})`);

  // 3C. SUBSCRIPTION
  const subSku = `SUB-TEST-${timestamp}`;
  const subRes = await request('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: '24/7 Premium Enterprise SLA Support',
      sku: subSku,
      type: 'SUBSCRIPTION',
      category: 'Subscription',
      unitPrice: 18000,
      currency: 'INR',
      billingType: 'RECURRING',
      billingInterval: 'MONTHLY',
      taxRate: 18,
      maxDiscountPercentage: 10,
      isInventoryTracked: false,
      description: 'Dedicated technical account manager and 15-minute response SLA',
    }),
  });
  assert.strictEqual(subRes.status, 201, `Failed to create SUBSCRIPTION: ${JSON.stringify(subRes.data)}`);
  assert.strictEqual(subRes.data.data.type, 'SUBSCRIPTION');
  assert.strictEqual(subRes.data.data.billingType, 'RECURRING');
  assert.strictEqual(subRes.data.data.billingInterval, 'MONTHLY');
  const subProduct = subRes.data.data;
  console.log(`✅ SUBSCRIPTION created: ${subProduct.name} (${subProduct.sku})`);

  // 3D. BUNDLE
  const bndSku = `BND-TEST-${timestamp}`;
  const bndRes = await request('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Complete Datacenter Starter Bundle',
      sku: bndSku,
      type: 'BUNDLE',
      category: 'Bundle Packages',
      unitPrice: 175000,
      currency: 'INR',
      billingType: 'ONE_TIME',
      taxRate: 18,
      maxDiscountPercentage: 25,
      isInventoryTracked: false,
      description: 'Hardware server + Migration service + 1 month SLA bundled offer',
    }),
  });
  assert.strictEqual(bndRes.status, 201, `Failed to create BUNDLE: ${JSON.stringify(bndRes.data)}`);
  assert.strictEqual(bndRes.data.data.type, 'BUNDLE');
  const bndProduct = bndRes.data.data;
  console.log(`✅ BUNDLE created: ${bndProduct.name} (${bndProduct.sku})\n`);

  // 4. Query and Verify Filtering across All Products, Hardware, Service, Subscription, Bundle
  console.log('Step 4: Querying catalog and testing type filtering...');
  const allRes = await request('/api/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(allRes.status, 200);
  const allList = allRes.data.data;
  console.log(`- Total catalog items retrieved: ${allList.length}`);

  const hwFound = allList.find((p) => p.sku === hwSku);
  const srvFound = allList.find((p) => p.sku === srvSku);
  const subFound = allList.find((p) => p.sku === subSku);
  const bndFound = allList.find((p) => p.sku === bndSku);

  assert.ok(hwFound, 'Created HARDWARE not found in catalog');
  assert.ok(srvFound, 'Created SERVICE not found in catalog');
  assert.ok(subFound, 'Created SUBSCRIPTION not found in catalog');
  assert.ok(bndFound, 'Created BUNDLE not found in catalog');

  // Verify type filter behavior matches frontend logic:
  const hwItems = allList.filter((p) => p.type === 'HARDWARE');
  const srvItems = allList.filter((p) => p.type === 'SERVICE');
  const subItems = allList.filter((p) => p.type === 'SUBSCRIPTION');
  const bndItems = allList.filter((p) => p.type === 'BUNDLE');

  assert.ok(hwItems.length >= 1, 'Filter HARDWARE should return at least 1 item');
  assert.ok(srvItems.length >= 1, 'Filter SERVICE should return at least 1 item');
  assert.ok(subItems.length >= 1, 'Filter SUBSCRIPTION should return at least 1 item');
  assert.ok(bndItems.length >= 1, 'Filter BUNDLE should return at least 1 item');
  console.log(`✅ Filters verified: HARDWARE (${hwItems.length}), SERVICE (${srvItems.length}), SUBSCRIPTION (${subItems.length}), BUNDLE (${bndItems.length})\n`);

  // 5. Editing Product functionality
  console.log('Step 5: Testing Admin Product Editing (PUT /api/products/:id)...');
  const editRes = await request(`/api/products/${srvProduct.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Cloud Migration & DevOps Deployment Service (Updated)',
      description: 'Comprehensive multi-cloud infrastructure cutover support',
      unitPrice: 52000,
      category: 'Cloud Engineering',
      taxRate: 18,
      maxDiscountPercentage: 25,
      type: 'SERVICE',
    }),
  });
  assert.strictEqual(editRes.status, 200, `Failed to update product: ${JSON.stringify(editRes.data)}`);
  assert.strictEqual(editRes.data.data.name, 'Cloud Migration & DevOps Deployment Service (Updated)');
  assert.strictEqual(Number(editRes.data.data.unitPrice), 52000);
  assert.strictEqual(editRes.data.data.category, 'Cloud Engineering');
  console.log(`✅ Product updated successfully: ${editRes.data.data.name} with price ₹${editRes.data.data.unitPrice}\n`);

  // 6. RBAC Protection: Non-admin cannot update or delete products
  console.log('Step 6: Verifying RBAC protection (Sales Rep cannot edit/delete products)...');
  const unauthorizedEdit = await request(`/api/products/${srvProduct.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({ name: 'Hacked Product Name' }),
  });
  assert.strictEqual(unauthorizedEdit.status, 403, 'Sales Rep should be forbidden from editing products');

  const unauthorizedDelete = await request(`/api/products/${srvProduct.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(unauthorizedDelete.status, 403, 'Sales Rep should be forbidden from deleting products');
  console.log('✅ RBAC enforced: Non-admin mutations rejected with 403 Forbidden\n');

  // 7. Deleting unreferenced products (Hard-delete)
  console.log('Step 7: Testing Hard-Delete on unreferenced products...');
  // Delete hwProduct, srvProduct, subProduct, bndProduct
  for (const prod of [hwProduct, srvProduct, subProduct, bndProduct]) {
    const delRes = await request(`/api/products/${prod.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(delRes.status, 200, `Failed to delete product ${prod.id}: ${JSON.stringify(delRes.data)}`);
    assert.strictEqual(delRes.data.success, true);
    console.log(`✅ Hard-deleted product: ${prod.name} (${prod.sku})`);

    // Verify it is gone
    const checkRes = await request(`/api/products/${prod.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(checkRes.status, 404, 'Product should return 404 after hard-delete');
  }
  console.log('✅ Hard deletion verified for unreferenced products\n');

  // 8. Safe Deactivation (Soft-delete) for products referenced in historical quotations
  console.log('Step 8: Testing Safe Deactivation on products referenced by historical quotes...');
  // Find an existing product used in quotation items
  const quoteProductsRes = await request('/api/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(quoteProductsRes.status, 200);
  const activeProducts = quoteProductsRes.data.data;
  
  // Pick the first available product in TechWorld that might have quote items
  // Let's create a temporary product and a draft quotation referencing it
  const tempSku = `QUOTE-REF-${timestamp}`;
  const tempProdRes = await request('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Referenced Asset Product',
      sku: tempSku,
      type: 'HARDWARE',
      unitPrice: 10000,
      taxRate: 18,
      maxDiscountPercentage: 10,
    }),
  });
  assert.strictEqual(tempProdRes.status, 201);
  const tempProd = tempProdRes.data.data;

  // Find a customer to create a quotation
  const custRes = await request('/api/customers', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const customer = custRes.data.data?.[0] || custRes.data.customers?.[0];

  if (customer) {
    const quoteRes = await request('/api/quotations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        customerId: customer.id,
        items: [
          {
            productId: tempProd.id,
            quantity: 1,
            unitPrice: 10000,
            discountPercentage: 0,
          },
        ],
      }),
    });
    assert.strictEqual(quoteRes.status, 201, 'Quotation creation failed');
    console.log(`- Created quotation referencing "${tempProd.name}"`);

    // Now try to delete this referenced product
    const softDelRes = await request(`/api/products/${tempProd.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(softDelRes.status, 200);
    assert.strictEqual(softDelRes.data.success, true);
    assert.ok(
      softDelRes.data.message.includes('historical quotations or transactions'),
      'Expected safe deactivation message'
    );
    assert.strictEqual(softDelRes.data.data.isActive, false, 'Expected isActive = false');
    console.log(`✅ Safe deactivation confirmed: "${tempProd.name}" deactivated to preserve audit integrity\n`);
  }

  console.log('🎉 ALL ADMIN PRODUCT MANAGEMENT TESTS PASSED PERFECTLY!\n');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
