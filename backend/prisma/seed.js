/**
 * seed.js — Prisma database seeder for DealFlow360
 *
 * Seed accounts:
 * - Admin: admin@dealflow360.com / admin123 (Role: admin)
 * - Sales Rep: sales@dealflow360.com / password123 (Role: sales_rep) [Created by Admin]
 * - Sales Manager: manager@dealflow360.com / password123 (Role: sales_manager) [Created by Admin]
 * - Finance Manager: finance@dealflow360.com / password123 (Role: finance) [Created by Admin]
 * - Customer: customer@acme.com / password123 (Tier: gold) [Self-signup customer]
 */

import prisma from '../src/db/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding DealFlow360 database with enterprise seed data...');

  const adminPass   = await bcrypt.hash('admin123', 10);
  const defaultPass = await bcrypt.hash('password123', 10);

  // ── 1. Users (Admin + 3 Team Roles added by Admin) ─────────────────────────
  console.log('  → Seeding Users...');
  
  // Admin (Self-signup)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@dealflow360.com' },
    update: { passwordHash: adminPass, role: 'admin', team: 'Executive' },
    create: {
      id: 'usr-admin-001',
      name: 'Sarah Admin',
      email: 'admin@dealflow360.com',
      passwordHash: adminPass,
      role: 'admin',
      team: 'Executive',
    },
  });

  // Sales Representative (Added by Admin)
  await prisma.user.upsert({
    where: { email: 'sales@dealflow360.com' },
    update: { passwordHash: defaultPass, role: 'sales_rep', team: 'Direct Enterprise Sales' },
    create: {
      id: 'usr-sales-001',
      name: 'Alex Morgan',
      email: 'sales@dealflow360.com',
      passwordHash: defaultPass,
      role: 'sales_rep',
      team: 'Direct Enterprise Sales',
    },
  });

  // Sales Manager (Added by Admin)
  await prisma.user.upsert({
    where: { email: 'manager@dealflow360.com' },
    update: { passwordHash: defaultPass, role: 'sales_manager', team: 'Sales Leadership' },
    create: {
      id: 'usr-manager-001',
      name: 'David Chen',
      email: 'manager@dealflow360.com',
      passwordHash: defaultPass,
      role: 'sales_manager',
      team: 'Sales Leadership',
    },
  });

  // Finance Manager (Added by Admin)
  await prisma.user.upsert({
    where: { email: 'finance@dealflow360.com' },
    update: { passwordHash: defaultPass, role: 'finance', team: 'Finance & Risk Operations' },
    create: {
      id: 'usr-finance-001',
      name: 'Priya Finance',
      email: 'finance@dealflow360.com',
      passwordHash: defaultPass,
      role: 'finance',
      team: 'Finance & Risk Operations',
    },
  });
  console.log('  ✅ Users seeded: 1 Admin + 3 Team Roles (Sales Rep, Sales Manager, Finance)');

  // ── 2. Customers (Self-signup) ─────────────────────────────────────────────
  console.log('  → Seeding Customers...');
  await prisma.customer.upsert({
    where: { email: 'customer@acme.com' },
    update: { tier: 'gold', currency: 'USD' },
    create: {
      id: 'cust-acme-001',
      name: 'Acme Corporation',
      email: 'customer@acme.com',
      passwordHash: defaultPass,
      tier: 'gold',
      currency: 'USD',
    },
  });

  await prisma.customer.upsert({
    where: { email: 'techcorp@example.com' },
    update: { tier: 'silver', currency: 'USD' },
    create: {
      id: 'cust-tech-002',
      name: 'TechCorp Industries',
      email: 'techcorp@example.com',
      passwordHash: defaultPass,
      tier: 'silver',
      currency: 'USD',
    },
  });
  console.log('  ✅ Customers seeded');

  // ── 3. Discount Ceilings ───────────────────────────────────────────────────
  console.log('  → Seeding Discount Ceilings...');
  await prisma.discountTierCeiling.upsert({
    where: { tier: 'bronze' },
    update: { maxDiscountPct: 10.00 },
    create: { tier: 'bronze', maxDiscountPct: 10.00 },
  });
  await prisma.discountTierCeiling.upsert({
    where: { tier: 'silver' },
    update: { maxDiscountPct: 15.00 },
    create: { tier: 'silver', maxDiscountPct: 15.00 },
  });
  await prisma.discountTierCeiling.upsert({
    where: { tier: 'gold' },
    update: { maxDiscountPct: 20.00 },
    create: { tier: 'gold', maxDiscountPct: 20.00 },
  });

  await prisma.categoryDiscountCeiling.upsert({
    where: { category: 'hardware' },
    update: { maxDiscountPct: 15.00 },
    create: { category: 'hardware', maxDiscountPct: 15.00 },
  });
  await prisma.categoryDiscountCeiling.upsert({
    where: { category: 'services' },
    update: { maxDiscountPct: 20.00 },
    create: { category: 'services', maxDiscountPct: 20.00 },
  });
  await prisma.categoryDiscountCeiling.upsert({
    where: { category: 'subscription' },
    update: { maxDiscountPct: 25.00 },
    create: { category: 'subscription', maxDiscountPct: 25.00 },
  });
  console.log('  ✅ Discount tier & category ceilings seeded');

  // ── 4. Approval Chain Rules ────────────────────────────────────────────────
  console.log('  → Seeding Approval Rules...');
  const existingRules = await prisma.approvalChainRule.findMany();
  if (existingRules.length === 0) {
    await prisma.approvalChainRule.create({
      data: {
        id: 'rule-mgr-001',
        minOveragePct: 0.01,
        maxOveragePct: 5.00,
        requiredLevel: 'sales_manager',
      },
    });
    await prisma.approvalChainRule.create({
      data: {
        id: 'rule-fin-002',
        minOveragePct: 5.01,
        maxOveragePct: 100.00,
        requiredLevel: 'sales_manager_then_finance',
      },
    });
  }
  console.log('  ✅ Approval chain rules seeded');

  // ── 5. Warehouses ──────────────────────────────────────────────────────────
  console.log('  → Seeding Warehouses...');
  const whAustin = await prisma.warehouse.upsert({
    where: { id: 'wh-austin-001' },
    update: { name: 'Austin Central Hub', shippingCostWeight: 1.00 },
    create: {
      id: 'wh-austin-001',
      name: 'Austin Central Hub',
      shippingCostWeight: 1.00,
    },
  });

  const whReno = await prisma.warehouse.upsert({
    where: { id: 'wh-reno-002' },
    update: { name: 'Reno Regional Warehouse', shippingCostWeight: 1.25 },
    create: {
      id: 'wh-reno-002',
      name: 'Reno Regional Warehouse',
      shippingCostWeight: 1.25,
    },
  });
  console.log('  ✅ Warehouses seeded');

  // ── 6. Products ────────────────────────────────────────────────────────────
  console.log('  → Seeding Products...');
  const prodServer = await prisma.product.upsert({
    where: { id: 'prod-server-001' },
    update: {
      name: 'UltraServer X900 Enterprise Rack',
      category: 'hardware',
      basePrice: 4500.00,
      description: 'Dual Intel Xeon Platinum, 512GB ECC RAM, 8TB NVMe redundant enterprise server',
      unit: 'unit',
      taxPct: 8.25,
      isSubscription: false,
    },
    create: {
      id: 'prod-server-001',
      name: 'UltraServer X900 Enterprise Rack',
      category: 'hardware',
      basePrice: 4500.00,
      description: 'Dual Intel Xeon Platinum, 512GB ECC RAM, 8TB NVMe redundant enterprise server',
      unit: 'unit',
      taxPct: 8.25,
      isSubscription: false,
    },
  });

  const prodDeploy = await prisma.product.upsert({
    where: { id: 'prod-deploy-002' },
    update: {
      name: 'White-Glove Deployment & Integration',
      category: 'services',
      basePrice: 1200.00,
      description: 'Certified engineer on-site installation, burn-in verification and migration support',
      unit: 'service',
      taxPct: 0.00,
      isSubscription: false,
    },
    create: {
      id: 'prod-deploy-002',
      name: 'White-Glove Deployment & Integration',
      category: 'services',
      basePrice: 1200.00,
      description: 'Certified engineer on-site installation, burn-in verification and migration support',
      unit: 'service',
      taxPct: 0.00,
      isSubscription: false,
    },
  });

  const prodCloud = await prisma.product.upsert({
    where: { id: 'prod-cloud-003' },
    update: {
      name: 'Enterprise Cloud SLA & 24/7 Monitoring',
      category: 'subscription',
      basePrice: 299.00,
      description: 'Real-time telemetry, 15-minute response SLA, proactive patch management',
      unit: 'month',
      taxPct: 5.00,
      isSubscription: true,
    },
    create: {
      id: 'prod-cloud-003',
      name: 'Enterprise Cloud SLA & 24/7 Monitoring',
      category: 'subscription',
      basePrice: 299.00,
      description: 'Real-time telemetry, 15-minute response SLA, proactive patch management',
      unit: 'month',
      taxPct: 5.00,
      isSubscription: true,
    },
  });
  console.log('  ✅ Products seeded');

  // ── 7. Warehouse Stock ─────────────────────────────────────────────────────
  console.log('  → Seeding Warehouse Stock...');
  await prisma.warehouseStock.upsert({
    where: { warehouseId_productId: { warehouseId: whAustin.id, productId: prodServer.id } },
    update: { inStock: 40, reserved: 0 },
    create: { warehouseId: whAustin.id, productId: prodServer.id, inStock: 40, reserved: 0 },
  });

  await prisma.warehouseStock.upsert({
    where: { warehouseId_productId: { warehouseId: whReno.id, productId: prodServer.id } },
    update: { inStock: 80, reserved: 0 },
    create: { warehouseId: whReno.id, productId: prodServer.id, inStock: 80, reserved: 0 },
  });
  console.log('  ✅ Warehouse stock seeded');

  // ── 8. Subscription Plans ──────────────────────────────────────────────────
  console.log('  → Seeding Subscription Plans...');
  const subPlanMonthly = await prisma.subscriptionPlan.upsert({
    where: { id: 'sub-monthly-001' },
    update: { amount: 299.00, cycle: 'monthly' },
    create: {
      id: 'sub-monthly-001',
      productId: prodCloud.id,
      cycle: 'monthly',
      amount: 299.00,
      prorationRule: 'daily_prorate',
      cancellationRule: 'end_of_cycle',
    },
  });

  const subPlanYearly = await prisma.subscriptionPlan.upsert({
    where: { id: 'sub-yearly-002' },
    update: { amount: 2990.00, cycle: 'yearly' },
    create: {
      id: 'sub-yearly-002',
      productId: prodCloud.id,
      cycle: 'yearly',
      amount: 2990.00,
      prorationRule: 'monthly_prorate',
      cancellationRule: 'annual_commitment',
    },
  });
  console.log('  ✅ Subscription plans seeded');

  // ── 9. Upsell Rules ────────────────────────────────────────────────────────
  console.log('  → Seeding Upsell Rules...');
  const existingUpsells = await prisma.upsellRule.findMany();
  if (existingUpsells.length === 0) {
    await prisma.upsellRule.create({
      data: {
        id: 'upsell-001',
        baseProductId: prodServer.id,
        suggestedProductId: prodCloud.id,
        coPurchaseScore: 0.85,
        isPromoted: true,
        minMarginPct: 35.00,
      },
    });

    await prisma.upsellRule.create({
      data: {
        id: 'upsell-002',
        baseProductId: prodServer.id,
        suggestedProductId: prodDeploy.id,
        coPurchaseScore: 0.72,
        isPromoted: true,
        minMarginPct: 25.00,
      },
    });
  }
  console.log('  ✅ Upsell recommendations seeded');

  console.log('\n🎉 Database seeded successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 CREDENTIALS:');
  console.log('   Admin:         admin@dealflow360.com / admin123 (Role: admin)');
  console.log('   Sales Rep:     sales@dealflow360.com / password123 (Role: sales_rep)');
  console.log('   Manager:       manager@dealflow360.com / password123 (Role: sales_manager)');
  console.log('   Finance:       finance@dealflow360.com / password123 (Role: finance)');
  console.log('   Customer:      customer@acme.com / password123 (Tier: gold)');
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
