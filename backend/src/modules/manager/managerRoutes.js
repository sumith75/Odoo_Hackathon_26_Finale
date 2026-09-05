/**
 * managerRoutes.js — REST APIs for Sales Manager & Approval Governance
 *
 * Routes:
 * - GET  /api/manager/dashboard
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

const router = express.Router();

// Role-based protection: authenticated + SALES_MANAGER + tenant scoped
router.use(authenticateUser);
router.use(requireRole('SALES_MANAGER', 'ADMIN')); // Admins also permitted for executive review
router.use(resolveTenant);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/dashboard
// Section 6: Real database metrics & KPI cards
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Start of today (UTC)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      pendingCount,
      highRiskCount,
      pendingQuotes,
      approvedTodayCount,
      rejectedTodayCount,
      returnedCount,
      urgentPendingQuotes,
      recentApprovals,
      allPendingForRisk,
    ] = await Promise.all([
      // 1. Pending Manager Approvals Count
      prisma.quotation.count({
        where: {
          tenantId,
          status: { in: ['PENDING_APPROVAL', 'NEGOTIATION'] },
          approvalStatus: 'PENDING_MANAGER',
        },
      }),

      // 2. High Risk Deals Count
      prisma.quotation.count({
        where: {
          tenantId,
          status: { in: ['PENDING_APPROVAL', 'NEGOTIATION'] },
          approvalStatus: 'PENDING_MANAGER',
          riskLevel: 'HIGH',
        },
      }),

      // 3. Pending Quotes (for Total Pending Value)
      prisma.quotation.findMany({
        where: {
          tenantId,
          status: { in: ['PENDING_APPROVAL', 'NEGOTIATION'] },
          approvalStatus: 'PENDING_MANAGER',
        },
        select: { totalAmount: true },
      }),

      // 4. Approved Today Count
      prisma.approval.count({
        where: {
          tenantId,
          status: 'APPROVED',
          actedAt: { gte: today },
        },
      }),

      // 5. Rejected Today Count
      prisma.approval.count({
        where: {
          tenantId,
          status: 'REJECTED',
          actedAt: { gte: today },
        },
      }),

      // 6. Returned for Revision Count
      prisma.quotation.count({
        where: {
          tenantId,
          status: 'RETURNED_FOR_REVISION',
        },
      }),

      // 7. Urgent Pending Quotes (High risk + oldest pending first)
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

      // 9. All pending quotes for risk distribution
      prisma.quotation.findMany({
        where: {
          tenantId,
          status: 'PENDING_APPROVAL',
          approvalStatus: 'PENDING_MANAGER',
        },
        select: { riskLevel: true, riskScore: true },
      }),
    ]);

    const totalPendingValue = pendingQuotes.reduce(
      (sum, q) => sum + parseFloat(q.totalAmount || 0),
      0
    );

    // Calculate risk distribution
    const riskDistribution = {
      low: allPendingForRisk.filter((q) => q.riskLevel === 'LOW').length,
      moderate: allPendingForRisk.filter((q) => q.riskLevel === 'MODERATE').length,
      elevated: allPendingForRisk.filter((q) => q.riskScore >= 41 && q.riskScore <= 70).length,
      high: allPendingForRisk.filter((q) => q.riskLevel === 'HIGH').length,
    };

    res.json({
      success: true,
      data: {
        kpis: {
          pendingApprovals: pendingCount,
          highRiskDeals: highRiskCount,
          totalPendingValue: Math.round(totalPendingValue * 100) / 100,
          approvedToday: approvedTodayCount,
          rejectedToday: rejectedTodayCount,
          returnedCount,
        },
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
// GET /api/manager/approvals
// Section 7 & 8: Approval Inbox with filtering, search, and sorting
// ─────────────────────────────────────────────────────────────────────────────
router.get('/approvals', async (req, res) => {
  try {
    const {
      status = 'PENDING', // PENDING, APPROVED, REJECTED, RETURNED, ALL
      riskLevel,
      search,
      salesRepId,
      customerId,
      sortBy = 'priority', // priority, risk, value, oldest, newest
      page = 1,
      limit = 25,
    } = req.query;

    const where = { tenantId: req.tenantId };

    // Status filter
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

    // Risk level filter
    if (riskLevel && riskLevel !== 'ALL') {
      where.riskLevel = riskLevel.toUpperCase();
    }

    // Sales Rep filter
    if (salesRepId) {
      where.salesRepId = salesRepId;
    }

    // Customer filter
    if (customerId) {
      where.customerId = customerId;
    }

    // Search filter (Quote Number or Customer Name)
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { quoteNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Sorting
    let orderBy = [];
    if (sortBy === 'priority') {
      // Highest risk first, then oldest pending
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

    const take = Math.max(1, parseInt(limit, 10) || 25);
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

    // Attach computed telemetry summary to each quote
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
// GET /api/manager/approvals/:id
// Section 9 & 10: Complete Decision-Making Dossier
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
      },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quotation not found in organization.' },
      });
    }

    // Load active discount & approval rules
    const [discountRules, auditLogs] = await Promise.all([
      prisma.discountRule.findMany({ where: { tenantId: req.tenantId, isActive: true } }),
      prisma.auditLog.findMany({
        where: { tenantId: req.tenantId, entityId: quote.id },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, role: true } } },
      }),
    ]);

    const telemetry = calculateApprovalTelemetry(quote, discountRules);

    res.json({
      success: true,
      data: {
        quote,
        telemetry,
        auditHistory: auditLogs,
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
// Section 15: Sales Manager Approve
// ─────────────────────────────────────────────────────────────────────────────
router.post('/approvals/:id/approve', async (req, res) => {
  try {
    const { comment } = req.body;
    const result = await executeApprovalAction({
      quoteId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id,
      userRole: req.user.role,
      action: 'APPROVE',
      comment,
    });

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
// Section 16: Sales Manager Reject (Mandatory reason required)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/approvals/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await executeApprovalAction({
      quoteId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id,
      userRole: req.user.role,
      action: 'REJECT',
      reason,
    });

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
// Section 17: Sales Manager Return for Revision (Mandatory reason required)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/approvals/:id/return-for-revision', async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await executeApprovalAction({
      quoteId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id,
      userRole: req.user.role,
      action: 'RETURN_FOR_REVISION',
      reason,
    });

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
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/history
// Section 20: Full approval action history
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
// Section 28: Organization-wide team deals overview
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
// Section 28: Single team deal detail
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

    res.json({ success: true, data: quote });
  } catch (err) {
    console.error('[MANAGER_DEAL_DETAIL] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch deal detail.' },
    });
  }
});

export default router;
