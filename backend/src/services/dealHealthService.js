/**
 * dealHealthService.js — Centralized Deal Health Evaluation Engine
 *
 * Evaluates the overall progression and operational status of a deal
 * using real database state (quotation, approvals, negotiations, fulfillment, invoices, subscriptions).
 *
 * IMPORTANT:
 * - Risk Score (Risk Engine) measures commercial risk.
 * - Deal Health Score measures deal progression & management lifecycle health.
 * - Score is normalized 0-100:
 *     80-100: HEALTHY
 *     60-79:  GOOD
 *     40-59:  AT_RISK
 *     0-39:   CRITICAL
 * - Caches result in Redis with key `deal-health:{tenantId}:{dealId}`.
 */

import prisma from '../db/prisma.js';
import redis from '../config/redis.js';

const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Computes a sales rep's historical average discount percentage across their
 * other quotations, for anomaly comparison. Returns null when there isn't
 * enough history yet to make a meaningful comparison.
 */
export async function getRepAverageDiscountPercentage(tenantId, salesRepId, excludeQuoteId) {
  if (!tenantId || !salesRepId) return null;

  const priorQuotes = await prisma.quotation.findMany({
    where: {
      tenantId,
      salesRepId,
      id: { not: excludeQuoteId || undefined },
      status: { not: 'DRAFT' },
    },
    select: { subtotal: true, discountAmount: true },
    take: 200,
  });

  const withSubtotal = priorQuotes.filter((q) => parseFloat(q.subtotal) > 0);
  const MIN_SAMPLE_SIZE = 3;
  if (withSubtotal.length < MIN_SAMPLE_SIZE) return null;

  const averagePercentage =
    withSubtotal.reduce(
      (sum, q) => sum + (parseFloat(q.discountAmount) / parseFloat(q.subtotal)) * 100,
      0
    ) / withSubtotal.length;

  return {
    averagePercentage: Math.round(averagePercentage * 100) / 100,
    sampleSize: withSubtotal.length,
  };
}

/**
 * Pure calculation function based on pre-loaded quotation data.
 * `repDiscountBaseline` (optional) is the sales rep's historical average
 * discount percentage, computed separately since it requires querying the
 * rep's other quotations — see getRepAverageDiscountPercentage().
 */
