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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/discount-rules
// Section 20 & 35: View Discount Rules
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const rules = await prisma.discountRule.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: rules });
  } catch (err) {
    console.error('[DISCOUNT_RULES] List error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve discount rules.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/discount-rules
// Section 21: Create Discount Rule
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      name,
      productType,
      category,
      customerTier,
      maxDiscountPercentage,
      requiresApprovalAbove,
      requiresFinanceApprovalAbove,
      isActive,
    } = req.body;

    if (!name || !productType || maxDiscountPercentage === undefined || requiresApprovalAbove === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name, product type, maximum discount %, and manager approval threshold % are required.',
        },
      });
    }

    if (!ALLOWED_TYPES.includes(productType)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TYPE', message: `Product type must be one of: ${ALLOWED_TYPES.join(', ')}` },
      });
    }

    const maxDisc = parseFloat(maxDiscountPercentage);
    const apprAbove = parseFloat(requiresApprovalAbove);
    const finApprAbove = requiresFinanceApprovalAbove ? parseFloat(requiresFinanceApprovalAbove) : null;

    if (isNaN(maxDisc) || maxDisc < 0 || maxDisc > 100) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PERCENTAGE', message: 'Maximum discount must be between 0 and 100%.' },
      });
    }

    if (isNaN(apprAbove) || apprAbove < 0 || apprAbove > 100) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PERCENTAGE', message: 'Manager approval threshold must be between 0 and 100%.' },
      });
    }

    const rule = await prisma.discountRule.create({
      data: {
        tenantId: req.tenantId,
        name: name.trim(),
        productType,
        category: category?.trim() || null,
        customerTier: customerTier?.trim() || 'ALL',
        maxDiscountPercentage: maxDisc,
        requiresApprovalAbove: apprAbove,
        requiresFinanceApprovalAbove: finApprAbove,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'DISCOUNT_RULE_CREATED',
      entityType: 'DISCOUNT_RULE',
      entityId: rule.id,
      metadata: { name: rule.name, productType, maxDiscountPercentage: maxDisc },
    });

    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    console.error('[DISCOUNT_RULES] Create error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create discount rule. ' + err.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/discount-rules/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.discountRule.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: 'Discount rule not found.' },
      });
    }

    const {
      name,
      productType,
      category,
      customerTier,
      maxDiscountPercentage,
      requiresApprovalAbove,
      requiresFinanceApprovalAbove,
      isActive,
    } = req.body;

    const data = {};
    if (name) data.name = name.trim();
    if (category !== undefined) data.category = category ? category.trim() : null;
    if (customerTier !== undefined) data.customerTier = customerTier ? customerTier.trim() : 'ALL';
    if (productType && ALLOWED_TYPES.includes(productType)) data.productType = productType;

    if (maxDiscountPercentage !== undefined) {
      const d = parseFloat(maxDiscountPercentage);
      if (!isNaN(d) && d >= 0 && d <= 100) data.maxDiscountPercentage = d;
    }

    if (requiresApprovalAbove !== undefined) {
      const d = parseFloat(requiresApprovalAbove);
      if (!isNaN(d) && d >= 0 && d <= 100) data.requiresApprovalAbove = d;
    }

    if (requiresFinanceApprovalAbove !== undefined) {
      const d = parseFloat(requiresFinanceApprovalAbove);
      data.requiresFinanceApprovalAbove = isNaN(d) ? null : d;
    }

    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.discountRule.update({
      where: { id: existing.id },
      data,
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'DISCOUNT_RULE_UPDATED',
      entityType: 'DISCOUNT_RULE',
      entityId: updated.id,
      metadata: { updatedFields: Object.keys(data) },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[DISCOUNT_RULES] Update error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update discount rule.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/discount-rules/:id/status
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'isActive boolean flag is required.' },
      });
    }

    const rule = await prisma.discountRule.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: 'Discount rule not found.' },
      });
    }

    const updated = await prisma.discountRule.update({
      where: { id: rule.id },
      data: { isActive: Boolean(isActive) },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[DISCOUNT_RULES] Status toggle error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle rule status.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/discount-rules/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const rule = await prisma.discountRule.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: 'Discount rule not found.' },
      });
    }

    await prisma.discountRule.delete({ where: { id: rule.id } });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'DISCOUNT_RULE_DELETED',
      entityType: 'DISCOUNT_RULE',
      entityId: rule.id,
      metadata: { name: rule.name },
    });

    res.json({ success: true, data: { id: rule.id } });
  } catch (err) {
    console.error('[DISCOUNT_RULES] Delete error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete discount rule.' },
    });
  }
});

export default router;
