import express from 'express';
import prisma from '../../db/prisma.js';
import { authenticateUser } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { logAudit } from '../../utils/audit.js';

const router = express.Router();

router.use(authenticateUser);
router.use(resolveTenant);

const requireAdmin = requireRole('ADMIN');

const ALLOWED_TYPES = ['HARDWARE', 'SERVICE', 'SUBSCRIPTION', 'BUNDLE'];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products
// Section 16 & 34: View Products with Search and Filters
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { type, status, search } = req.query;

    const where = {
      tenantId: req.tenantId,
    };

    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (status && status !== 'ALL') {
      where.isActive = status === 'ACTIVE';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: products,
    });
  } catch (err) {
    console.error('[PRODUCTS] List error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve products.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found in your organization.' },
      });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    console.error('[PRODUCTS] Get error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve product.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/products
// Section 18: Add Product with conditional behaviors
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      sku,
      description,
      type,
      category,
      unitPrice,
      currency,
      billingType,
      billingInterval,
      taxRate,
      maxDiscountPercentage,
      isInventoryTracked,
      isActive,
    } = req.body;

    if (!name || !sku || unitPrice === undefined || !type) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Product name, SKU, type, and unit price are required.' },
      });
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TYPE', message: `Product type must be one of: ${ALLOWED_TYPES.join(', ')}` },
      });
    }

    const cleanSku = sku.trim().toUpperCase();

    // Verify SKU uniqueness within tenant
    const existing = await prisma.product.findFirst({
      where: { tenantId: req.tenantId, sku: cleanSku },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'SKU_EXISTS', message: `A product with SKU "${cleanSku}" already exists in your catalog.` },
      });
    }

    const priceNum = parseFloat(unitPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PRICE', message: 'Unit price must be a valid non-negative number.' },
      });
    }

    const maxDiscNum = parseFloat(maxDiscountPercentage || 0);
    if (isNaN(maxDiscNum) || maxDiscNum < 0 || maxDiscNum > 100) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DISCOUNT', message: 'Maximum discount must be between 0 and 100%.' },
      });
    }

    // Conditional behavior
    let inventoryTracked = Boolean(isInventoryTracked);
    let resolvedBillingType = billingType || 'ONE_TIME';
    let resolvedBillingInterval = billingInterval || null;

    if (type === 'SERVICE') {
      inventoryTracked = false;
    } else if (type === 'SUBSCRIPTION') {
      resolvedBillingType = 'RECURRING';
      if (!resolvedBillingInterval) {
        resolvedBillingInterval = 'MONTHLY';
      }
    }

    const newProduct = await prisma.product.create({
      data: {
        tenantId: req.tenantId,
        name: name.trim(),
        sku: cleanSku,
        description: description?.trim() || null,
        type,
        category: category?.trim() || 'General',
        unitPrice: priceNum,
        currency: currency?.trim() || req.user.currency || 'INR',
        billingType: resolvedBillingType,
        billingInterval: resolvedBillingInterval,
        taxRate: parseFloat(taxRate || 0),
        maxDiscountPercentage: maxDiscNum,
        isInventoryTracked: inventoryTracked,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'PRODUCT_CREATED',
      entityType: 'PRODUCT',
      entityId: newProduct.id,
      metadata: { name: newProduct.name, sku: newProduct.sku, price: priceNum, type },
    });

    console.log(`📦 [PRODUCTS] Created: ${newProduct.name} (${newProduct.sku})`);

    res.status(201).json({
      success: true,
      data: newProduct,
    });
  } catch (err) {
    console.error('[PRODUCTS] Create error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create product. ' + err.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/products/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' },
      });
    }

    const {
      name,
      sku,
      description,
      type,
      category,
      unitPrice,
      billingType,
      billingInterval,
      taxRate,
      maxDiscountPercentage,
      isInventoryTracked,
      isActive,
    } = req.body;

    const data = {};
    if (name) data.name = name.trim();
    if (description !== undefined) data.description = description ? description.trim() : null;
    if (category !== undefined) data.category = category ? category.trim() : null;
    if (type && ALLOWED_TYPES.includes(type)) data.type = type;

    if (unitPrice !== undefined) {
      const p = parseFloat(unitPrice);
      if (!isNaN(p) && p >= 0) data.unitPrice = p;
    }

    if (taxRate !== undefined) {
      data.taxRate = parseFloat(taxRate) || 0;
    }

    if (maxDiscountPercentage !== undefined) {
      const d = parseFloat(maxDiscountPercentage);
      if (!isNaN(d) && d >= 0 && d <= 100) data.maxDiscountPercentage = d;
    }

    if (isInventoryTracked !== undefined) data.isInventoryTracked = Boolean(isInventoryTracked);
    if (billingType !== undefined) data.billingType = billingType;
    if (billingInterval !== undefined) data.billingInterval = billingInterval;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (sku && sku.trim().toUpperCase() !== existing.sku) {
      const cleanSku = sku.trim().toUpperCase();
      const conflict = await prisma.product.findFirst({
        where: { tenantId: req.tenantId, sku: cleanSku, id: { not: existing.id } },
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          error: { code: 'SKU_EXISTS', message: `SKU ${cleanSku} is already used by another product.` },
        });
      }
      data.sku = cleanSku;
    }

    const updated = await prisma.product.update({
      where: { id: existing.id },
      data,
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'PRODUCT_UPDATED',
      entityType: 'PRODUCT',
      entityId: updated.id,
      metadata: { updatedFields: Object.keys(data) },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[PRODUCTS] Update error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update product.' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/products/:id/status
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'isActive boolean flag required.' },
      });
    }

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' },
      });
    }

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { isActive: Boolean(isActive) },
    });

    const action = isActive ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED';
    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action,
      entityType: 'PRODUCT',
      entityId: updated.id,
      metadata: { previousStatus: product.isActive, newStatus: updated.isActive },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[PRODUCTS] Status error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle product status.' },
    });
  }
});

export default router;