export function calculateDealHealth(quote, { repDiscountBaseline = null } = {}) {
  if (!quote) {
    return {
      dealId: null,
      score: 0,
      status: 'CRITICAL',
      signals: [{ type: 'NOT_FOUND', severity: 'HIGH', message: 'Deal not found' }],
      recommendedAction: 'Verify deal ID',
      lastUpdated: new Date().toISOString(),
    };
  }

  let score = 100;
  const signals = [];
  const now = new Date();

  // 1. HIGH_RISK_DEAL Signal
  const isHighRisk = quote.riskLevel === 'HIGH' || (quote.riskScore && quote.riskScore >= 70);
  if (isHighRisk) {
    // Check if approved
    const isApproved = quote.approvalStatus === 'APPROVED' || quote.status === 'APPROVED';
    if (!isApproved) {
      score -= 20;
      signals.push({
        type: 'HIGH_RISK_DEAL',
        severity: 'HIGH',
        message: `High commercial risk score (${quote.riskScore || 80}/100) pending approval`,
      });
    } else {
      // Risk was approved, mild note
      signals.push({
        type: 'HIGH_RISK_DEAL',
        severity: 'LOW',
        message: `Approved high commercial risk deal (${quote.riskScore || 80}/100)`,
      });
    }
  }

  // 2. PENDING_APPROVAL Signal
  const isPendingApproval =
    quote.status === 'PENDING_APPROVAL' ||
    (quote.approvalStatus && quote.approvalStatus.startsWith('PENDING'));
  if (isPendingApproval) {
    score -= 15;
    signals.push({
      type: 'PENDING_APPROVAL',
      severity: 'HIGH',
      message: 'Manager or Finance approval is currently pending',
    });
  }

  // 3. QUOTE_EXPIRING Signal
  if (quote.validUntil) {
    const validUntilDate = new Date(quote.validUntil);
    const diffMs = validUntilDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffMs < 0 && quote.status !== 'CUSTOMER_CONFIRMED' && quote.status !== 'PAID') {
      score -= 20;
      signals.push({
        type: 'QUOTE_EXPIRING',
        severity: 'HIGH',
        message: 'Quotation valid date has expired',
      });
    } else if (diffDays <= 3 && quote.status !== 'CUSTOMER_CONFIRMED' && quote.status !== 'PAID') {
      score -= 10;
      signals.push({
        type: 'QUOTE_EXPIRING',
        severity: 'MEDIUM',
        message: `Quotation expires in ${Math.max(1, Math.ceil(diffDays))} day(s)`,
      });
    }
  }

  // 4. CUSTOMER_NEGOTIATING Signal
  const hasActiveNegotiation =
    quote.status === 'NEGOTIATION' ||
    (quote.negotiationProposals &&
      quote.negotiationProposals.some(
        (np) => np.status === 'CUSTOMER_SUBMITTED' || np.status === 'SELLER_REVIEWING'
      ));
  if (hasActiveNegotiation) {
    score -= 10;
    signals.push({
      type: 'CUSTOMER_NEGOTIATING',
      severity: 'MEDIUM',
      message: 'Customer counteroffer/negotiation proposal pending review',
    });
  }

  // 5. CUSTOMER_INACTIVE Signal
  if (quote.status === 'SENT_TO_CUSTOMER') {
    const lastActivity = new Date(quote.updatedAt || quote.createdAt);
    const daysInactive = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    if (daysInactive > 3) {
      score -= 15;
      signals.push({
        type: 'CUSTOMER_INACTIVE',
        severity: 'MEDIUM',
        message: `Customer inactive for ${Math.floor(daysInactive)} days since quote was sent`,
      });
    }
  }

  // 6. INVENTORY_SHORTAGE Signal
  let inventoryShortage = false;
  if (quote.items && quote.items.length > 0) {
    for (const item of quote.items) {
      if (item.productTypeSnapshot === 'HARDWARE' || item.product?.type === 'HARDWARE') {
        const totalAvail = (item.product?.inventories || []).reduce(
          (sum, inv) => sum + (inv.availableQuantity || 0),
          0
        );
        if (totalAvail < (item.quantity || 1)) {
          inventoryShortage = true;
          break;
        }
      }
    }
  }
  if (inventoryShortage) {
    score -= 15;
    signals.push({
      type: 'INVENTORY_SHORTAGE',
      severity: 'HIGH',
      message: 'Warehouse available stock is insufficient for quoted hardware items',
    });
  }

  // 7. PARTIAL_FULFILLMENT Signal
  if (
    quote.fulfillmentStatus === 'PARTIALLY_FULFILLED' ||
    quote.status === 'PARTIALLY_FULFILLED'
  ) {
    score -= 10;
    signals.push({
      type: 'PARTIAL_FULFILLMENT',
      severity: 'MEDIUM',
      message: 'Deal items are partially fulfilled; remaining items awaiting dispatch',
    });
  }

  // 8. FULFILLMENT_DELAY Signal
  if (
    (quote.status === 'CUSTOMER_CONFIRMED' || quote.status === 'FULFILLMENT') &&
    quote.fulfillmentStatus !== 'FULFILLED'
  ) {
    const confirmedTime = new Date(quote.confirmedAt || quote.updatedAt);
    const daysSinceConfirmed = (now.getTime() - confirmedTime.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceConfirmed > 5) {
      score -= 15;
      signals.push({
        type: 'FULFILLMENT_DELAY',
        severity: 'HIGH',
        message: `Fulfillment delayed by ${Math.floor(daysSinceConfirmed)} days post customer confirmation`,
      });
    }
  }

  // 9 & 10. PAYMENT OVERDUE / PENDING Signals
  const invoices = quote.invoices || [];
  let hasOverdueInvoice = false;
  let hasPendingInvoice = false;

  for (const inv of invoices) {
    const amountDue = parseFloat(inv.amountDue || 0);
    if (amountDue > 0 && inv.status !== 'PAID' && inv.status !== 'VOID') {
      const dueDate = new Date(inv.dueDate);
      if (dueDate.getTime() < now.getTime()) {
        hasOverdueInvoice = true;
      } else {
        hasPendingInvoice = true;
      }
    }
  }

  if (hasOverdueInvoice) {
    score -= 45;
    signals.push({
      type: 'PAYMENT_OVERDUE',
      severity: 'HIGH',
      message: 'Invoice payment is past due date',
    });
  } else if (hasPendingInvoice) {
    score -= 5;
    signals.push({
      type: 'PAYMENT_PENDING',
      severity: 'LOW',
      message: 'Invoice issued with payment pending',
    });
  }

  // 11. RECURRING_BILLING_ACTIVE Signal
  const subscriptions = quote.subscriptions || [];
  const hasActiveSub = subscriptions.some((s) => s.status === 'ACTIVE');
  if (hasActiveSub) {
    signals.push({
      type: 'RECURRING_BILLING_ACTIVE',
      severity: 'INFO',
      message: 'Active recurring subscription attached to deal',
    });
  }

  // 12. DISCOUNT_ANOMALY Signal — this quote's discount vs. the rep's own historical average.
  // Catches deals where a rep is discounting well above their own norm, even when
  // every individual line still technically clears its ceiling.
  let discountAnomaly = false;
  const ANOMALY_THRESHOLD_POINTS = 10; // percentage points above the rep's own average
  if (repDiscountBaseline && parseFloat(quote.subtotal) > 0) {
    const currentDiscountPercentage =
      (parseFloat(quote.discountAmount || 0) / parseFloat(quote.subtotal)) * 100;
    const delta = currentDiscountPercentage - repDiscountBaseline.averagePercentage;

    if (delta >= ANOMALY_THRESHOLD_POINTS) {
      discountAnomaly = true;
      const severity = delta >= ANOMALY_THRESHOLD_POINTS * 2 ? 'HIGH' : 'MEDIUM';
      score -= severity === 'HIGH' ? 20 : 10;
      signals.push({
        type: 'DISCOUNT_ANOMALY',
        severity,
        message: `This rep is discounting ${Math.round(currentDiscountPercentage)}% here vs. their own ${repDiscountBaseline.averagePercentage}% average across ${repDiscountBaseline.sampleSize} prior deals (+${Math.round(delta)} points)`,
      });
    }
  }

  // Final score normalization
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  // Status mapping
  let status = 'HEALTHY';
  if (normalizedScore >= 80) {
    status = 'HEALTHY';
  } else if (normalizedScore >= 60) {
    status = 'GOOD';
  } else if (normalizedScore >= 40) {
    status = 'AT_RISK';
  } else {
    status = 'CRITICAL';
  }

  // Rule-based Recommendation
  let recommendedAction = 'Proceed with standard deal lifecycle';
  if (hasOverdueInvoice) {
    recommendedAction = 'Follow up on outstanding payment with customer';
  } else if (isPendingApproval) {
    recommendedAction = 'Review and act on pending approval request';
  } else if (hasActiveNegotiation) {
    recommendedAction = 'Review customer counteroffer terms';
  } else if (signals.some((s) => s.type === 'QUOTE_EXPIRING')) {
    recommendedAction = 'Follow up with customer before quote expires';
  } else if (inventoryShortage) {
    recommendedAction = 'Review warehouse stock allocation & inventory replenishment';
  } else if (signals.some((s) => s.type === 'FULFILLMENT_DELAY')) {
    recommendedAction = 'Expedite warehouse fulfillment dispatch';
  } else if (signals.some((s) => s.type === 'CUSTOMER_INACTIVE')) {
    recommendedAction = 'Re-engage customer on sent proposal';
  } else if (discountAnomaly) {
    recommendedAction = 'Review discount justification with the rep before proceeding';
  } else if (hasPendingInvoice) {
    recommendedAction = 'Monitor upcoming invoice payment due date';
  }

  return {
    dealId: quote.id,
    quoteNumber: quote.quoteNumber,
    score: normalizedScore,
    status,
    signals,
    recommendedAction,
    lastUpdated: now.toISOString(),
  };
}

