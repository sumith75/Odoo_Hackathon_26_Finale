import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { requireRole } from '../../middleware/rbac.js';

const router = express.Router();

router.use(authenticateUser);
router.use(resolveTenant);
router.use(requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER'));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/dashboard
// Section 4: Real-time Quotation Metrics for Sales Representative
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const salesRepId = req.user.id;

    // Filter by salesRepId for Sales Reps, or tenant-wide for managers/admins
    const repFilter = req.user.role === 'SALES_REP' ? { salesRepId } : {};

    const [
      totalQuotes,
      draftCount,
      pendingApprovalCount,
      approvedCount,
      sentToCustomerCount,
      negotiationCount,
      customerConfirmedCount,
      fulfillmentCount,
      rejectedCount,
      atRiskCount,
      totalQuotedAggregate,
      potentialRevenueAggregate,
      recentDeals,
    ] = await Promise.all([
      prisma.quotation.count({
        where: { tenantId, ...repFilter },
      }),
      prisma.quotation.count({
        where: { tenantId, ...repFilter, status: 'DRAFT' },
      }),
      prisma.quotation.count({
        where: { tenantId, ...repFilter, status: 'PENDING_APPROVAL' },
      }),
      prisma.quotation.count({
        where: { tenantId, ...repFilter, status: 'APPROVED' },
      }),
      prisma.quotation.count({
        where: { tenantId, ...repFilter, status: 'SENT_TO_CUSTOMER' },
      }),
      prisma.quotation.count({
        where: { tenantId, ...repFilter, status: 'NEGOTIATION' },
      }),
      prisma.quotation.count({
        where: { tenantId, ...repFilter, status: 'CUSTOMER_CONFIRMED' },
      }),
      prisma.quotation.count({
        where: { tenantId, ...repFilter, status: { in: ['FULFILLMENT', 'PARTIALLY_FULFILLED', 'FULFILLED'] } },
      }),
      prisma.quotation.count({
        where: { tenantId, ...repFilter, status: 'REJECTED' },
      }),
      prisma.quotation.count({
        where: { tenantId, ...repFilter, riskLevel: 'HIGH' },
      }),
      prisma.quotation.aggregate({
        where: { tenantId, ...repFilter },
        _sum: { totalAmount: true },
      }),
      prisma.quotation.aggregate({
        where: {
          tenantId,
          ...repFilter,
          status: { notIn: ['REJECTED', 'CANCELLED'] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.quotation.findMany({
        where: { tenantId, ...repFilter },
        include: {
          customer: { select: { name: true, companyName: true, tier: true } },
          _count: { select: { items: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    const totalQuotedValue = totalQuotedAggregate?._sum?.totalAmount
      ? parseFloat(totalQuotedAggregate._sum.totalAmount)
      : 0;
    const potentialRevenue = potentialRevenueAggregate?._sum?.totalAmount
      ? parseFloat(potentialRevenueAggregate._sum.totalAmount)
      : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalQuotes,
          draftCount,
          pendingApprovalCount,
          approvedCount,
          sentToCustomerCount,
          negotiationCount,
          customerConfirmedCount,
          fulfillmentCount,
          rejectedCount,
          atRiskCount,
          totalQuotedValue: Math.round(totalQuotedValue * 100) / 100,
          potentialRevenue: Math.round(potentialRevenue * 100) / 100,
        },
        recentDeals,
      },
    });
  } catch (err) {
    console.error('[SALES DASHBOARD] Metrics error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve sales dashboard metrics.' },
    });
  }
});

export default router;
