import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { parsePaginationParams, buildPaginationMeta } from '../../utils/pagination.js';

const router = express.Router();

router.use(authenticateUser);
router.use(resolveTenant);
router.use(requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE_OPERATIONS'));

/**
 * Sanitizes audit entry for customer visibility
 */
function sanitizeAuditForCustomer(entry) {
  let description = entry.description || '';
  // Sanitize internal references
  description = description.replace(/risk score \d+\/100/gi, 'evaluation complete');
  description = description.replace(/margin \d+(\.\d+)?%/gi, '');
  description = description.replace(/cost amount [₹$]?\d+(\.\d+)?/gi, '');
  description = description.replace(/internal rule:.*?($|\.)/gi, '');

  let beforeState = entry.beforeState;
  let afterState = entry.afterState;

  if (beforeState && typeof beforeState === 'object') {
    const clone = { ...beforeState };
    delete clone.riskScore;
    delete clone.riskLevel;
    delete clone.totalCost;
    delete clone.marginAmount;
    delete clone.marginPercentage;
    delete clone.internalNotes;
    delete clone.approvalRuleId;
    beforeState = clone;
  }

  if (afterState && typeof afterState === 'object') {
    const clone = { ...afterState };
    delete clone.riskScore;
    delete clone.riskLevel;
    delete clone.totalCost;
    delete clone.marginAmount;
    delete clone.marginPercentage;
    delete clone.internalNotes;
    delete clone.approvalRuleId;
    afterState = clone;
  }

  return {
    ...entry,
    description: description.trim(),
    beforeState,
    afterState,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/audit
// Filtered Audit Activity Stream with Pagination
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page, limit, skip, take } = parsePaginationParams(req.query);
    const { action, actorId, actorRole, entityType, entityId, startDate, endDate, search } = req.query;

    const where = { tenantId };

    if (action) {
      where.action = action;
    }
    if (actorId) {
      where.userId = actorId;
    }
    if (actorRole) {
      where.actorRole = actorRole;
    }
    if (entityType) {
      where.entityType = entityType;
    }
    if (entityId) {
      where.entityId = String(entityId);
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const effectiveLimit = req.query.limit ? limit : 50;

    const [totalCount, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: effectiveLimit,
        include: {
          user: { select: { id: true, name: true, role: true, email: true } },
        },
      }),
    ]);

    const isCustomer = req.user?.role === 'CUSTOMER';
    const sanitizedLogs = isCustomer ? logs.map(sanitizeAuditForCustomer) : logs;

    res.json({
      success: true,
      data: sanitizedLogs,
      pagination: buildPaginationMeta(totalCount, page, effectiveLimit),
    });
  } catch (err) {
    console.error('[AUDIT_GET_ERROR]:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve audit activity stream.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/audit/entity/:entityType/:entityId
// Specific Entity Activity Timeline (e.g. Quotation deal history)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/entity/:entityType/:entityId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { entityType, entityId } = req.params;

    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType: entityType.toUpperCase(),
        entityId: String(entityId),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, role: true, email: true } },
      },
    });

    const isCustomer = req.user?.role === 'CUSTOMER';
    const sanitizedLogs = isCustomer ? logs.map(sanitizeAuditForCustomer) : logs;

    res.json({
      success: true,
      data: sanitizedLogs,
    });
  } catch (err) {
    console.error('[ENTITY_AUDIT_ERROR]:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve entity activity timeline.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/audit/activity
// System Activity Center Feed & Aggregated Metrics (Admin Access)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/activity', requireRole('ADMIN'), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page, limit, skip, take } = parsePaginationParams(req.query);
    const { search, category } = req.query;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Summary Metrics
    const [totalToday, riskEventsCount, approvalsCount, policyChangesCount] = await Promise.all([
      prisma.auditLog.count({
        where: { tenantId, createdAt: { gte: startOfToday } },
      }),
      prisma.auditLog.count({
        where: {
          tenantId,
          OR: [
            { action: { contains: 'RISK' } },
            { action: { contains: 'MARGIN' } },
            { action: { contains: 'VIOLATION' } },
            { action: { contains: 'REJECT' } },
          ],
        },
      }),
      prisma.auditLog.count({
        where: {
          tenantId,
          action: { contains: 'APPROV' },
        },
      }),
      prisma.auditLog.count({
        where: {
          tenantId,
          OR: [
            { action: { contains: 'RULE' } },
            { action: { contains: 'TIER' } },
            { action: { contains: 'USER' } },
            { action: { contains: 'SETTINGS' } },
          ],
        },
      }),
    ]);

    const where = { tenantId };

    if (category === 'HIGH_RISK') {
      where.OR = [
        { action: { contains: 'RISK' } },
        { action: { contains: 'MARGIN' } },
        { action: { contains: 'VIOLATION' } },
        { action: { contains: 'REJECT' } },
      ];
    } else if (category === 'APPROVALS') {
      where.action = { contains: 'APPROV' };
    } else if (category === 'SYSTEM') {
      where.OR = [
        { action: { contains: 'RULE' } },
        { action: { contains: 'TIER' } },
        { action: { contains: 'USER' } },
        { action: { contains: 'LOGIN' } },
      ];
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const effectiveLimit = req.query.limit ? limit : 20;

    const [totalCount, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: effectiveLimit,
        include: {
          user: { select: { id: true, name: true, role: true, email: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      metrics: {
        totalToday,
        riskEventsCount,
        approvalsCount,
        policyChangesCount,
      },
      data: logs,
      pagination: buildPaginationMeta(totalCount, page, effectiveLimit),
    });
  } catch (err) {
    console.error('[SYSTEM_ACTIVITY_ERROR]:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve system activity center metrics.' },
    });
  }
});

export default router;
