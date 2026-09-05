/**
 * inventoryAllocationService.js — Multi-Warehouse Inventory Allocation & Safety Engine
 *
 * Enforces:
 * - Multi-tenant isolation (only warehouses and inventory belonging to the same tenant)
 * - Filtering: ignores non-stock items (SERVICE, SUBSCRIPTION)
 * - Deterministic allocation strategy across warehouses (priority & available stock)
 * - Automatic item splitting across multiple warehouses (e.g. 10 needed -> 8 BLR, 2 HYD)
 * - Inventory safety: row-level atomic decrement inside database transactions
 * - Stock Shortage: if available < required, throws INSUFFICIENT_INVENTORY without negative inventory
 * - Idempotency & Concurrency protection
 * - Full audit trail logging
 */

import prisma from '../db/prisma.js';
import { logAudit } from '../utils/audit.js';

export async function autoAllocateInventory(tenantId, quotationId, actorUserId) {
  if (typeof tenantId === 'object' && tenantId !== null) {
    actorUserId = tenantId.actorUserId || tenantId.userId;
    quotationId = tenantId.quotationId || tenantId.quoteId;
    tenantId = tenantId.tenantId;
  }

  // 1. Fetch quotation with items, product details, and customer
  const quote = await prisma.quotation.findFirst({
    where: { id: quotationId, tenantId },
    include: {
      items: { include: { product: true } },
      customer: true,
      warehouseAllocations: true,
    },
  });

  if (!quote) {
    const err = new Error('Quotation not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Quote must be customer confirmed or in fulfillment
  if (
    quote.status !== 'CUSTOMER_CONFIRMED' &&
    quote.status !== 'FULFILLMENT' &&
    quote.status !== 'PARTIALLY_FULFILLED'
  ) {
    const err = new Error(
      `Quotation cannot be allocated in status: ${quote.status}. Must be in CUSTOMER_CONFIRMED or FULFILLMENT.`
    );
    err.statusCode = 400;
    err.code = 'QUOTE_NOT_CONFIRMED';
    throw err;
  }

  // Idempotency: check if physical items are already allocated
  if (quote.warehouseAllocations && quote.warehouseAllocations.length > 0) {
    const existingAllocations = await prisma.warehouseAllocation.findMany({
      where: { quotationId: quote.id },
      include: { warehouse: true, product: true },
    });
    return {
      success: true,
      isExisting: true,
      message: 'Inventory has already been allocated for this quotation.',
      allocations: existingAllocations,
      isSplitOccurred: existingAllocations.length > 1,
      quotation: quote,
    };
  }

  const physicalItems = quote.items.filter(
    (item) => item.productTypeSnapshot === 'HARDWARE' || item.product?.isInventoryTracked
  );

  if (physicalItems.length === 0) {
    // Only services/subscriptions, no warehouse allocation needed
    return {
      success: true,
      message: 'No physical inventory-tracked products require warehouse allocation.',
      allocations: [],
      isSplitOccurred: false,
    };
  }

  // 2. Fetch all active warehouses for this tenant ordered by priority asc
  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId, status: 'ACTIVE' },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }],
  });

  if (warehouses.length === 0) {
    const err = new Error('No active warehouses configured for this organization.');
    err.statusCode = 400;
    err.code = 'NO_WAREHOUSES';
    throw err;
  }

  const warehouseIds = warehouses.map((w) => w.id);

  // 3. Inspect available inventory across warehouses for each physical product
  const productIds = physicalItems.map((item) => item.productId);
  const inventoryRecords = await prisma.inventory.findMany({
    where: {
      tenantId,
      warehouseId: { in: warehouseIds },
      productId: { in: productIds },
    },
    include: { warehouse: true, product: true },
  });

  // Calculate allocation plan and check for stock shortage
  const plannedAllocations = [];
  let isSplitOccurred = false;

  // Track simulated stock decrements in memory before executing atomic transaction
  const stockAvailableMap = new Map();
  for (const inv of inventoryRecords) {
    const key = `${inv.warehouseId}:${inv.productId}`;
    stockAvailableMap.set(key, inv.availableQuantity);
  }

  for (const item of physicalItems) {
    const requiredQty = item.quantity;
    let remainingNeeded = requiredQty;
    let itemSplitCount = 0;

    // Check total stock across all warehouses for this product
    let totalAvailableForProduct = 0;
    for (const wh of warehouses) {
      const key = `${wh.id}:${item.productId}`;
      totalAvailableForProduct += stockAvailableMap.get(key) || 0;
    }

    if (totalAvailableForProduct < requiredQty) {
      const shortage = requiredQty - totalAvailableForProduct;
      const err = new Error(
        `Insufficient inventory to fulfill product "${item.productNameSnapshot}". Required: ${requiredQty}, Total Available: ${totalAvailableForProduct}, Shortage: ${shortage}.`
      );
      err.statusCode = 409;
      err.code = 'INSUFFICIENT_INVENTORY';
      err.details = {
        productId: item.productId,
        productName: item.productNameSnapshot,
        required: requiredQty,
        available: totalAvailableForProduct,
        shortage,
      };
      throw err;
    }

    // Allocate deterministically across warehouses
    for (const wh of warehouses) {
      if (remainingNeeded <= 0) break;
      const key = `${wh.id}:${item.productId}`;
      const available = stockAvailableMap.get(key) || 0;

      if (available > 0) {
        const allocateQty = Math.min(available, remainingNeeded);
        stockAvailableMap.set(key, available - allocateQty);
        remainingNeeded -= allocateQty;
        itemSplitCount++;

        plannedAllocations.push({
          quotationId: quote.id,
          quotationItemId: item.id,
          warehouseId: wh.id,
          productId: item.productId,
          allocatedQuantity: allocateQty,
          warehouseName: wh.name,
          warehouseCode: wh.code,
          location: wh.location,
          productName: item.productNameSnapshot,
        });
      }
    }

    if (itemSplitCount > 1) {
      isSplitOccurred = true;
    }
  }

  // 4. Execute atomic database transaction
  const results = await prisma.$transaction(async (tx) => {
    // Delete any existing unfulfilled allocations if re-allocating
    const existing = await tx.warehouseAllocation.findMany({
      where: { quotationId: quote.id, tenantId },
    });

    // Revert existing unfulfilled allocations back to available inventory
    for (const prev of existing) {
      if (prev.status === 'ALLOCATED') {
        await tx.inventory.update({
          where: {
            warehouseId_productId: {
              warehouseId: prev.warehouseId,
              productId: prev.productId,
            },
          },
          data: {
            availableQuantity: { increment: prev.allocatedQuantity },
            allocatedQuantity: { decrement: prev.allocatedQuantity },
          },
        });
      }
    }

    await tx.warehouseAllocation.deleteMany({
      where: { quotationId: quote.id, tenantId, status: 'ALLOCATED' },
    });

    // Create new allocations and decrement inventory safely
    const createdAllocations = [];
    for (const plan of plannedAllocations) {
      // Row update with condition availableQuantity >= allocateQty
      const updatedInv = await tx.inventory.update({
        where: {
          warehouseId_productId: {
            warehouseId: plan.warehouseId,
            productId: plan.productId,
          },
        },
        data: {
          availableQuantity: { decrement: plan.allocatedQuantity },
          allocatedQuantity: { increment: plan.allocatedQuantity },
        },
      });

      if (updatedInv.availableQuantity < 0) {
        const err = new Error(
          `Insufficient inventory: concurrent stock allocation detected for product ${plan.productName} in warehouse ${plan.warehouseName}. Stock was depleted by another order.`
        );
        err.statusCode = 409;
        err.code = 'INSUFFICIENT_INVENTORY';
        throw err;
      }

      const trackingNumber = `TRK-${plan.warehouseCode}-${Math.floor(100000 + Math.random() * 900000)}`;
      const alloc = await tx.warehouseAllocation.create({
        data: {
          tenantId,
          quotationId: quote.id,
          quotationItemId: plan.quotationItemId,
          warehouseId: plan.warehouseId,
          productId: plan.productId,
          allocatedQuantity: plan.allocatedQuantity,
          fulfilledQuantity: 0,
          status: 'ALLOCATED',
          trackingNumber,
        },
        include: { warehouse: true, product: true },
      });

      createdAllocations.push({
        ...alloc,
        warehouseName: plan.warehouseName,
        location: plan.location,
        productName: plan.productName,
      });
    }

    // Advance quotation status to FULFILLMENT and fulfillmentStatus to ALLOCATED
    const updatedQuote = await tx.quotation.update({
      where: { id: quote.id },
      data: {
        status: 'FULFILLMENT',
        fulfillmentStatus: 'ALLOCATED',
      },
    });

    // Audit Log
    await logAudit({
      tenantId,
      userId: actorUserId,
      action: 'WAREHOUSE_ALLOCATION_CREATED',
      entityType: 'QUOTATION',
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        allocationsCount: createdAllocations.length,
        isSplitOccurred,
        allocations: createdAllocations.map((a) => ({
          warehouse: a.warehouse?.name || a.warehouseName,
          product: a.product?.name || a.productName,
          quantity: a.allocatedQuantity,
        })),
      },
    });

    return { createdAllocations, updatedQuote };
  });

  console.log(
    `📦 [FINANCE] Inventory Auto-Allocated: Quote #${quote.quoteNumber} | Allocations: ${results.createdAllocations.length} | Split: ${isSplitOccurred}`
  );

  return {
    success: true,
    message: isSplitOccurred
      ? 'Inventory successfully allocated and split across multiple warehouses.'
      : 'Inventory successfully allocated.',
    allocations: results.createdAllocations,
    isSplitOccurred,
    quotation: results.updatedQuote,
  };
}
