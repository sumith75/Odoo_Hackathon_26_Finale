/**
 * seed.js — Multi-tenant Seed Script for DealFlow360
 *
 * Seeds:
 * - Organization: TechWorld Solutions
 * - Admin: Sneha Reddy (admin@techworld.com / Admin@123)
 * - Sales Rep: Rahul Sharma (rahul@techworld.com / Rahul@123) and sales@techworld.com (Sales@123)
 * - Sales Manager: Arjun Reddy (arjun@techworld.com / Arjun@123) and manager@techworld.com (Manager@123)
 * - Finance/Ops: Priya Rao (priya@techworld.com / Priya@123) and finance@techworld.com (Finance@123)
 * - Customers: Acme Corporation (GOLD tier), Global Dynamics (SILVER tier)
 * - 5 Products (Hardware, Service, Subscription) with costPrice
 * - Discount Rules & Approval Rules
 * - Initial Audit Logs
 */

import prisma from '../src/db/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding DealFlow360 Multi-Tenant Database...');

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { id: 'org-techworld-001' },
    update: {
      name: 'TechWorld Solutions',
      companyEmail: 'contact@techworld.com',
      phone: '+91 98765 43210',
      industry: 'Information Technology',
      country: 'India',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      address: 'Cyber Towers, Hitec City, Hyderabad, India',
    },
    create: {
      id: 'org-techworld-001',
      name: 'TechWorld Solutions',
      companyEmail: 'contact@techworld.com',
      phone: '+91 98765 43210',
      industry: 'Information Technology',
      country: 'India',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      address: 'Cyber Towers, Hitec City, Hyderabad, India',
    },
  });
  console.log(`  🏢 Organization seeded: ${org.name} (${org.id})`);

  // 2. Passwords
  const adminPass   = await bcrypt.hash('Admin@123', 10);
  const rahulPass   = await bcrypt.hash('Rahul@123', 10);
  const salesPass   = await bcrypt.hash('Sales@123', 10);
  const arjunPass   = await bcrypt.hash('Arjun@123', 10);
  const managerPass = await bcrypt.hash('Manager@123', 10);
  const priyaPass   = await bcrypt.hash('Priya@123', 10);
  const financePass = await bcrypt.hash('Finance@123', 10);
  const custPass    = await bcrypt.hash('Customer@123', 10);

  // 3. Admin Account
  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: org.id,
        email: 'admin@techworld.com',
      },
    },
    update: {
      name: 'Sneha Reddy',
      passwordHash: adminPass,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    create: {
      id: 'usr-admin-001',
      tenantId: org.id,
      name: 'Sneha Reddy',
      email: 'admin@techworld.com',
      passwordHash: adminPass,
      role: 'ADMIN',
      status: 'ACTIVE',
      phone: '+91 98111 00001',
    },
  });
  console.log(`  👤 Admin seeded: ${adminUser.name} <${adminUser.email}>`);

  // 4. Team Members (Sales Rep, Sales Manager, Finance/Ops)
  const rahul = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: org.id,
        email: 'rahul@techworld.com',
      },
    },
    update: {
      name: 'Rahul Sharma',
      passwordHash: rahulPass,
      role: 'SALES_REP',
      status: 'ACTIVE',
    },
    create: {
      id: 'usr-sales-001',
      tenantId: org.id,
      name: 'Rahul Sharma',
      email: 'rahul@techworld.com',
      passwordHash: rahulPass,
      role: 'SALES_REP',
      status: 'ACTIVE',
      phone: '+91 98111 00002',
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: org.id,
        email: 'sales@techworld.com',
      },
    },
    update: {
      name: 'Rahul Sharma (Sales)',
      passwordHash: salesPass,
      role: 'SALES_REP',
      status: 'ACTIVE',
    },
    create: {
      id: 'usr-sales-alias',
      tenantId: org.id,
      name: 'Rahul Sharma (Sales)',
      email: 'sales@techworld.com',
      passwordHash: salesPass,
      role: 'SALES_REP',
      status: 'ACTIVE',
      phone: '+91 98111 00002',
    },
  });

  const arjun = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: org.id,
        email: 'arjun@techworld.com',
      },
    },
    update: {
      name: 'Arjun Reddy',
      passwordHash: arjunPass,
      role: 'SALES_MANAGER',
      status: 'ACTIVE',
    },
    create: {
      id: 'usr-manager-001',
      tenantId: org.id,
      name: 'Arjun Reddy',
      email: 'arjun@techworld.com',
      passwordHash: arjunPass,
      role: 'SALES_MANAGER',
      status: 'ACTIVE',
      phone: '+91 98111 00003',
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: org.id,
        email: 'manager@techworld.com',
      },
    },
    update: {
      name: 'Arjun Reddy (Manager)',
      passwordHash: managerPass,
      role: 'SALES_MANAGER',
      status: 'ACTIVE',
    },
    create: {
      id: 'usr-manager-alias',
      tenantId: org.id,
      name: 'Arjun Reddy (Manager)',
      email: 'manager@techworld.com',
      passwordHash: managerPass,
      role: 'SALES_MANAGER',
      status: 'ACTIVE',
      phone: '+91 98111 00003',
    },
  });

  const priya = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: org.id,
        email: 'priya@techworld.com',
      },
    },
    update: {
      name: 'Priya Rao',
      passwordHash: priyaPass,
      role: 'FINANCE_OPERATIONS',
      status: 'ACTIVE',
    },
    create: {
      id: 'usr-finance-001',
      tenantId: org.id,
      name: 'Priya Rao',
      email: 'priya@techworld.com',
      passwordHash: priyaPass,
      role: 'FINANCE_OPERATIONS',
      status: 'ACTIVE',
      phone: '+91 98111 00004',
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: org.id,
        email: 'finance@techworld.com',
      },
    },
    update: {
      name: 'Priya Rao (Finance)',
      passwordHash: financePass,
      role: 'FINANCE_OPERATIONS',
      status: 'ACTIVE',
    },
    create: {
      id: 'usr-finance-alias',
      tenantId: org.id,
      name: 'Priya Rao (Finance)',
      email: 'finance@techworld.com',
      passwordHash: financePass,
      role: 'FINANCE_OPERATIONS',
      status: 'ACTIVE',
      phone: '+91 98111 00004',
    },
  });
  console.log('  👥 Team members seeded (Sales Rep, Sales Manager, Finance/Ops)');

  // 5. Customers
  const acmeCustomer = await prisma.customer.upsert({
    where: {
      tenantId_email: {
        tenantId: org.id,
        email: 'customer@acme.com',
      },
    },
    update: {
      name: 'Acme Corporation',
      companyName: 'Acme Corporation',
      tier: 'GOLD',
      currency: 'INR',
      status: 'ACTIVE',
      passwordHash: custPass,
    },
    create: {
      id: 'cust-acme-001',
      tenantId: org.id,
      name: 'Acme Corporation',
      companyName: 'Acme Corporation',
      email: 'customer@acme.com',
      tier: 'GOLD',
      currency: 'INR',
      status: 'ACTIVE',
      passwordHash: custPass,
    },
  });

  await prisma.customer.upsert({
    where: {
      tenantId_email: {
        tenantId: org.id,
        email: 'billing@globaldynamics.com',
      },
    },
    update: {
      name: 'Global Dynamics',
      companyName: 'Global Dynamics Pvt Ltd',
      tier: 'SILVER',
      currency: 'INR',
      status: 'ACTIVE',
      passwordHash: custPass,
    },
    create: {
      id: 'cust-global-002',
      tenantId: org.id,
      name: 'Global Dynamics',
      companyName: 'Global Dynamics Pvt Ltd',
      email: 'billing@globaldynamics.com',
      tier: 'SILVER',
      currency: 'INR',
      status: 'ACTIVE',
      passwordHash: custPass,
    },
  });
  console.log('  🏢 Demo Customers seeded: Acme Corporation (GOLD), Global Dynamics (SILVER)');

  // 6. Demo Products with costPrice for accurate margin engine
  const products = [
    {
      id: 'prod-001',
      tenantId: org.id,
      name: 'Laptop X',
      sku: 'LAPTOP-X',
      description: 'High-performance 16-core enterprise laptop with 32GB RAM & 1TB NVMe',
      type: 'HARDWARE',
      category: 'Computing',
      unitPrice: 80000.00,
      costPrice: 60000.00, // 25% gross margin base
      currency: 'INR',
      billingType: 'ONE_TIME',
      taxRate: 18.00,
      maxDiscountPercentage: 15.00, // Max discount ceiling 15%
      isInventoryTracked: true,
      isActive: true,
    },
    {
      id: 'prod-002',
      tenantId: org.id,
      name: 'Installation Service',
      sku: 'INSTALL-001',
      description: 'On-site installation, network configuration and security hardening',
      type: 'SERVICE',
      category: 'Professional Services',
      unitPrice: 20000.00,
      costPrice: 12000.00, // 40% margin base
      currency: 'INR',
      billingType: 'ONE_TIME',
      taxRate: 18.00,
      maxDiscountPercentage: 10.00, // Max discount ceiling 10%
      isInventoryTracked: false,
      isActive: true,
    },
    {
      id: 'prod-003',
      tenantId: org.id,
      name: 'Premium Support',
      sku: 'SUPPORT-PREMIUM',
      description: '24/7 priority enterprise support with 15-minute response SLA',
      type: 'SUBSCRIPTION',
      category: 'Support Plans',
      unitPrice: 3000.00,
      costPrice: 1000.00, // 66.7% margin base
      currency: 'INR',
      billingType: 'RECURRING',
      billingInterval: 'MONTHLY',
      taxRate: 18.00,
      maxDiscountPercentage: 5.00, // Max discount ceiling 5%
      isInventoryTracked: false,
      isActive: true,
    },
    {
      id: 'prod-004',
      tenantId: org.id,
      name: 'Business Monitor',
      sku: 'MONITOR-BIZ',
      description: '27-inch 4K UHD IPS color-calibrated professional monitor',
      type: 'HARDWARE',
      category: 'Peripherals',
      unitPrice: 25000.00,
      costPrice: 18000.00, // 28% margin base
      currency: 'INR',
      billingType: 'ONE_TIME',
      taxRate: 18.00,
      maxDiscountPercentage: 15.00,
      isInventoryTracked: true,
      isActive: true,
    },
    {
      id: 'prod-005',
      tenantId: org.id,
      name: 'Employee Training',
      sku: 'TRAINING-001',
      description: 'Full-day interactive hands-on training workshop for team onboarding',
      type: 'SERVICE',
      category: 'Training',
      unitPrice: 10000.00,
      costPrice: 5000.00, // 50% margin base
      currency: 'INR',
      billingType: 'ONE_TIME',
      taxRate: 18.00,
      maxDiscountPercentage: 10.00,
      isInventoryTracked: false,
      isActive: true,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { tenantId_sku: { tenantId: org.id, sku: p.sku } },
      update: p,
      create: p,
    });
  }
  console.log('  📦 5 Demo Products seeded with costPrice (Laptop X, Installation, Premium Support, Monitor, Training)');

  // 7. Discount Rules
  const discountRules = [
    {
      id: 'disc-rule-001',
      tenantId: org.id,
      name: 'Hardware Ceiling & Thresholds',
      productType: 'HARDWARE',
      category: 'Computing',
      customerTier: 'ALL',
      maxDiscountPercentage: 15.00,
      requiresApprovalAbove: 15.00,
      requiresFinanceApprovalAbove: 25.00,
      isActive: true,
    },
    {
      id: 'disc-rule-002',
      tenantId: org.id,
      name: 'Service Ceiling & Thresholds',
      productType: 'SERVICE',
      category: 'Professional Services',
      customerTier: 'ALL',
      maxDiscountPercentage: 10.00,
      requiresApprovalAbove: 10.00,
      requiresFinanceApprovalAbove: 20.00,
      isActive: true,
    },
    {
      id: 'disc-rule-003',
      tenantId: org.id,
      name: 'Subscription Ceiling & Thresholds',
      productType: 'SUBSCRIPTION',
      category: 'Support Plans',
      customerTier: 'ALL',
      maxDiscountPercentage: 5.00,
      requiresApprovalAbove: 5.00,
      requiresFinanceApprovalAbove: 10.00,
      isActive: true,
    },
  ];

  for (const dr of discountRules) {
    await prisma.discountRule.upsert({
      where: { id: dr.id },
      update: dr,
      create: dr,
    });
  }
  console.log('  🏷️ 3 Discount Rules seeded');

  // 8. Approval Rules
  const approvalRules = [
    {
      id: 'appr-rule-001',
      tenantId: org.id,
      name: 'Hardware - Manager Approval',
      productType: 'HARDWARE',
      minDiscountPercentage: 15.01,
      maxDiscountPercentage: 25.00,
      requiredRole: 'SALES_MANAGER',
      priority: 1,
      isActive: true,
    },
    {
      id: 'appr-rule-002',
      tenantId: org.id,
      name: 'Hardware - Manager + Finance Approval',
      productType: 'HARDWARE',
      minDiscountPercentage: 25.01,
      maxDiscountPercentage: 100.00,
      requiredRole: 'SALES_MANAGER_THEN_FINANCE',
      priority: 2,
      isActive: true,
    },
    {
      id: 'appr-rule-003',
      tenantId: org.id,
      name: 'Service - Manager Approval',
      productType: 'SERVICE',
      minDiscountPercentage: 10.01,
      maxDiscountPercentage: 20.00,
      requiredRole: 'SALES_MANAGER',
      priority: 1,
      isActive: true,
    },
    {
      id: 'appr-rule-004',
      tenantId: org.id,
      name: 'Service - Manager + Finance Approval',
      productType: 'SERVICE',
      minDiscountPercentage: 20.01,
      maxDiscountPercentage: 100.00,
      requiredRole: 'SALES_MANAGER_THEN_FINANCE',
      priority: 2,
      isActive: true,
    },
    {
      id: 'appr-rule-005',
      tenantId: org.id,
      name: 'Subscription - Manager Approval',
      productType: 'SUBSCRIPTION',
      minDiscountPercentage: 5.01,
      maxDiscountPercentage: 10.00,
      requiredRole: 'SALES_MANAGER',
      priority: 1,
      isActive: true,
    },
    {
      id: 'appr-rule-006',
      tenantId: org.id,
      name: 'Subscription - Manager + Finance Approval',
      productType: 'SUBSCRIPTION',
      minDiscountPercentage: 10.01,
      maxDiscountPercentage: 100.00,
      requiredRole: 'SALES_MANAGER_THEN_FINANCE',
      priority: 2,
      isActive: true,
    },
  ];

  for (const ar of approvalRules) {
    await prisma.approvalRule.upsert({
      where: { id: ar.id },
      update: ar,
      create: ar,
    });
  }
  console.log('  ⚖️ 6 Approval Rules seeded');

  // 9. Warehouses & Multi-Warehouse Inventory (Finance & Operations Module)
  const whBangalore = await prisma.warehouse.upsert({
    where: { id: 'wh-blr-001' },
    update: {
      name: 'Bangalore Fulfillment Center',
      code: 'BLR-01',
      location: 'Bangalore, Karnataka',
      address: 'Plot 42, Electronic City Phase 1, Bangalore',
      priority: 1, // First priority for deterministic allocation
      status: 'ACTIVE',
    },
    create: {
      id: 'wh-blr-001',
      tenantId: org.id,
      name: 'Bangalore Fulfillment Center',
      code: 'BLR-01',
      location: 'Bangalore, Karnataka',
      address: 'Plot 42, Electronic City Phase 1, Bangalore',
      priority: 1,
      status: 'ACTIVE',
    },
  });

  const whHyderabad = await prisma.warehouse.upsert({
    where: { id: 'wh-hyd-001' },
    update: {
      name: 'Hyderabad Central Logistics',
      code: 'HYD-01',
      location: 'Hyderabad, Telangana',
      address: 'Survey 115, Gachibowli Financial District, Hyderabad',
      priority: 2, // Second priority for split allocation
      status: 'ACTIVE',
    },
    create: {
      id: 'wh-hyd-001',
      tenantId: org.id,
      name: 'Hyderabad Central Logistics',
      code: 'HYD-01',
      location: 'Hyderabad, Telangana',
      address: 'Survey 115, Gachibowli Financial District, Hyderabad',
      priority: 2,
      status: 'ACTIVE',
    },
  });

  // Seed inventory: 8 Laptop X in Bangalore, 4 Laptop X in Hyderabad (Total 12 units)
  await prisma.inventory.upsert({
    where: {
      warehouseId_productId: {
        warehouseId: whBangalore.id,
        productId: 'prod-001',
      },
    },
    update: {
      availableQuantity: 8,
      reservedQuantity: 0,
      allocatedQuantity: 0,
      fulfilledQuantity: 0,
    },
    create: {
      tenantId: org.id,
      warehouseId: whBangalore.id,
      productId: 'prod-001',
      availableQuantity: 8,
      reservedQuantity: 0,
      allocatedQuantity: 0,
      fulfilledQuantity: 0,
    },
  });

  await prisma.inventory.upsert({
    where: {
      warehouseId_productId: {
        warehouseId: whHyderabad.id,
        productId: 'prod-001',
      },
    },
    update: {
      availableQuantity: 4,
      reservedQuantity: 0,
      allocatedQuantity: 0,
      fulfilledQuantity: 0,
    },
    create: {
      tenantId: org.id,
      warehouseId: whHyderabad.id,
      productId: 'prod-001',
      availableQuantity: 4,
      reservedQuantity: 0,
      allocatedQuantity: 0,
      fulfilledQuantity: 0,
    },
  });
  console.log('  🏭 Warehouses & Inventory seeded: BLR-01 (8 Laptop X), HYD-01 (4 Laptop X) [Total: 12 units]');

  // 10. Seed Demo Quotes for Finance & Operations Workflows
  // Quote 1: DF360-2026-000021 — 10 Laptop X + 1 Installation + 1 Premium Support (Splits: 8 BLR + 2 HYD)
  const demoQuote1 = await prisma.quotation.upsert({
    where: { id: 'quote-df360-000021' },
    update: {
      status: 'CUSTOMER_CONFIRMED',
      approvalStatus: 'APPROVED',
      fulfillmentStatus: 'PENDING',
      billingStatus: 'UNBILLED',
      subtotal: 823000.00,
      totalAmount: 823000.00,
      costAmount: 612500.00,
      marginAmount: 210500.00,
      marginPercentage: 25.58,
    },
    create: {
      id: 'quote-df360-000021',
      tenantId: org.id,
      quoteNumber: 'DF360-2026-000021',
      customerId: acmeCustomer.id,
      salesRepId: rahul.id,
      status: 'CUSTOMER_CONFIRMED',
      approvalStatus: 'APPROVED',
      fulfillmentStatus: 'PENDING',
      billingStatus: 'UNBILLED',
      subtotal: 823000.00,
      totalAmount: 823000.00,
      costAmount: 612500.00,
      marginAmount: 210500.00,
      marginPercentage: 25.58,
    },
  });

  // Delete previous items & allocations to allow clean reset if running seed repeatedly
  await prisma.warehouseAllocation.deleteMany({ where: { quotationId: demoQuote1.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { quotationId: demoQuote1.id } } });
  await prisma.payment.deleteMany({ where: { invoice: { quotationId: demoQuote1.id } } });
  await prisma.invoice.deleteMany({ where: { quotationId: demoQuote1.id } });
  await prisma.subscription.deleteMany({ where: { quotationId: demoQuote1.id } });
  await prisma.quotationItem.deleteMany({ where: { quotationId: demoQuote1.id } });

  await prisma.quotationItem.createMany({
    data: [
      {
        id: 'qitem-000021-1',
        quotationId: demoQuote1.id,
        productId: 'prod-001', // Laptop X (Hardware)
        productNameSnapshot: 'Laptop X',
        productTypeSnapshot: 'HARDWARE',
        quantity: 10,
        unitPrice: 80000.00,
        costPrice: 60000.00,
        discountPercentage: 0,
        discountAmount: 0,
        taxAmount: 0,
        lineTotal: 800000.00,
        marginAmount: 200000.00,
        marginPercentage: 25.00,
        serviceFulfilled: false,
      },
      {
        id: 'qitem-000021-2',
        quotationId: demoQuote1.id,
        productId: 'prod-002', // Installation Service (Service)
        productNameSnapshot: 'Installation Service',
        productTypeSnapshot: 'SERVICE',
        quantity: 1,
        unitPrice: 20000.00,
        costPrice: 12000.00,
        discountPercentage: 0,
        discountAmount: 0,
        taxAmount: 0,
        lineTotal: 20000.00,
        marginAmount: 8000.00,
        marginPercentage: 40.00,
        serviceFulfilled: false,
      },
      {
        id: 'qitem-000021-3',
        quotationId: demoQuote1.id,
        productId: 'prod-003', // Premium Support (Subscription)
        productNameSnapshot: 'Premium Support',
        productTypeSnapshot: 'SUBSCRIPTION',
        quantity: 1,
        unitPrice: 3000.00,
        costPrice: 500.00,
        discountPercentage: 0,
        discountAmount: 0,
        taxAmount: 0,
        lineTotal: 3000.00,
        marginAmount: 2500.00,
        marginPercentage: 83.33,
        serviceFulfilled: false,
      },
    ],
  });

  // Quote 2: DF360-2026-000022 — 15 Laptop X (Shortage Rejection Test: 15 requested vs 12 in stock)
  const demoQuote2 = await prisma.quotation.upsert({
    where: { id: 'quote-df360-000022' },
    update: {
      status: 'CUSTOMER_CONFIRMED',
      approvalStatus: 'APPROVED',
      fulfillmentStatus: 'PENDING',
      billingStatus: 'UNBILLED',
      subtotal: 1200000.00,
      totalAmount: 1200000.00,
      costAmount: 900000.00,
      marginAmount: 300000.00,
      marginPercentage: 25.00,
    },
    create: {
      id: 'quote-df360-000022',
      tenantId: org.id,
      quoteNumber: 'DF360-2026-000022',
      customerId: 'cust-global-002',
      salesRepId: rahul.id,
      status: 'CUSTOMER_CONFIRMED',
      approvalStatus: 'APPROVED',
      fulfillmentStatus: 'PENDING',
      billingStatus: 'UNBILLED',
      subtotal: 1200000.00,
      totalAmount: 1200000.00,
      costAmount: 900000.00,
      marginAmount: 300000.00,
      marginPercentage: 25.00,
    },
  });

  await prisma.warehouseAllocation.deleteMany({ where: { quotationId: demoQuote2.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { quotationId: demoQuote2.id } } });
  await prisma.payment.deleteMany({ where: { invoice: { quotationId: demoQuote2.id } } });
  await prisma.invoice.deleteMany({ where: { quotationId: demoQuote2.id } });
  await prisma.quotationItem.deleteMany({ where: { quotationId: demoQuote2.id } });

  await prisma.quotationItem.create({
    data: {
      id: 'qitem-000022-1',
      quotationId: demoQuote2.id,
      productId: 'prod-001', // 15 Laptop X
      productNameSnapshot: 'Laptop X',
      productTypeSnapshot: 'HARDWARE',
      quantity: 15,
      unitPrice: 80000.00,
      costPrice: 60000.00,
      discountPercentage: 0,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: 1200000.00,
      marginAmount: 300000.00,
      marginPercentage: 25.00,
      serviceFulfilled: false,
    },
  });

  console.log('  📦 Demo Quotes seeded:');
  console.log('     • DF360-2026-000021 (Acme: 10 Laptop X, 1 Install, 1 Support) -> Confirmed, Ready for Split Allocation');
  console.log('     • DF360-2026-000022 (Global: 15 Laptop X) -> Confirmed, Ready for Shortage Rejection Test');

  console.log('\n🎉 Seed completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏢 ORGANIZATION: TechWorld Solutions');
  console.log('🔑 DEMO CREDENTIALS:');
  console.log('   Admin:      admin@techworld.com  / Admin@123');
  console.log('   Sales Rep:  rahul@techworld.com  / Rahul@123  (or sales@techworld.com / Sales@123)');
  console.log('   Manager:    arjun@techworld.com  / Arjun@123  (or manager@techworld.com / Manager@123)');
  console.log('   Finance:    priya@techworld.com  / Priya@123  (or finance@techworld.com / Finance@123)');
  console.log('   Customer:   customer@acme.com    / Customer@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
