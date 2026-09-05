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

import { parsePaginationParams, buildPaginationMeta } from '../../utils/pagination.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products
// Section 16 & 34: View Products with Search, Filters & Server-Side Pagination
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { type, status, search } = req.query;
    const { page, limit, skip, take } = parsePaginationParams(req.query);

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

    const [totalCount, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: {
          variants: {
            orderBy: { createdAt: 'asc' },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: buildPaginationMeta(totalCount, page, limit),
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
      include: {
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
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
        attributes: req.body.attributes || null,
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
    if (req.body.attributes !== undefined) data.attributes = req.body.attributes;

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

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/products/:id
// Admin deletes or deactivates product from catalog
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        _count: {
          select: {
            quotationItems: true,
            invoiceItems: true,
            subscriptions: true,
            warehouseAllocations: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found in your catalog.' },
      });
    }

    const hasTransactions =
      product._count.quotationItems > 0 ||
      product._count.invoiceItems > 0 ||
      product._count.subscriptions > 0 ||
      product._count.warehouseAllocations > 0;

    if (hasTransactions) {
      // Safely deactivate to maintain financial & quote audit integrity
      const deactivated = await prisma.product.update({
        where: { id: product.id },
        data: { isActive: false },
      });

      await logAudit({
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'PRODUCT_DEACTIVATED',
        entityType: 'PRODUCT',
        entityId: product.id,
        metadata: {
          name: product.name,
          sku: product.sku,
          reason: 'Referenced in active transactions or quotations',
        },
      });

      return res.json({
        success: true,
        message: `Product "${product.name}" is referenced in historical quotations or transactions. It has been deactivated to preserve audit history.`,
        data: deactivated,
      });
    }

    // Otherwise, completely remove product and its variants/inventories
    await prisma.$transaction([
      prisma.productVariant.deleteMany({ where: { productId: product.id } }),
      prisma.inventory.deleteMany({ where: { productId: product.id } }),
      prisma.product.delete({ where: { id: product.id } }),
    ]);

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'PRODUCT_DELETED',
      entityType: 'PRODUCT',
      entityId: product.id,
      metadata: { name: product.name, sku: product.sku },
    });

    res.json({
      success: true,
      message: `Product "${product.name}" (${product.sku}) deleted successfully.`,
    });
  } catch (err) {
    console.error('[PRODUCTS] Delete error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete product: ' + err.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT FEATURES & VARIANTS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/products/:id/features
// Configure product feature schema (e.g. Color, RAM, Storage options)
router.post('/:id/features', requireAdmin, async (req, res) => {
  try {
    const { attributes } = req.body;
    if (!attributes || !Array.isArray(attributes)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Attributes must be an array of feature definitions.' },
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
      data: { attributes },
      include: {
        variants: { orderBy: { createdAt: 'asc' } },
      },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'PRODUCT_FEATURES_CONFIGURED',
      entityType: 'PRODUCT',
      entityId: product.id,
      metadata: { featureCount: attributes.length },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[PRODUCTS] Features update error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to configure features.' },
    });
  }
});

// GET /api/products/:id/variants
// List all variants for a product
router.get('/:id/variants', async (req, res) => {
  try {
    const variants = await prisma.productVariant.findMany({
      where: {
        productId: req.params.id,
        tenantId: req.tenantId,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: variants });
  } catch (err) {
    console.error('[PRODUCTS] Variants fetch error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch variants.' },
    });
  }
});

// POST /api/products/:id/variants
// Admin creates a new variant with authoritative DB stock count
router.post('/:id/variants', requireAdmin, async (req, res) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' },
      });
    }

    const {
      name,
      sku,
      attributes,
      unitPrice,
      costPrice,
      stockQuantity,
      isActive,
    } = req.body;

    if (!name || !sku || unitPrice === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Variant name, SKU, and unit price are required.' },
      });
    }

    const cleanSku = sku.trim().toUpperCase();
    const existingSku = await prisma.productVariant.findFirst({
      where: { tenantId: req.tenantId, sku: cleanSku },
    });

    if (existingSku) {
      return res.status(409).json({
        success: false,
        error: { code: 'SKU_EXISTS', message: `Variant SKU "${cleanSku}" already exists in your organization.` },
      });
    }

    const priceNum = parseFloat(unitPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PRICE', message: 'Unit price must be a valid non-negative number.' },
      });
    }

    const stockNum = parseInt(stockQuantity, 10);
    const validStock = isNaN(stockNum) ? 0 : Math.max(0, stockNum);

    const variant = await prisma.productVariant.create({
      data: {
        tenantId: req.tenantId,
        productId: product.id,
        name: name.trim(),
        sku: cleanSku,
        attributes: attributes || {},
        unitPrice: priceNum,
        costPrice: parseFloat(costPrice || product.costPrice || 0),
        stockQuantity: validStock,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'VARIANT_CREATED',
      entityType: 'PRODUCT_VARIANT',
      entityId: variant.id,
      metadata: { productId: product.id, name: variant.name, sku: variant.sku, stock: validStock },
    });

    res.status(201).json({ success: true, data: variant });
  } catch (err) {
    console.error('[PRODUCTS] Create variant error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create variant: ' + err.message },
    });
  }
});