/**
 * Fetches deal health with Redis caching
 */
export async function getDealHealth(dealId, tenantId) {
  const cacheKey = `deal-health:${tenantId}:${dealId}`;

  // Try reading from Redis cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return parsed;
    }
  } catch (err) {
    // Silent cache miss
  }

  // Query database for authoritative deal state
  const quote = await prisma.quotation.findFirst({
    where: { id: dealId, tenantId },
    include: {
      customer: true,
      items: {
        include: {
          product: {
            include: {
              inventories: true,
            },
          },
        },
      },
      approvals: { orderBy: { createdAt: 'desc' } },
      negotiationProposals: { orderBy: { createdAt: 'desc' } },
      warehouseAllocations: true,
      invoices: true,
      subscriptions: true,
    },
  });

  if (!quote) {
    return null;
  }

  const repDiscountBaseline = await getRepAverageDiscountPercentage(
    tenantId,
    quote.salesRepId,
    quote.id
  );
  const health = calculateDealHealth(quote, { repDiscountBaseline });

  // Store in Redis cache
  try {
    await redis.set(cacheKey, JSON.stringify(health), CACHE_TTL_SECONDS);
  } catch (err) {
    // Non-fatal
  }

  return health;
}

/**
 * Invalidate cached health when deal events occur
 */
export async function invalidateDealHealthCache(tenantId, dealId) {
  if (!dealId || !tenantId) return;
  const cacheKey = `deal-health:${tenantId}:${dealId}`;
  try {
    await redis.del(cacheKey);
  } catch (err) {
    // Non-fatal
  }
}
