import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { resolveTenant } from '../../middleware/tenant.js';
import {
  autoAllocateInventory,
  getBackorderStatus,
  consolidateBackorder,
  overrideAllocation,
} from '../../services/inventoryAllocationService.js';
import { fulfillAllocations } from '../../services/fulfillmentService.js';
import {
  generateOneTimeInvoice,
  generateRecurringInvoice,
  calculateHybridBilling,
  changeSubscriptionQuantity,
  cancelSubscription,
} from '../../services/billingService.js';
import { simulateInvoicePayment } from '../../services/paymentService.js';
import {
  calculateApprovalTelemetry,
  executeApprovalAction,
} from '../../services/approvalService.js';
import { getDealHealth, invalidateDealHealthCache } from '../../services/dealHealthService.js';

const router = express.Router();

// Role-based protection: authenticated + FINANCE_OPERATIONS or ADMIN + tenant scoped
router.use(authenticateUser);
router.use(requireRole('FINANCE_OPERATIONS', 'ADMIN'));
router.use(resolveTenant);

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/finance/dashboard — Executive KPIs, active queues, warehouse rollups
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Awaiting / Pending Allocation (CUSTOMER_CONFIRMED with PENDING fulfillment)
    const pendingAllocationCount = await prisma.quotation.count({
      where: {
        tenantId,
        status: 'CUSTOMER_CONFIRMED',
        fulfillmentStatus: 'PENDING',
      },
    });

    // In Fulfillment / Partially Fulfilled
    const partiallyFulfilledCount = await prisma.quotation.count({
      where: {
        tenantId,
        fulfillmentStatus: 'PARTIALLY_FULFILLED',
      },
    });

    // Fulfilled
    const fulfilledCount = await prisma.quotation.count({
      where: {
        tenantId,
        fulfillmentStatus: 'FULFILLED',
      },
    });

    // Invoices count & revenue rollup
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        status: { notIn: ['CANCELLED', 'VOID'] },
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        amountPaid: true,
        amountDue: true,
      },
    });

    let totalPaidRevenue = 0;
    let totalOutstandingDue = 0;
    let unpaidInvoicesCount = 0;

    invoices.forEach((inv) => {
      totalPaidRevenue += Number(inv.amountPaid || 0);
      totalOutstandingDue += Number(inv.amountDue || 0);
      if (inv.status === 'ISSUED' || inv.status === 'PARTIALLY_PAID') {
        unpaidInvoicesCount++;
      }
    });

    // Active Subscriptions & MRR
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
      select: {
        recurringTotal: true,
      },
    });

    const activeSubscriptionsCount = activeSubscriptions.length;
    const monthlyRecurringRevenue = activeSubscriptions.reduce(
      (sum, s) => sum + Number(s.recurringTotal || 0),
      0
    );

    // Unbilled Quotes (Confirmed or Fulfilled with UNBILLED status)
    const unbilledQuotesCount = await prisma.quotation.count({
      where: {
        tenantId,
        billingStatus: 'UNBILLED',
        status: {
          in: ['CUSTOMER_CONFIRMED', 'FULFILLMENT', 'PARTIALLY_FULFILLED', 'FULFILLED'],
        },
      },
    });

    // Recent Fulfillment Queue
    const recentFulfillments = await prisma.quotation.findMany({
      where: {
        tenantId,
        status: {
          in: ['CUSTOMER_CONFIRMED', 'FULFILLMENT', 'PARTIALLY_FULFILLED', 'FULFILLED'],
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } },
        warehouseAllocations: { include: { warehouse: true } },
      },
    });

    // Recent Invoices
    const recentInvoices = await prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        customer: { select: { id: true, name: true } },
        quotation: { select: { id: true, quoteNumber: true } },
        payments: true,
      },
    });

    // Warehouse Inventory Rollup
    const warehouses = await prisma.warehouse.findMany({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { priority: 'asc' },
      include: {
        inventories: {
          include: {
            product: { select: { id: true, name: true, sku: true, type: true } },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        kpis: {
          pendingAllocationCount,
          partiallyFulfilledCount,
          fulfilledCount,
          unbilledQuotesCount,
          totalInvoicesCount: invoices.length,
          unpaidInvoicesCount,
          totalPaidRevenue: Math.round(totalPaidRevenue * 100) / 100,
          totalOutstandingDue: Math.round(totalOutstandingDue * 100) / 100,
          activeSubscriptionsCount,
          monthlyRecurringRevenue: Math.round(monthlyRecurringRevenue * 100) / 100,
        },
        recentFulfillments,
        recentInvoices,
        warehouses,
      },
    });
  } catch (error) {
    console.error('Error fetching finance dashboard:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DASHBOARD_ERROR', message: error.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/finance/warehouses — Multi-Warehouse Inventory Status
// ─────────────────────────────────────────────────────────────────────────────
router.get('/warehouses', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const warehouses = await prisma.warehouse.findMany({
      where: { tenantId },
      orderBy: { priority: 'asc' },
      include: {
        inventories: {
          include: {
            product: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: warehouses,
    });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({
      success: false,
      error: { code: 'WAREHOUSE_ERROR', message: error.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/finance/fulfillment — Fulfillment Queue
// ─────────────────────────────────────────────────────────────────────────────
router.get('/fulfillment', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { status, fulfillmentStatus } = req.query;

    const where = {
      tenantId,
      status: {
        in: [
          'CUSTOMER_CONFIRMED',
          'FULFILLMENT',
          'PARTIALLY_FULFILLED',
          'FULFILLED',
          'INVOICED',
          'PAID',
        ],
      },
    };

    if (status) where.status = status;
    if (fulfillmentStatus) where.fulfillmentStatus = fulfillmentStatus;

    const quotations = await prisma.quotation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
        warehouseAllocations: {
          include: { warehouse: true, product: true },
        },
        invoices: true,
      },
    });

    res.json({
      success: true,
      data: quotations,
    });
  } catch (error) {
    console.error('Error fetching fulfillment queue:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FULFILLMENT_FETCH_ERROR', message: error.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/finance/fulfillment/:quotationId — Detailed Fulfillment Dossier
// ─────────────────────────────────────────────────────────────────────────────
router.get('/fulfillment/:quotationId', async (req, res) => {
  try {
    const { quotationId } = req.params;
    const tenantId = req.tenantId;

    const quote = await prisma.quotation.findFirst({
      where: { id: quotationId, tenantId },
      include: {
        customer: true,
        salesRep: { select: { id: true, name: true, email: true } },
        items: {
          include: { product: true },
        },
        warehouseAllocations: {
          include: { warehouse: true, product: true },
          orderBy: { createdAt: 'asc' },
        },
        invoices: {
          include: { payments: true },
        },
      },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found' },
      });
    }

    const hybridBilling = calculateHybridBilling(quote);

    res.json({
      success: true,
      data: {
        ...quote,
        hybridBilling,
      },
    });
  } catch (error) {
    console.error('Error fetching quotation fulfillment details:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FULFILLMENT_DETAIL_ERROR', message: error.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /api/finance/fulfillment/:quotationId/allocate — Auto-Allocate Inventory
// ─────────────────────────────────────────────────────────────────────────────
router.post('/fulfillment/:quotationId/allocate', async (req, res) => {
  try {
    const { quotationId } = req.params;
    const tenantId = req.tenantId;
    const actorUserId = req.user.id;
    const { allowPartial } = req.body || {};

    const result = await autoAllocateInventory(tenantId, quotationId, actorUserId, {
      allowPartial: Boolean(allowPartial),
    });

    res.json({
      success: true,
      data: result,
      message: result.isExisting
        ? result.message
        : 'Inventory allocated successfully across warehouses.',
    });
  } catch (error) {
    console.error('Error allocating inventory:', error);
    const statusCode = error.statusCode || (error.code === 'INSUFFICIENT_INVENTORY' ? 409 : 400);
    res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'ALLOCATION_ERROR',
        message: error.message,
        details: error.details,
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5b. GET /api/finance/fulfillment/:quotationId/backorder-status
// ─────────────────────────────────────────────────────────────────────────────
router.get('/fulfillment/:quotationId/backorder-status', async (req, res) => {
  try {
    const { quotationId } = req.params;
    const result = await getBackorderStatus(req.tenantId, quotationId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error checking backorder status:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: { code: error.code || 'BACKORDER_STATUS_ERROR', message: error.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5c. POST /api/finance/fulfillment/:quotationId/consolidate-backorder
// ─────────────────────────────────────────────────────────────────────────────
router.post('/fulfillment/:quotationId/consolidate-backorder', async (req, res) => {
  try {
    const { quotationId } = req.params;
    const result = await consolidateBackorder(req.tenantId, quotationId, req.user.id);
    res.json({ success: true, data: result, message: result.message });
  } catch (error) {
    console.error('Error consolidating backorder:', error);
    res.status(error.statusCode || 400).json({
      success: false,
      error: { code: error.code || 'CONSOLIDATE_ERROR', message: error.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5d. POST /api/finance/fulfillment/:quotationId/allocate-override
// ─────────────────────────────────────────────────────────────────────────────
router.post('/fulfillment/:quotationId/allocate-override', async (req, res) => {
  try {
    const { quotationId } = req.params;
    const { allocations } = req.body || {};
    const result = await overrideAllocation(req.tenantId, quotationId, req.user.id, allocations);
    res.json({ success: true, data: result, message: result.message });
  } catch (error) {
    console.error('Error overriding allocation:', error);
    res.status(error.statusCode || 400).json({
      success: false,
      error: { code: error.code || 'OVERRIDE_ERROR', message: error.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /api/finance/fulfillment/:quotationId/complete — Complete Fulfillment
// ─────────────────────────────────────────────────────────────────────────────
router.post('/fulfillment/:quotationId/complete', async (req, res) => {
  try {
    const { quotationId } = req.params;
    const tenantId = req.tenantId;
    const actorUserId = req.user.id;
    const options = req.body || {};

    const result = await fulfillAllocations(tenantId, quotationId, options, actorUserId);

    res.json({
      success: true,
      data: result,
      message: result.isExisting
        ? result.message
        : 'Fulfillment completed. Physical stock decremented and subscriptions activated.',
    });
  } catch (error) {
    console.error('Error completing fulfillment:', error);
    res.status(error.statusCode || 400).json({
      success: false,
      error: {
        code: error.code || 'FULFILLMENT_COMPLETION_ERROR',
        message: error.message,
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. GET /api/finance/invoices — Invoices List
// ─────────────────────────────────────────────────────────────────────────────
router.get('/invoices', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { status, invoiceType } = req.query;

    const where = { tenantId };
    if (status) where.status = status;
    if (invoiceType) where.invoiceType = invoiceType;

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        quotation: {
          select: {
            id: true,
            quoteNumber: true,
            status: true,
            fulfillmentStatus: true,
          },
        },
        payments: true,
        items: true,
      },
    });

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INVOICE_FETCH_ERROR', message: error.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. GET /api/finance/invoices/:id — Single Invoice Detail
// ─────────────────────────────────────────────────────────────────────────────
router.get('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        quotation: {
          include: {
            salesRep: { select: { id: true, name: true, email: true } },
          },
        },
        items: {
          include: { product: true },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
        },
        subscription: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invoice not found.' },
      });
    }

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INVOICE_DETAIL_ERROR', message: error.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. POST /api/finance/invoices/:quotationId/generate — Generate One-Time Invoice
// ─────────────────────────────────────────────────────────────────────────────
router.post('/invoices/:quotationId/generate', async (req, res) => {
  try {
    const { quotationId } = req.params;
    const tenantId = req.tenantId;
    const actorUserId = req.user.id;

    const result = await generateOneTimeInvoice(tenantId, quotationId, actorUserId);

    res.json({
      success: true,
      data: result,
      message: result.isExisting
        ? result.message
        : 'One-time Capex invoice generated successfully.',
    });
  } catch (error) {
    console.error('Error generating one-time invoice:', error);
    res.status(error.statusCode || 400).json({
      success: false,
      error: {
        code: error.code || 'INVOICE_GENERATION_ERROR',
        message: error.message,
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. POST /api/finance/invoices/:id/payments/simulate — Simulate Payment
// ─────────────────────────────────────────────────────────────────────────────
router.post('/invoices/:id/payments/simulate', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const actorUserId = req.user.id;
    const paymentData = req.body || {};

    const result = await simulateInvoicePayment(tenantId, id, paymentData, actorUserId);

    res.json({
      success: true,
      data: result,
      message: `Payment of ₹${result.payment.amount} recorded. Invoice status: ${result.invoice.status}.`,
    });
  } catch (error) {
    console.error('Error simulating payment:', error);
    res.status(error.statusCode || 400).json({
      success: false,
      error: {
        code: error.code || 'PAYMENT_ERROR',
        message: error.message,
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET /api/finance/subscriptions — Subscriptions List
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscriptions', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { status } = req.query;

    const where = { tenantId };
    if (status) where.status = status;

    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        product: true,
        quotation: {
          select: { id: true, quoteNumber: true },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: { payments: true },
        },
      },
    });

    res.json({
      success: true,
      data: subscriptions,
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SUBSCRIPTION_FETCH_ERROR', message: error.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. POST /api/finance/subscriptions/:id/bill — Generate Recurring Cycle Invoice
// ─────────────────────────────────────────────────────────────────────────────
router.post('/subscriptions/:id/bill', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const actorUserId = req.user.id;

    const result = await generateRecurringInvoice(tenantId, id, actorUserId);

    res.json({
      success: true,
      data: result,
      message: 'Recurring subscription invoice generated successfully.',
    });
  } catch (error) {
    console.error('Error generating recurring invoice:', error);
    res.status(error.statusCode || 400).json({
      success: false,
      error: {
        code: error.code || 'RECURRING_BILLING_ERROR',
        message: error.message,
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. GET /api/finance/approvals — Finance Approval Inbox (PENDING_FINANCE queue)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/approvals', async (req, res) => {
  try {
    const { status = 'PENDING', riskLevel, search, page = 1, limit = 25 } = req.query;

    const where = { tenantId: req.tenantId };

    if (status === 'PENDING') {
      where.status = { in: ['PENDING_APPROVAL', 'NEGOTIATION'] };
      where.approvalStatus = 'PENDING_FINANCE';
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

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { quoteNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;

    const [total, quotations, discountRules] = await Promise.all([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'asc' }],
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
  } catch (error) {
    console.error('[FINANCE_APPROVALS] Fetch error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to retrieve finance approval inbox.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. GET /api/finance/approvals/:id — Finance Approval Dossier
// ─────────────────────────────────────────────────────────────────────────────
router.get('/approvals/:id', async (req, res) => {
  try {
    const quote = await prisma.quotation.findFirst({
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
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found in organization.' },
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
  } catch (error) {
    console.error('[FINANCE_APPROVAL_DETAIL] Error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to retrieve quotation approval dossier.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. POST /api/finance/approvals/:id/approve
// ─────────────────────────────────────────────────────────────────────────────
router.post('/approvals/:id/approve', async (req, res) => {
  try {
    const { comment, version, expectedVersion } = req.body;
    const result = await executeApprovalAction({
      quoteId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id,
      userRole: req.user.role,
      action: 'APPROVE',
      comment,
      version,
      expectedVersion,
      approverLevel: 'FINANCE_OPERATIONS',
    });

    await invalidateDealHealthCache(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: result.responseMessage,
      data: result.updatedQuote,
    });
  } catch (error) {
    console.error('[FINANCE_APPROVE] Error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: { code: error.code || 'APPROVE_ERROR', message: error.message },
      message: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. POST /api/finance/approvals/:id/reject
// ─────────────────────────────────────────────────────────────────────────────
router.post('/approvals/:id/reject', async (req, res) => {
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
      approverLevel: 'FINANCE_OPERATIONS',
    });

    await invalidateDealHealthCache(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: result.responseMessage,
      data: result.updatedQuote,
    });
  } catch (error) {
    console.error('[FINANCE_REJECT] Error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: { code: error.code || 'REJECT_ERROR', message: error.message },
      message: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. POST /api/finance/approvals/:id/return-for-revision
// ─────────────────────────────────────────────────────────────────────────────
router.post('/approvals/:id/return-for-revision', async (req, res) => {
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
      approverLevel: 'FINANCE_OPERATIONS',
    });

    await invalidateDealHealthCache(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: result.responseMessage,
      data: result.updatedQuote,
    });
  } catch (error) {
    console.error('[FINANCE_RETURN_REVISION] Error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: { code: error.code || 'RETURN_ERROR', message: error.message },
      message: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. PATCH /api/finance/subscriptions/:id — Mid-Cycle Quantity Change (Proration)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reason } = req.body || {};
    const result = await changeSubscriptionQuantity(req.tenantId, id, quantity, req.user.id, reason);
    res.json({ success: true, data: result, message: result.message });
  } catch (error) {
    console.error('Error changing subscription quantity:', error);
    res.status(error.statusCode || 400).json({
      success: false,
      error: { code: error.code || 'PRORATION_ERROR', message: error.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 19. POST /api/finance/subscriptions/:id/cancel — Cancel with Unused-Time Credit
// ─────────────────────────────────────────────────────────────────────────────
router.post('/subscriptions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const result = await cancelSubscription(req.tenantId, id, req.user.id, reason);
    res.json({ success: true, data: result, message: result.message });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(error.statusCode || 400).json({
      success: false,
      error: { code: error.code || 'CANCELLATION_ERROR', message: error.message },
    });
  }
});

export default router;
