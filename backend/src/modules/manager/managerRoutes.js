/**
 * managerRoutes.js — REST APIs for Sales Manager, Approval Governance & Management Analytics
 *
 * Routes:
 * - GET  /api/manager/dashboard
 * - GET  /api/manager/deal-health/:id
 * - GET  /api/manager/pipeline
 * - GET  /api/manager/analytics/approvals
 * - GET  /api/manager/analytics/negotiations
 * - GET  /api/manager/analytics/fulfillment
 * - GET  /api/manager/analytics/billing
 * - GET  /api/manager/analytics/subscriptions
 * - GET  /api/manager/analytics/sales-reps
 * - GET  /api/manager/analytics/customers
 * - GET  /api/manager/analytics/products
 * - GET  /api/manager/approvals
 * - GET  /api/manager/approvals/:id
 * - POST /api/manager/approvals/:id/approve
 * - POST /api/manager/approvals/:id/reject
 * - POST /api/manager/approvals/:id/return-for-revision
 * - GET  /api/manager/history
 * - GET  /api/manager/deals
 * - GET  /api/manager/deals/:id
 */

import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { resolveTenant } from '../../middleware/tenant.js';
import {
  calculateApprovalTelemetry,
  executeApprovalAction,
} from '../../services/approvalService.js';
import {
  getDealHealth,
  calculateDealHealth,
  invalidateDealHealthCache,
} from '../../services/dealHealthService.js';

const router = express.Router();

// Role-based protection: authenticated + SALES_MANAGER / ADMIN + tenant scoped
router.use(authenticateUser);
router.use(requireRole('SALES_MANAGER', 'ADMIN')); // Customers and unauthorized roles blocked with 403
router.use(resolveTenant);

/**
 * Helper to compute start date based on timeframe query parameter
 */
