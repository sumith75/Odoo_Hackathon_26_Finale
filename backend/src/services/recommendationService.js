/**
 * recommendationService.js — Cross-sell and Upsell Intelligence Engine
 *
 * Rules-based recommendations for CPQ Studio.
 * Strictly guarantees tenant isolation and only suggests active, unadded products.
 */

import prisma from '../db/prisma.js';

export async function getQuoteRecommendations(tenantId, currentItems = []) {
  // Fetch active products for this tenant
  const activeProducts = await prisma.product.findMany({
    where: { tenantId, isActive: true },
  });

  const existingProductIds = new Set(
    currentItems.map((i) => i.productId || i.id).filter(Boolean)
  );

  const hasHardware = currentItems.some(
    (i) => (i.productTypeSnapshot || i.type) === 'HARDWARE'
  );
  const hasService = currentItems.some(
    (i) => (i.productTypeSnapshot || i.type) === 'SERVICE'
  );
  const hasSubscription = currentItems.some(
    (i) => (i.productTypeSnapshot || i.type) === 'SUBSCRIPTION'
  );
  const hasLaptop = currentItems.some((i) =>
    (i.productNameSnapshot || i.name || '').toLowerCase().includes('laptop')
  );

  const recommendations = [];

  // Helper to add suggestion if product exists in tenant catalog and is not already in quote
  const suggest = (skuMatch, reason, priority = 1) => {
    const product = activeProducts.find((p) => p.sku === skuMatch);
    if (product && !existingProductIds.has(product.id)) {
      recommendations.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        type: product.type,
        unitPrice: parseFloat(product.unitPrice),
        currency: product.currency,
        billingType: product.billingType,
        billingInterval: product.billingInterval,
        reason,
        priority,
      });
      existingProductIds.add(product.id);
    }
  };

  // Rule 1: Hardware without Installation Service
  if (hasHardware && !hasService) {
    suggest(
      'INSTALL-001',
      'Customers purchasing hardware often add on-site Installation & Network Security Configuration.',
      1
    );
  }

  // Rule 2: Hardware without Premium Support Subscription
  if (hasHardware && !hasSubscription) {
    suggest(
      'SUPPORT-PREMIUM',
      'Protect your hardware rollout with 24/7 priority enterprise support and 15-min SLA.',
      2
    );
  }

  // Rule 3: Laptop X without Business Monitor
  if (hasLaptop) {
    suggest(
      'MONITOR-BIZ',
      'Pair Laptop X with 4K UHD 27-inch Business Monitor for maximum team workstation ergonomics.',
      3
    );
  }

  // Rule 4: Service without Employee Training
  if (hasService) {
    suggest(
      'TRAINING-001',
      'Accelerate organizational adoption with full-day interactive hands-on Employee Training.',
      4
    );
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}
