import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { logAudit } from '../../utils/audit.js';

const router = express.Router();

router.use(authenticateUser);
router.use(requireRole('ADMIN'));
router.use(resolveTenant);

const ALLOWED_TYPES = ['HARDWARE', 'SERVICE', 'SUBSCRIPTION', 'BUNDLE'];
const ALLOWED_APPROVER_ROLES = ['SALES_MANAGER', 'FINANCE_OPERATIONS', 'SALES_MANAGER_THEN_FINANCE'];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/approval-rules
// Section 23 & 36: View Approval Rules
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const rules = await prisma.approvalRule.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ productType: 'asc' }, { priority: 'asc' }, { minDiscountPercentage: 'asc' }],
    });

    res.json({ success: true, data: rules });
  } catch (err) {
    console.error('[APPROVAL_RULES] List error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve approval rules.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/approval-rules
// Section 24: Create Approval Rule
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      name,
      productType,
      minDiscountPercentage,
      maxDiscountPercentage,
      requiredRole,
      priority,
      isActive,
    } = req.body;

    if (!name || !productType || minDiscountPercentage === undefined || !requiredRole) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name, product type, minimum discount %, and required role are required.',
        },
      });
    }

    if (!ALLOWED_TYPES.includes(productType)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TYPE', message: `Product type must be one of: ${ALLOWED_TYPES.join(', ')}` },
      });
    }

    if (!ALLOWED_APPROVER_ROLES.includes(requiredRole)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: `Required role must be one of: ${ALLOWED_APPROVER_ROLES.join(', ')}`,
        },
      });
    }

    const minDisc = parseFloat(minDiscountPercentage);
    const maxDisc = maxDiscountPercentage !== undefined && maxDiscountPercentage !== '' ? parseFloat(maxDiscountPercentage) : null;

    if (isNaN(minDisc) || minDisc < 0 || minDisc > 100) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PERCENTAGE', message: 'Minimum discount must be between 0 and 100%.' },
      });
    }

    if (maxDisc !== null && (isNaN(maxDisc) || maxDisc < minDisc || maxDisc > 100)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PERCENTAGE', message: 'Maximum discount must be between min discount and 100%.' },
      });
    }

    const rule = await prisma.approvalRule.create({
      data: {
        tenantId: req.tenantId,
        name: name.trim(),
        productType,
        minDiscountPercentage: minDisc,
        maxDiscountPercentage: maxDisc,
        requiredRole,
        priority: parseInt(priority, 10) || 1,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'APPROVAL_RULE_CREATED',
      entityType: 'APPROVAL_RULE',
      entityId: rule.id,
      metadata: { name: rule.name, productType, minDiscountPercentage: minDisc, requiredRole },
    });

    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    console.error('[APPROVAL_RULES] Create error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create approval rule. ' + err.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/approval-rules/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.approvalRule.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: 'Approval rule not found.' },
      });
    }

    const {
      name,
      productType,
      minDiscountPercentage,
      maxDiscountPercentage,
      requiredRole,
      priority,
      isActive,
    } = req.body;

    const data = {};
    if (name) data.name = name.trim();
    if (productType && ALLOWED_TYPES.includes(productType)) data.productType = productType;
    if (requiredRole && ALLOWED_APPROVER_ROLES.includes(requiredRole)) data.requiredRole = requiredRole;
    if (priority !== undefined) data.priority = parseInt(priority, 10) || 1;

    if (minDiscountPercentage !== undefined) {
      const minDisc = parseFloat(minDiscountPercentage);
      if (!isNaN(minDisc) && minDisc >= 0 && minDisc <= 100) data.minDiscountPercentage = minDisc;
    }

    if (maxDiscountPercentage !== undefined) {
      const maxDisc = maxDiscountPercentage !== '' ? parseFloat(maxDiscountPercentage) : null;
      data.maxDiscountPercentage = isNaN(maxDisc) ? null : maxDisc;
    }

    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.approvalRule.update({
      where: { id: existing.id },
      data,
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'APPROVAL_RULE_UPDATED',
      entityType: 'APPROVAL_RULE',
      entityId: updated.id,
      metadata: { updatedFields: Object.keys(data) },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[APPROVAL_RULES] Update error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update approval rule.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/approval-rules/:id/status
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'isActive boolean is required.' },
      });
    }

    const rule = await prisma.approvalRule.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: 'Approval rule not found.' },
      });
    }

    const updated = await prisma.approvalRule.update({
      where: { id: rule.id },
      data: { isActive: Boolean(isActive) },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[APPROVAL_RULES] Status toggle error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle rule status.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/approval-rules/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const rule = await prisma.approvalRule.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: 'Approval rule not found.' },
      });
    }

    await prisma.approvalRule.delete({ where: { id: rule.id } });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'APPROVAL_RULE_DELETED',
      entityType: 'APPROVAL_RULE',
      entityId: rule.id,
      metadata: { name: rule.name },
    });

    res.json({ success: true, data: { id: rule.id } });
  } catch (err) {
    console.error('[APPROVAL_RULES] Delete error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete approval rule.' },
    });
  }
});

export default router;