function getTimeframeStartDate(timeframe) {
  const now = new Date();
  if (timeframe === 'today') {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return today;
  }
  if (timeframe === '7days') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (timeframe === '30days') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  if (timeframe === 'this_month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (timeframe === 'this_quarter') {
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), quarterMonth, 1);
  }
  if (timeframe === 'this_year') {
    return new Date(now.getFullYear(), 0, 1);
  }
  return null; // All time
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/dashboard
// Management Dashboard KPI Overview & Deals Requiring Attention
// ─────────────────────────────────────────────────────────────────────────────
router.get(['/dashboard', '/approvals/dashboard'], async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { timeframe } = req.query;
    const startDate = getTimeframeStartDate(timeframe);
    const dateWhere = startDate ? { createdAt: { gte: startDate } } : {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      allQuotations,
      pendingApprovalsCount,
      highRiskDealsCount,
      approvedTodayCount,
      rejectedTodayCount,
      returnedCount,
      urgentPendingQuotes,
      recentApprovals,
      activeSubscriptions,
      issuedInvoices,
    ] = await Promise.all([
      // 1. All Quotations for Tenant
      prisma.quotation.findMany({
        where: { tenantId, ...dateWhere },
        include: {
          customer: { select: { id: true, name: true, companyName: true, tier: true } },
          salesRep: { select: { id: true, name: true, email: true } },
          items: { include: { product: { include: { inventories: true } } } },
          invoices: true,
          subscriptions: true,
          negotiationProposals: true,
        },
      }),

      // 2. Pending Approvals Count
      prisma.quotation.count({
        where: {
          tenantId,
          status: { in: ['PENDING_APPROVAL', 'NEGOTIATION'] },
          approvalStatus: 'PENDING_MANAGER',
        },
      }),

      // 3. High Risk Deals Count
      prisma.quotation.count({
        where: {
          tenantId,
          status: { in: ['PENDING_APPROVAL', 'NEGOTIATION'] },
          approvalStatus: 'PENDING_MANAGER',
          riskLevel: 'HIGH',
        },
      }),

      // 4. Approved Today Count
      prisma.approval.count({
        where: { tenantId, status: 'APPROVED', actedAt: { gte: today } },
      }),

      // 5. Rejected Today Count
      prisma.approval.count({
        where: { tenantId, status: 'REJECTED', actedAt: { gte: today } },
      }),

      // 6. Returned for Revision Count
      prisma.quotation.count({
        where: { tenantId, status: 'RETURNED_FOR_REVISION' },
      }),

      // 7. Urgent Pending Quotes
      prisma.quotation.findMany({
        where: {
          tenantId,
          status: { in: ['PENDING_APPROVAL', 'NEGOTIATION'] },
          approvalStatus: 'PENDING_MANAGER',
        },
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'asc' }],
        take: 5,
        include: {
          customer: { select: { id: true, name: true, companyName: true, tier: true } },
          salesRep: { select: { id: true, name: true, email: true } },
          items: true,
        },
      }),

      // 8. Recent Approval Actions
      prisma.approval.findMany({
        where: { tenantId, actedAt: { not: null } },
        orderBy: { actedAt: 'desc' },
        take: 6,
        include: {
          quotation: {
            select: {
              id: true,
              quoteNumber: true,
              totalAmount: true,
              customer: { select: { name: true, companyName: true } },
            },
          },
          approver: { select: { name: true, role: true } },
        },
      }),

      // 9. Active Subscriptions for MRR Calculation
      prisma.subscription.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { recurringTotal: true },
      }),

      // 10. Issued Invoices for Outstanding Calculation
      prisma.invoice.findMany({
        where: { tenantId, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
        select: { amountDue: true, dueDate: true },
      }),
    ]);

    // Compute Pipeline & KPI Aggregates
    const activeDeals = allQuotations.filter(
      (q) => q.status !== 'CANCELLED' && q.status !== 'REJECTED'
    );
    const totalPipelineValue = activeDeals.reduce(
      (sum, q) => sum + parseFloat(q.totalAmount || 0),
      0
    );

    const quotesAwaitingCustomer = allQuotations.filter((q) =>
      ['SENT_TO_CUSTOMER', 'NEGOTIATION'].includes(q.status)
    ).length;

    const fulfillmentDelays = allQuotations.filter(
      (q) =>
        ['CUSTOMER_CONFIRMED', 'FULFILLMENT'].includes(q.status) &&
        q.fulfillmentStatus !== 'FULFILLED'
    ).length;

    const outstandingPaymentsValue = issuedInvoices.reduce(
      (sum, inv) => sum + parseFloat(inv.amountDue || 0),
      0
    );

    const mrrTotal = activeSubscriptions.reduce(
      (sum, sub) => sum + parseFloat(sub.recurringTotal || 0),
      0
    );

    // Per-rep historical average discount, computed in-memory from this same
    // timeframe's quotations, so the discount-anomaly signal below doesn't
    // require a separate DB round trip per deal in this bulk listing.
    const repDiscountTotals = {};
    for (const q of allQuotations) {
      const subtotal = parseFloat(q.subtotal || 0);
      if (!q.salesRepId || subtotal <= 0 || q.status === 'DRAFT') continue;
      if (!repDiscountTotals[q.salesRepId]) {
        repDiscountTotals[q.salesRepId] = { sumPercentage: 0, count: 0 };
      }
      repDiscountTotals[q.salesRepId].sumPercentage +=
        (parseFloat(q.discountAmount || 0) / subtotal) * 100;
      repDiscountTotals[q.salesRepId].count += 1;
    }
    const repBaselines = {};
    for (const [repId, agg] of Object.entries(repDiscountTotals)) {
      if (agg.count >= 3) {
        repBaselines[repId] = {
          averagePercentage: Math.round((agg.sumPercentage / agg.count) * 100) / 100,
          sampleSize: agg.count,
        };
      }
    }

    // Compute Deal Health for open quotations to build "Deals Requiring Attention"
    const dealsHealthEvaluated = allQuotations
      .filter((q) => !['PAID', 'CANCELLED'].includes(q.status))
      .map((quote) => {
        const health = calculateDealHealth(quote, {
          repDiscountBaseline: repBaselines[quote.salesRepId] || null,
        });
        return {
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          customerName: quote.customer?.companyName || quote.customer?.name || 'Customer',
          totalAmount: parseFloat(quote.totalAmount || 0),
          status: quote.status,
          riskLevel: quote.riskLevel,
          healthScore: health.score,
          healthStatus: health.status,
          primarySignal: health.signals[0] || null,
          signalsCount: health.signals.length,
          recommendedAction: health.recommendedAction,
        };
      });

    // Filter deals requiring attention (AT_RISK, CRITICAL, or having HIGH/MEDIUM signals)
    const dealsRequiringAttention = dealsHealthEvaluated
      .filter((d) => d.healthStatus === 'CRITICAL' || d.healthStatus === 'AT_RISK' || d.signalsCount > 0)
      .sort((a, b) => a.healthScore - b.healthScore)
      .slice(0, 10);

    // Risk distribution among pending quotes
    const pendingForRisk = allQuotations.filter((q) => q.approvalStatus === 'PENDING_MANAGER');
    const riskDistribution = {
      low: pendingForRisk.filter((q) => q.riskLevel === 'LOW').length,
      moderate: pendingForRisk.filter((q) => q.riskLevel === 'MODERATE' || q.riskLevel === 'MEDIUM').length,
      elevated: pendingForRisk.filter((q) => q.riskScore >= 41 && q.riskScore <= 70).length,
      high: pendingForRisk.filter((q) => q.riskLevel === 'HIGH').length,
    };

    res.json({
      success: true,
      data: {
        kpis: {
          totalPipelineValue: Math.round(totalPipelineValue * 100) / 100,
          activeDealsCount: activeDeals.length,
          pendingApprovals: pendingApprovalsCount,
          highRiskDeals: highRiskDealsCount,
          quotesAwaitingCustomer,
          fulfillmentDelays,
          outstandingPayments: Math.round(outstandingPaymentsValue * 100) / 100,
          monthlyRecurringRevenue: Math.round(mrrTotal * 100) / 100,
          approvedToday: approvedTodayCount,
          rejectedToday: rejectedTodayCount,
          returnedCount,
        },
        dealsRequiringAttention,
        urgentPendingQuotes,
        recentApprovals,
        riskDistribution,
      },
    });
  } catch (err) {
    console.error('[MANAGER_DASHBOARD] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'DASHBOARD_ERROR', message: 'Failed to fetch manager dashboard metrics.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/deal-health/:id
// Centralized Deal Health Evaluation Dossier for a specific deal
// ─────────────────────────────────────────────────────────────────────────────
router.get('/deal-health/:id', async (req, res) => {
  try {
    const health = await getDealHealth(req.params.id, req.tenantId);
    if (!health) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Deal not found in organization.' },
      });
    }

    res.json({
      success: true,
      data: health,
    });
  } catch (err) {
    console.error('[DEAL_HEALTH] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'DEAL_HEALTH_ERROR', message: 'Failed to evaluate deal health.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/pipeline
// Pipeline summary grouped by canonical lifecycle stage
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pipeline', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { timeframe } = req.query;
    const startDate = getTimeframeStartDate(timeframe);
    const dateWhere = startDate ? { createdAt: { gte: startDate } } : {};

    const canonicalStages = [
      'DRAFT',
      'SUBMITTED',
      'PENDING_APPROVAL',
      'APPROVED',
      'SENT_TO_CUSTOMER',
      'NEGOTIATION',
      'CUSTOMER_CONFIRMED',
      'FULFILLMENT',
      'PARTIALLY_FULFILLED',
      'FULFILLED',
      'INVOICED',
      'PAID',
    ];

    const quotations = await prisma.quotation.findMany({
      where: { tenantId, ...dateWhere },
      select: { status: true, totalAmount: true },
    });

    const pipelineByStage = canonicalStages.map((stage) => {
      const matching = quotations.filter((q) => q.status === stage);
      const dealCount = matching.length;
      const totalValue = matching.reduce((sum, q) => sum + parseFloat(q.totalAmount || 0), 0);

      return {
        stage,
        dealCount,
        totalValue: Math.round(totalValue * 100) / 100,
      };
    });

    const grandTotalValue = quotations.reduce(
      (sum, q) => sum + parseFloat(q.totalAmount || 0),
      0
    );

    res.json({
      success: true,
      data: {
        stages: pipelineByStage,
        totalDeals: quotations.length,
        grandTotalValue: Math.round(grandTotalValue * 100) / 100,
      },
    });
  } catch (err) {
    console.error('[PIPELINE_ANALYTICS] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'PIPELINE_ERROR', message: 'Failed to fetch pipeline analytics.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/analytics/approvals
// Approval governance analytics & turnaround duration calculations
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/approvals', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { timeframe } = req.query;
    const startDate = getTimeframeStartDate(timeframe);
    const dateWhere = startDate ? { createdAt: { gte: startDate } } : {};

    const [
      pendingManager,
      pendingFinance,
      allApprovals,
      returnedQuotesCount,
      reapprovalNegotiations,
    ] = await Promise.all([
      prisma.quotation.count({
        where: { tenantId, approvalStatus: 'PENDING_MANAGER', ...dateWhere },
      }),
      prisma.quotation.count({
        where: { tenantId, approvalStatus: 'PENDING_FINANCE', ...dateWhere },
      }),
      prisma.approval.findMany({
        where: { tenantId, ...dateWhere },
        select: { status: { select: false }, level: true, status: true, createdAt: true, actedAt: true },
      }),
      prisma.quotation.count({
        where: { tenantId, status: 'RETURNED_FOR_REVISION', ...dateWhere },
      }),
      prisma.quotation.count({
        where: {
          tenantId,
          status: 'PENDING_APPROVAL',
          negotiationProposals: { some: {} },
          ...dateWhere,
        },
      }),
    ]);

    const approvedCount = allApprovals.filter((a) => a.status === 'APPROVED').length;
    const rejectedCount = allApprovals.filter((a) => a.status === 'REJECTED').length;
    const returnedApprovalsCount = allApprovals.filter((a) => a.status === 'RETURNED_FOR_REVISION').length;

    // Calculate average approval turnaround duration in hours
    const completedApprovals = allApprovals.filter((a) => a.actedAt && a.createdAt);
    let avgApprovalDurationHours = null;

    if (completedApprovals.length > 0) {
      const totalDurationMs = completedApprovals.reduce((sum, a) => {
        return sum + (new Date(a.actedAt).getTime() - new Date(a.createdAt).getTime());
      }, 0);
      avgApprovalDurationHours = Math.round((totalDurationMs / (1000 * 60 * 60 * completedApprovals.length)) * 10) / 10;
    }

    res.json({
      success: true,
      data: {
        pendingManager,
        pendingFinance,
        totalPending: pendingManager + pendingFinance,
        approvedCount,
        rejectedCount,
        returnedCount: returnedQuotesCount || returnedApprovalsCount,
        reapprovalNegotiationsCount: reapprovalNegotiations,
        avgApprovalTime: avgApprovalDurationHours !== null ? `${avgApprovalDurationHours} hours` : 'No historical data yet',
        avgApprovalDurationHours,
        totalEvaluated: completedApprovals.length,
      },
    });
  } catch (err) {
    console.error('[APPROVAL_ANALYTICS] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: 'Failed to fetch approval analytics.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/analytics/negotiations
// Negotiation analytics and funnel visualizer data
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/negotiations', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { timeframe } = req.query;
    const startDate = getTimeframeStartDate(timeframe);
    const dateWhere = startDate ? { createdAt: { gte: startDate } } : {};

    const [
      activeNegotiatingDeals,
      proposals,
      sentQuotesCount,
      confirmedQuotesCount,
    ] = await Promise.all([
      prisma.quotation.count({
        where: { tenantId, status: 'NEGOTIATION', ...dateWhere },
      }),
      prisma.negotiationProposal.findMany({
        where: { tenantId, ...dateWhere },
        select: { roundNumber: true, status: true, quotationId: true },
      }),
      prisma.quotation.count({
        where: { tenantId, status: 'SENT_TO_CUSTOMER', ...dateWhere },
      }),
      prisma.quotation.count({
        where: { tenantId, status: 'CUSTOMER_CONFIRMED', ...dateWhere },
      }),
    ]);

    const totalProposals = proposals.length;
    const counteroffersCount = proposals.filter((p) => p.status === 'CUSTOMER_SUBMITTED').length;
    const approvedNegotiationsCount = proposals.filter((p) => ['APPROVED', 'ACCEPTED'].includes(p.status)).length;
    const rejectedNegotiationsCount = proposals.filter((p) => p.status === 'REJECTED').length;

    // Calculate average negotiation rounds per deal
    const dealRoundsMap = {};
    for (const p of proposals) {
      dealRoundsMap[p.quotationId] = Math.max(dealRoundsMap[p.quotationId] || 1, p.roundNumber);
    }
    const dealIds = Object.keys(dealRoundsMap);
    const avgRounds = dealIds.length > 0
      ? Math.round((Object.values(dealRoundsMap).reduce((a, b) => a + b, 0) / dealIds.length) * 10) / 10
      : 0;

    // Negotiation Funnel calculation
    const funnel = {
      customerReceived: sentQuotesCount + activeNegotiatingDeals + confirmedQuotesCount,
      negotiationStarted: activeNegotiatingDeals + dealIds.length,
      counteroffersSubmitted: counteroffersCount,
      reApprovalTriggered: proposals.filter((p) => p.status === 'SELLER_REVIEWING' || p.status === 'APPROVED').length,
      revisedQuoteSent: approvedNegotiationsCount,
      customerConfirmed: confirmedQuotesCount,
    };

    res.json({
      success: true,
      data: {
        activeNegotiations: activeNegotiatingDeals,
        totalProposals,
        counteroffers: counteroffersCount,
        approved: approvedNegotiationsCount,
        rejected: rejectedNegotiationsCount,
        avgRounds,
        funnel,
      },
    });
  } catch (err) {
    console.error('[NEGOTIATION_ANALYTICS] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: 'Failed to fetch negotiation analytics.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/analytics/fulfillment
// Fulfillment and warehouse inventory shortage analytics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/fulfillment', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { timeframe } = req.query;
    const startDate = getTimeframeStartDate(timeframe);
    const dateWhere = startDate ? { createdAt: { gte: startDate } } : {};

    const [
      unallocatedCount,
      allocatedCount,
      partiallyFulfilledCount,
      fullyFulfilledCount,
      inventories,
    ] = await Promise.all([
      prisma.quotation.count({
        where: { tenantId, fulfillmentStatus: 'UNALLOCATED', ...dateWhere },
      }),
      prisma.quotation.count({
        where: { tenantId, fulfillmentStatus: 'ALLOCATED', ...dateWhere },
      }),
      prisma.quotation.count({
        where: { tenantId, fulfillmentStatus: 'PARTIALLY_FULFILLED', ...dateWhere },
      }),
      prisma.quotation.count({
        where: { tenantId, fulfillmentStatus: 'FULFILLED', ...dateWhere },
      }),
      prisma.inventory.findMany({
        where: { tenantId },
        select: { availableQuantity: true, productId: true },
      }),
    ]);

    const inventoryShortages = inventories.filter((i) => i.availableQuantity <= 0).length;

    res.json({
      success: true,
      data: {
        unallocated: unallocatedCount,
        allocated: allocatedCount,
        partiallyFulfilled: partiallyFulfilledCount,
        fullyFulfilled: fullyFulfilledCount,
        inventoryShortages,
        fulfillmentHealth: {
          ready: allocatedCount,
          partial: partiallyFulfilledCount,
          delayed: unallocatedCount,
          completed: fullyFulfilledCount,
        },
      },
    });
  } catch (err) {
    console.error('[FULFILLMENT_ANALYTICS] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: 'Failed to fetch fulfillment analytics.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/analytics/billing
// Financial billing & revenue separation analytics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/billing', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { timeframe } = req.query;
    const startDate = getTimeframeStartDate(timeframe);
    const dateWhere = startDate ? { createdAt: { gte: startDate } } : {};

    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { tenantId, ...dateWhere },
        select: {
          totalAmount: true,
          amountPaid: true,
          amountDue: true,
          status: true,
          invoiceType: true,
          dueDate: true,
        },
      }),
      prisma.payment.findMany({
        where: { tenantId, status: 'SUCCESS', ...dateWhere },
        select: { amount: true },
      }),
    ]);

    const now = new Date();
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let partialPaymentsCount = 0;
    let oneTimeRevenue = 0;
    let recurringRevenue = 0;

    for (const inv of invoices) {
      const tot = parseFloat(inv.totalAmount || 0);
      const paid = parseFloat(inv.amountPaid || 0);
      const due = parseFloat(inv.amountDue || 0);

      totalInvoiced += tot;
      totalPaid += paid;
      totalOutstanding += due;

      if (due > 0 && new Date(inv.dueDate).getTime() < now.getTime()) {
        totalOverdue += due;
      }

      if (inv.status === 'PARTIALLY_PAID') {
        partialPaymentsCount += 1;
      }

      if (inv.invoiceType === 'RECURRING') {
        recurringRevenue += paid;
      } else {
        oneTimeRevenue += paid;
      }
    }

    res.json({
      success: true,
      data: {
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalOverdue: Math.round(totalOverdue * 100) / 100,
        partialPaymentsCount,
        oneTimeRevenue: Math.round(oneTimeRevenue * 100) / 100,
        recurringRevenue: Math.round(recurringRevenue * 100) / 100,
        totalPaymentsCount: payments.length,
      },
    });
  } catch (err) {
    console.error('[BILLING_ANALYTICS] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: 'Failed to fetch billing analytics.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/analytics/subscriptions
// Subscription recurring revenue (MRR) analytics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/subscriptions', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscriptions = await prisma.subscription.findMany({
      where: { tenantId },
      select: { status: true, recurringTotal: true, nextBillingDate: true },
    });

    const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE');
    const pausedSubs = subscriptions.filter((s) => s.status === 'PAUSED');
    const cancelledSubs = subscriptions.filter((s) => s.status === 'CANCELLED');

    const mrr = activeSubs.reduce(
      (sum, s) => sum + parseFloat(s.recurringTotal || 0),
      0
    );

    const upcomingBilling = activeSubs
      .filter((s) => new Date(s.nextBillingDate) <= nextMonth)
      .reduce((sum, s) => sum + parseFloat(s.recurringTotal || 0), 0);

    res.json({
      success: true,
      data: {
        activeSubscriptions: activeSubs.length,
        pausedSubscriptions: pausedSubs.length,
        cancelledSubscriptions: cancelledSubs.length,
        mrr: Math.round(mrr * 100) / 100,
        upcomingRecurringRevenue: Math.round(upcomingBilling * 100) / 100,
      },
    });
  } catch (err) {
    console.error('[SUBSCRIPTION_ANALYTICS] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: 'Failed to fetch subscription analytics.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/analytics/sales-reps
// Team performance breakdown by Sales Representative
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/sales-reps', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const [salesReps, quotations] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId, role: 'SALES_REP', status: 'ACTIVE' },
        select: { id: true, name: true, email: true },
      }),
      prisma.quotation.findMany({
        where: { tenantId },
        select: {
          id: true,
          salesRepId: true,
          status: true,
          totalAmount: true,
          approvalStatus: true,
        },
      }),
    ]);

    const repAnalytics = salesReps.map((rep) => {
      const repQuotes = quotations.filter((q) => q.salesRepId === rep.id);
      const activeDeals = repQuotes.filter((q) => !['CANCELLED', 'REJECTED'].includes(q.status));
      const pipelineValue = activeDeals.reduce((sum, q) => sum + parseFloat(q.totalAmount || 0), 0);

      const confirmedQuotes = repQuotes.filter((q) =>
        ['CUSTOMER_CONFIRMED', 'FULFILLMENT', 'PARTIALLY_FULFILLED', 'FULFILLED', 'INVOICED', 'PAID'].includes(q.status)
      );
      const confirmedValue = confirmedQuotes.reduce((sum, q) => sum + parseFloat(q.totalAmount || 0), 0);

      const pendingApprovals = repQuotes.filter((q) => q.approvalStatus === 'PENDING_MANAGER').length;
      const negotiations = repQuotes.filter((q) => q.status === 'NEGOTIATION').length;
      const fulfilledDeals = repQuotes.filter((q) => q.status === 'FULFILLED' || q.status === 'PAID').length;

      return {
        salesRepId: rep.id,
        name: rep.name,
        email: rep.email,
        activeDealsCount: activeDeals.length,
        pipelineValue: Math.round(pipelineValue * 100) / 100,
        confirmedValue: Math.round(confirmedValue * 100) / 100,
        pendingApprovals,
        negotiations,
        fulfilledDeals,
      };
    });

    res.json({
      success: true,
      data: repAnalytics,
    });
  } catch (err) {
    console.error('[SALES_REP_ANALYTICS] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: 'Failed to fetch sales rep analytics.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/analytics/customers
// Customer analytics: top customers, active negotiations, outstanding
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/customers', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const customers = await prisma.customer.findMany({
      where: { tenantId },
      include: {
        quotations: {
          select: { id: true, status: true, totalAmount: true },
        },
        invoices: {
          select: { amountDue: true, status: true },
        },
      },
    });

    const customerSummary = customers.map((c) => {
      const activeDeals = c.quotations.filter((q) => !['CANCELLED', 'REJECTED'].includes(q.status));
      const pipelineValue = activeDeals.reduce((sum, q) => sum + parseFloat(q.totalAmount || 0), 0);

      const confirmedDeals = c.quotations.filter((q) =>
        ['CUSTOMER_CONFIRMED', 'FULFILLMENT', 'PARTIALLY_FULFILLED', 'FULFILLED', 'INVOICED', 'PAID'].includes(q.status)
      );
      const confirmedValue = confirmedDeals.reduce((sum, q) => sum + parseFloat(q.totalAmount || 0), 0);

      const activeNegotiations = c.quotations.filter((q) => q.status === 'NEGOTIATION').length;
      const outstandingAmount = c.invoices.reduce((sum, inv) => sum + parseFloat(inv.amountDue || 0), 0);

      return {
        customerId: c.id,
        name: c.name,
        companyName: c.companyName || c.name,
        tier: c.tier,
        activeDealsCount: activeDeals.length,
        pipelineValue: Math.round(pipelineValue * 100) / 100,
        confirmedValue: Math.round(confirmedValue * 100) / 100,
        activeNegotiations,
        outstandingAmount: Math.round(outstandingAmount * 100) / 100,
      };
    });

    // Sort by pipeline value
    const topByPipeline = [...customerSummary].sort((a, b) => b.pipelineValue - a.pipelineValue).slice(0, 10);
    const topByConfirmed = [...customerSummary].sort((a, b) => b.confirmedValue - a.confirmedValue).slice(0, 10);

    res.json({
      success: true,
      data: {
        topByPipeline,
        topByConfirmed,
        totalCustomers: customers.length,
      },
    });
  } catch (err) {
    console.error('[CUSTOMER_ANALYTICS] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: 'Failed to fetch customer analytics.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/analytics/products
// Product performance and revenue analytics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/products', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const items = await prisma.quotationItem.findMany({
      where: { quotation: { tenantId } },
      include: {
        quotation: { select: { status: true } },
      },
    });

    const productMap = {};
    for (const item of items) {
      const pId = item.productId;
      if (!productMap[pId]) {
        productMap[pId] = {
          productId: pId,
          name: item.productNameSnapshot,
          type: item.productTypeSnapshot,
          quotedQuantity: 0,
          confirmedQuantity: 0,
          quotedRevenue: 0,
          confirmedRevenue: 0,
        };
      }

      const qty = item.quantity || 1;
      const lineTotal = parseFloat(item.lineTotal || 0);

      productMap[pId].quotedQuantity += qty;
      productMap[pId].quotedRevenue += lineTotal;

      if (
        ['CUSTOMER_CONFIRMED', 'FULFILLMENT', 'PARTIALLY_FULFILLED', 'FULFILLED', 'INVOICED', 'PAID'].includes(
          item.quotation.status
        )
      ) {
        productMap[pId].confirmedQuantity += qty;
        productMap[pId].confirmedRevenue += lineTotal;
      }
    }

    const productList = Object.values(productMap);
    const topQuoted = [...productList].sort((a, b) => b.quotedRevenue - a.quotedRevenue).slice(0, 10);
    const topConfirmed = [...productList].sort((a, b) => b.confirmedRevenue - a.confirmedRevenue).slice(0, 10);

    res.json({
      success: true,
      data: {
        topQuotedProducts: topQuoted,
        topConfirmedProducts: topConfirmed,
      },
    });
  } catch (err) {
    console.error('[PRODUCT_ANALYTICS] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: 'Failed to fetch product analytics.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/approvals & GET /api/approvals
// Approval Inbox with pagination, search & filters
// ─────────────────────────────────────────────────────────────────────────────
router.get(['/', '/approvals'], async (req, res) => {
  try {
    const {
      status = 'PENDING',
      riskLevel,
      search,
      salesRepId,
      customerId,
      startDate,
      endDate,
      sortBy = 'priority',
      page = 1,
      limit = 25,
    } = req.query;

    const where = { tenantId: req.tenantId };

    if (status === 'PENDING') {
      where.status = { in: ['PENDING_APPROVAL', 'NEGOTIATION'] };
      where.approvalStatus = 'PENDING_MANAGER';
    } else if (status === 'APPROVED') {
      where.approvalStatus = 'APPROVED';
    } else if (status === 'REJECTED') {
      where.status = 'REJECTED';
    } else if (status === 'RETURNED') {
      where.status = 'RETURNED_FOR_REVISION';
    }

    if (riskLevel && riskLevel !== 'ALL') {
      where.riskLevel = riskLevel.toUpperCase();
    }

    if (salesRepId) where.salesRepId = salesRepId;
    if (customerId) where.customerId = customerId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { quoteNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    let orderBy = [];
    if (sortBy === 'priority') {
      orderBy = [{ riskScore: 'desc' }, { createdAt: 'asc' }];
    } else if (sortBy === 'risk') {
      orderBy = [{ riskScore: 'desc' }];
    } else if (sortBy === 'value') {
      orderBy = [{ totalAmount: 'desc' }];
    } else if (sortBy === 'oldest') {
      orderBy = [{ createdAt: 'asc' }];
    } else {
      orderBy = [{ createdAt: 'desc' }];
    }

    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;

    const [total, quotations, discountRules] = await Promise.all([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          customer: { select: { id: true, name: true, companyName: true, tier: true } },
          salesRep: { select: { id: true, name: true, email: true } },
          items: true,
        },
      }),
      prisma.discountRule.findMany({ where: { tenantId: req.tenantId, isActive: true } }),
    ]);

    const enrichedQuotations = quotations.map((quote) => {
      const telemetry = calculateApprovalTelemetry(quote, discountRules);
      const waitingTimeMs = Date.now() - new Date(quote.updatedAt).getTime();
      const waitingHours = Math.floor(waitingTimeMs / (1000 * 60 * 60));
      const waitingMinutes = Math.floor((waitingTimeMs % (1000 * 60 * 60)) / (1000 * 60));

      return {
        ...quote,
        waitingTime: `${waitingHours}h ${waitingMinutes}m`,
        violationsCount: telemetry.violations.length,
        violations: telemetry.violations,
        marginDeltaPercentage: telemetry.marginDelta.marginDeltaPercentage,
        marginImpactAmount: telemetry.marginDelta.marginImpactAmount,
        baseMarginPercentage: telemetry.marginDelta.baseMarginPercentage,
        isReapproval: telemetry.comparison.isReapproval,
      };
    });

    res.json({
      success: true,
      data: enrichedQuotations,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error('[MANAGER_APPROVALS] Fetch error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to retrieve approval inbox.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/approvals/:id dossier
// ─────────────────────────────────────────────────────────────────────────────
router.get(['/:id', '/approvals/:id'], async (req, res) => {
  try {
    let quote = await prisma.quotation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        customer: true,
        salesRep: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { product: true } },
        approvals: {
          orderBy: { createdAt: 'desc' },
          include: { approver: { select: { id: true, name: true, role: true } } },
        },
        invoices: true,
        subscriptions: true,
        warehouseAllocations: true,
        negotiationProposals: true,
      },
    });

    if (!quote) {
      const approvalRecord = await prisma.approval.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
      });
      if (approvalRecord) {
        quote = await prisma.quotation.findFirst({
          where: { id: approvalRecord.quotationId, tenantId: req.tenantId },
          include: {
            customer: true,
            salesRep: { select: { id: true, name: true, email: true, phone: true } },
            items: { include: { product: true } },
            approvals: {
              orderBy: { createdAt: 'desc' },
              include: { approver: { select: { id: true, name: true, role: true } } },
            },
            invoices: true,
            subscriptions: true,
            warehouseAllocations: true,
            negotiationProposals: true,
          },
        });
      }
    }

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation or approval not found in organization.' },
      });
    }

    const [discountRules, auditLogs, health] = await Promise.all([
      prisma.discountRule.findMany({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.auditLog.findMany({
        where: { tenantId: req.tenantId, entityId: quote.id },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, role: true } } },
      }),
      getDealHealth(quote.id, req.tenantId),
    ]);

    const telemetry = calculateApprovalTelemetry(quote, discountRules);

    res.json({
      success: true,
      data: {
        quote,
        telemetry,
        auditHistory: auditLogs,
        dealHealth: health,
      },
    });
  } catch (err) {
    console.error('[MANAGER_APPROVAL_DETAIL] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to retrieve quotation approval dossier.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/manager/approvals/:id/approve
// ─────────────────────────────────────────────────────────────────────────────
router.post(['/:id/approve', '/approvals/:id/approve'], async (req, res) => {
  try {
    const { comment, version, expectedVersion, revisedItems } = req.body;
    const result = await executeApprovalAction({
      quoteId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id,
      userRole: req.user.role,
      action: 'APPROVE',
      comment,
      version,
      expectedVersion,
      revisedItems,
    });

    await invalidateDealHealthCache(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: result.responseMessage,
      data: result.updatedQuote,
    });
  } catch (err) {
    console.error('[MANAGER_APPROVE] Error:', err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: { code: err.code || 'APPROVE_ERROR', message: err.message },
      message: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/manager/approvals/:id/reject
// ─────────────────────────────────────────────────────────────────────────────
router.post(['/:id/reject', '/approvals/:id/reject'], async (req, res) => {
  try {
    const { reason, version, expectedVersion } = req.body;
    const result = await executeApprovalAction({
      quoteId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id,
      userRole: req.user.role,
      action: 'REJECT',
      reason,
      version,
      expectedVersion,
    });

    await invalidateDealHealthCache(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: result.responseMessage,
      data: result.updatedQuote,
    });
  } catch (err) {
    console.error('[MANAGER_REJECT] Error:', err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: { code: err.code || 'REJECT_ERROR', message: err.message },
      message: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/manager/approvals/:id/return-for-revision
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  [
    '/:id/return',
    '/:id/return-for-revision',
    '/approvals/:id/return',
    '/approvals/:id/return-for-revision',
  ],
  async (req, res) => {
    try {
      const { reason, version, expectedVersion } = req.body;
      const result = await executeApprovalAction({
        quoteId: req.params.id,
        tenantId: req.tenantId,
        userId: req.user.id,
        userRole: req.user.role,
        action: 'RETURN_FOR_REVISION',
        reason,
        version,
        expectedVersion,
      });

      await invalidateDealHealthCache(req.tenantId, req.params.id);

      res.json({
        success: true,
        message: result.responseMessage,
        data: result.updatedQuote,
      });
    } catch (err) {
      console.error('[MANAGER_RETURN_REVISION] Error:', err);
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: { code: err.code || 'RETURN_ERROR', message: err.message },
        message: err.message,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const history = await prisma.approval.findMany({
      where: {
        tenantId: req.tenantId,
        actedAt: { not: null },
      },
      orderBy: { actedAt: 'desc' },
      take: 50,
      include: {
        quotation: {
          select: {
            id: true,
            quoteNumber: true,
            totalAmount: true,
            marginPercentage: true,
            riskScore: true,
            riskLevel: true,
            customer: { select: { name: true, companyName: true, tier: true } },
            salesRep: { select: { name: true, email: true } },
          },
        },
        approver: { select: { name: true, role: true, email: true } },
      },
    });

    res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    console.error('[MANAGER_HISTORY] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'HISTORY_ERROR', message: 'Failed to fetch approval history.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/deals
// ─────────────────────────────────────────────────────────────────────────────
router.get('/deals', async (req, res) => {
  try {
    const { search, salesRepId, status } = req.query;
    const where = { tenantId: req.tenantId };

    if (salesRepId) where.salesRepId = salesRepId;
    if (status && status !== 'ALL') where.status = status;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { quoteNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const deals = await prisma.quotation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        customer: { select: { name: true, companyName: true, tier: true } },
        salesRep: { select: { name: true, email: true } },
      },
    });

    res.json({
      success: true,
      data: deals,
    });
  } catch (err) {
    console.error('[MANAGER_DEALS] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'DEALS_ERROR', message: 'Failed to fetch team deals.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/deals/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/deals/:id', async (req, res) => {
  try {
    const quote = await prisma.quotation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        customer: true,
        salesRep: { select: { id: true, name: true, email: true } },
        items: true,
        approvals: {
          orderBy: { createdAt: 'desc' },
          include: { approver: { select: { name: true, role: true } } },
        },
      },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found.' },
      });
    }

    const health = await getDealHealth(quote.id, req.tenantId);

    res.json({
      success: true,
      data: {
        ...quote,
        dealHealth: health,
      },
    });
  } catch (err) {
    console.error('[MANAGER_DEAL_DETAIL] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch deal detail.' },
    });
  }
});

export default router;
