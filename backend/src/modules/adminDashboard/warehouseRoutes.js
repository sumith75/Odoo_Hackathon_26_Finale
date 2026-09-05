/**
 * warehouseRoutes.js — Admin-only Warehouse & Inventory Management
 *
 * Allows Admins to:
 * - Create, update, activate/deactivate warehouses
 * - Seed/update inventory stock levels per product per warehouse
 * - View all warehouses and their inventory
 *
 * All operations are multi-tenant isolated (tenantId from resolveTenant middleware).
 */

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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/warehouses — List all warehouses with inventory
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
      include: {
        inventories: {
          include: {
            product: { select: { id: true, name: true, sku: true, type: true, isInventoryTracked: true } },
          },
        },
      },
    });

    res.json({ success: true, data: warehouses });
  } catch (err) {
    console.error('[ADMIN WAREHOUSE] List error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/warehouses — Create a new warehouse
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, code, location, address, priority = 1 } = req.body;

    if (!name || !code || !location) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name, code, and location are required.' },
      });
    }

    // Check code uniqueness within tenant
    const existing = await prisma.warehouse.findFirst({
      where: { tenantId: req.tenantId, code: code.trim().toUpperCase() },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_CODE', message: `Warehouse code "${code.toUpperCase()}" already exists.` },
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        tenantId: req.tenantId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        location: location.trim(),
        address: address?.trim() || null,
        priority: Number(priority) || 1,
        status: 'ACTIVE',
      },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'WAREHOUSE_CREATED',
      entityType: 'WAREHOUSE',
      entityId: warehouse.id,
      metadata: { name: warehouse.name, code: warehouse.code, location: warehouse.location },
    });

    console.log(`🏭 [ADMIN] Warehouse created: ${warehouse.name} (${warehouse.code})`);
    res.status(201).json({ success: true, data: warehouse });
  } catch (err) {
    console.error('[ADMIN WAREHOUSE] Create error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/warehouses/:id — Update warehouse details
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, address, priority, status } = req.body;

    const existing = await prisma.warehouse.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Warehouse not found.' } });
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        location: location !== undefined ? location.trim() : existing.location,
        address: address !== undefined ? (address?.trim() || null) : existing.address,
        priority: priority !== undefined ? Number(priority) : existing.priority,
        status: status !== undefined ? status : existing.status,
      },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'WAREHOUSE_UPDATED',
      entityType: 'WAREHOUSE',
      entityId: id,
      metadata: { updatedFields: Object.keys(req.body), warehouseCode: existing.code },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[ADMIN WAREHOUSE] Update error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/warehouses/:id — Deactivate a warehouse (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.warehouse.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Warehouse not found.' } });
    }

    // Check for active (ALLOCATED) warehouse allocations
    const activeAllocations = await prisma.warehouseAllocation.count({
      where: { warehouseId: id, status: 'ALLOCATED' },
    });
    if (activeAllocations > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'WAREHOUSE_HAS_ACTIVE_ALLOCATIONS',
          message: `Cannot deactivate warehouse with ${activeAllocations} active inventory allocation(s). Complete or cancel them first.`,
        },
      });
    }

    // Soft delete - set to INACTIVE
    const updated = await prisma.warehouse.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'WAREHOUSE_DEACTIVATED',
      entityType: 'WAREHOUSE',
      entityId: id,
      metadata: { warehouseCode: existing.code, warehouseName: existing.name },
    });

    res.json({ success: true, data: updated, message: `Warehouse "${existing.name}" has been deactivated.` });
  } catch (err) {
    console.error('[ADMIN WAREHOUSE] Delete error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/warehouses/:id/inventory — Get inventory for a specific warehouse
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/inventory', async (req, res) => {
  try {
    const { id } = req.params;

    const warehouse = await prisma.warehouse.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        inventories: {
          include: {
            product: { select: { id: true, name: true, sku: true, type: true } },
          },
        },
      },
    });

    if (!warehouse) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Warehouse not found.' } });
    }

    // Fetch inventory-tracked products that don't yet have a record in this warehouse
    const trackedProductIds = warehouse.inventories.map(i => i.productId);
    const unlinkedProducts = await prisma.product.findMany({
      where: {
        tenantId: req.tenantId,
        isInventoryTracked: true,
        isActive: true,
        id: { notIn: trackedProductIds },
      },
      select: { id: true, name: true, sku: true, type: true },
    });

    res.json({ success: true, data: { warehouse, unlinkedProducts } });
  } catch (err) {
    console.error('[ADMIN WAREHOUSE] Inventory fetch error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/warehouses/:id/inventory — Upsert stock for a product in a warehouse
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/inventory', async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, availableQuantity } = req.body;

    if (!productId || availableQuantity === undefined || availableQuantity === null) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'productId and availableQuantity are required.' },
      });
    }

    const qty = Number(availableQuantity);
    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'availableQuantity must be a non-negative number.' },
      });
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!warehouse) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Warehouse not found.' } });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: req.tenantId },
    });
    if (!product) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.' } });
    }

    // Upsert inventory record
    const inventory = await prisma.inventory.upsert({
      where: { warehouseId_productId: { warehouseId: id, productId } },
      update: { availableQuantity: qty },
      create: {
        tenantId: req.tenantId,
        warehouseId: id,
        productId,
        availableQuantity: qty,
        reservedQuantity: 0,
        allocatedQuantity: 0,
        fulfilledQuantity: 0,
      },
      include: { product: true, warehouse: true },
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'INVENTORY_UPDATED',
      entityType: 'INVENTORY',
      entityId: inventory.id,
      metadata: {
        warehouseCode: warehouse.code,
        productName: product.name,
        availableQuantity: qty,
      },
    });

    console.log(`📦 [ADMIN] Inventory updated: ${product.name} in ${warehouse.code} → ${qty} units`);
    res.json({ success: true, data: inventory });
  } catch (err) {
    console.error('[ADMIN WAREHOUSE] Inventory update error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

export default router;