// PUT /api/products/:id/variants/:variantId
// Admin updates variant details & stock count
router.put('/:id/variants/:variantId', requireAdmin, async (req, res) => {
  try {
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: req.params.variantId,
        productId: req.params.id,
        tenantId: req.tenantId,
      },
    });

    if (!variant) {
      return res.status(404).json({
        success: false,
        error: { code: 'VARIANT_NOT_FOUND', message: 'Variant not found for this product.' },
      });
    }

    const {
      name,
      sku,
      attributes,
      unitPrice,
      costPrice,
      stockQuantity,
      isActive,
    } = req.body;

    const data = {};
    if (name) data.name = name.trim();
    if (attributes !== undefined) data.attributes = attributes;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (unitPrice !== undefined) {
      const p = parseFloat(unitPrice);
      if (!isNaN(p) && p >= 0) data.unitPrice = p;
    }

    if (costPrice !== undefined) {
      const c = parseFloat(costPrice);
      if (!isNaN(c) && c >= 0) data.costPrice = c;
    }

    if (stockQuantity !== undefined) {
      const s = parseInt(stockQuantity, 10);
      if (!isNaN(s)) data.stockQuantity = Math.max(0, s);
    }

    if (sku && sku.trim().toUpperCase() !== variant.sku) {
      const cleanSku = sku.trim().toUpperCase();
      const conflict = await prisma.productVariant.findFirst({
        where: { tenantId: req.tenantId, sku: cleanSku, id: { not: variant.id } },
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          error: { code: 'SKU_EXISTS', message: `Variant SKU "${cleanSku}" already exists.` },
        });
      }
      data.sku = cleanSku;
    }

    const updated = await prisma.productVariant.update({
      where: { id: variant.id },
      data,
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'VARIANT_UPDATED',
      entityType: 'PRODUCT_VARIANT',
      entityId: updated.id,
      metadata: { updatedFields: Object.keys(data), stockQuantity: updated.stockQuantity },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[PRODUCTS] Update variant error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update variant.' },
    });
  }
});

// PATCH /api/products/:id/variants/:variantId/stock
// Direct atomic stock count adjustment for variant in DB
router.patch('/:id/variants/:variantId/stock', requireAdmin, async (req, res) => {
  try {
    const { stockQuantity, delta } = req.body;

    const variant = await prisma.productVariant.findFirst({
      where: {
        id: req.params.variantId,
        productId: req.params.id,
        tenantId: req.tenantId,
      },
    });

    if (!variant) {
      return res.status(404).json({
        success: false,
        error: { code: 'VARIANT_NOT_FOUND', message: 'Variant not found.' },
      });
    }

    let newStock = variant.stockQuantity;
    if (stockQuantity !== undefined) {
      newStock = Math.max(0, parseInt(stockQuantity, 10) || 0);
    } else if (delta !== undefined) {
      newStock = Math.max(0, variant.stockQuantity + (parseInt(delta, 10) || 0));
    }

    const updated = await prisma.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: newStock },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'VARIANT_STOCK_ADJUSTED',
      entityType: 'PRODUCT_VARIANT',
      entityId: updated.id,
      metadata: { previousStock: variant.stockQuantity, newStock: updated.stockQuantity },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[PRODUCTS] Adjust variant stock error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to adjust variant stock.' },
    });
  }
});

// DELETE /api/products/:id/variants/:variantId
// Admin removes or deactivates variant
router.delete('/:id/variants/:variantId', requireAdmin, async (req, res) => {
  try {
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: req.params.variantId,
        productId: req.params.id,
        tenantId: req.tenantId,
      },
      include: {
        _count: { select: { quotationItems: true } },
      },
    });

    if (!variant) {
      return res.status(404).json({
        success: false,
        error: { code: 'VARIANT_NOT_FOUND', message: 'Variant not found.' },
      });
    }

    // If quotation items reference this variant, deactivate it to preserve audit history
    if (variant._count.quotationItems > 0) {
      const deactivated = await prisma.productVariant.update({
        where: { id: variant.id },
        data: { isActive: false },
      });
      return res.json({
        success: true,
        message: 'Variant is referenced in quotations; deactivated successfully.',
        data: deactivated,
      });
    }

    await prisma.productVariant.delete({
      where: { id: variant.id },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'VARIANT_DELETED',
      entityType: 'PRODUCT_VARIANT',
      entityId: variant.id,
      metadata: { name: variant.name, sku: variant.sku },
    });

    res.json({ success: true, message: 'Variant deleted successfully.' });
  } catch (err) {
    console.error('[PRODUCTS] Delete variant error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete variant.' },
    });
  }
});

export default router;
