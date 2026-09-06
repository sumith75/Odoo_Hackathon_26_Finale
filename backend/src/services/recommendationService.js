/**
 * recommendationService.js — Cross-sell and Upsell Intelligence Engine
 *
 * Rules-based recommendations for CPQ Studio, in two layers:
 *   1. Product-specific: Admin-curated ProductUpsell mappings keyed to the
 *      exact product(s) already on the quote (managed from Admin Product
 *      Catalog -> "Upsells"). These are the highest-priority suggestions.
 *   2. Category heuristics: generic hardware/service/subscription rules that
 *      fill in when a product on the quote has no explicit mapping.
 *
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

  const recommendations = [];

  // ── Layer 1: Product-specific admin-curated mappings ──────────────────────
  const currentProductIds = [...existingProductIds];
  if (currentProductIds.length > 0) {
    const productUpsells = await prisma.productUpsell.findMany({
      where: { tenantId, productId: { in: currentProductIds } },
      include: { recommendedProduct: true },
      orderBy: { priority: 'asc' },
    });

    for (const upsell of productUpsells) {
      const rp = upsell.recommendedProduct;
      if (!rp || !rp.isActive || existingProductIds.has(rp.id)) continue;

      recommendations.push({
        productId: rp.id,
        name: rp.name,
        sku: rp.sku,
        type: rp.type,
        unitPrice: parseFloat(rp.unitPrice),
        currency: rp.currency,
        billingType: rp.billingType,
        billingInterval: rp.billingInterval,
        reason: upsell.reason,
        priority: 0, // product-specific suggestions always outrank category heuristics
        source: 'PRODUCT_SPECIFIC',
      });
      existingProductIds.add(rp.id);
    }
  }

  return recommendations.concat(
    getCategoryHeuristicRecommendations(activeProducts, currentItems, existingProductIds)
  ).sort((a, b) => a.priority - b.priority);
}

function getCategoryHeuristicRecommendations(activeProducts, currentItems, existingProductIds) {
  const recommendations = [];

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
