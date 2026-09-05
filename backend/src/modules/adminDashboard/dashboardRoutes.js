import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { resolveTenant } from '../../middleware/tenant.js';

const router = express.Router();

router.use(authenticateUser);
router.use(requireRole('ADMIN'));
router.use(resolveTenant);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/dashboard
// Section 7: Aggregated Real-Time Dashboard Metrics
// ─────────────────────────────────────────────────────────────────────────────
router.get(['/', '/dashboard'], async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // 1. Organization info
    const org = await prisma.organization.findUnique({
      where: { id: tenantId },
      select: { name: true, currency: true, industry: true, country: true },
    });

    // 2. Team Member stats
    const [totalTeam, activeTeam, salesReps, salesManagers, financeUsers] = await Promise.all([
      prisma.user.count({ where: { tenantId } }),
      prisma.user.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.user.count({ where: { tenantId, role: 'SALES_REP' } }),
      prisma.user.count({ where: { tenantId, role: 'SALES_MANAGER' } }),
      prisma.user.count({ where: { tenantId, role: 'FINANCE_OPERATIONS' } }),
    ]);

    // 3. Product stats
    const [totalProducts, activeProducts, hardwareCount, serviceCount, subscriptionCount, bundleCount] = await Promise.all([
      prisma.product.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId, isActive: true } }),
      prisma.product.count({ where: { tenantId, type: 'HARDWARE' } }),
      prisma.product.count({ where: { tenantId, type: 'SERVICE' } }),
      prisma.product.count({ where: { tenantId, type: 'SUBSCRIPTION' } }),
      prisma.product.count({ where: { tenantId, type: 'BUNDLE' } }),
    ]);

    // 4. Rule stats
    const [discountRulesCount, approvalRulesCount] = await Promise.all([
      prisma.discountRule.count({ where: { tenantId } }),
      prisma.approvalRule.count({ where: { tenantId } }),
    ]);

    // 5. Recent Activity (latest 10 audit logs)
    const recentActivity = await prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { id: true, name: true, role: true, email: true } },
      },
    });

    res.json({
      success: true,
      data: {
        organization: org,
        team: {
          total: totalTeam,
          active: activeTeam,
          salesReps,
          salesManagers,
          financeUsers,
        },
        products: {
          total: totalProducts,
          active: activeProducts,
          hardware: hardwareCount,
          service: serviceCount,
          subscription: subscriptionCount,
          bundle: bundleCount,
        },
        rules: {
          discountRules: discountRulesCount,
          approvalRules: approvalRulesCount,
        },
        recentActivity,
      },
    });
  } catch (err) {
    console.error('[DASHBOARD] Fetch error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve dashboard metrics.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/audit
// Section 26: Chronological Audit Activity Stream
// ─────────────────────────────────────────────────────────────────────────────
router.get('/audit', async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, name: true, role: true, email: true } },
      },
    });

    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[AUDIT] Fetch error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve audit activity.' },
    });
  }
});

export default router;
