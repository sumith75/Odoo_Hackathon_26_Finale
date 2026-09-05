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

export async function autoAllocateInventory(tenantId, quotationId, actorUserId, options = {}) {
  if (typeof tenantId === 'object' && tenantId !== null) {
    actorUserId = tenantId.actorUserId || tenantId.userId;
    quotationId = tenantId.quotationId || tenantId.quoteId;
    tenantId = tenantId.tenantId;
  }
  const { allowPartial = false } = options;

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
  let hasBackorder = false;
  const backorderDetails = [];

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

      if (!allowPartial) {
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

      // Partial allocation permitted: allocate everything currently available
      // now, and track the remainder as a backorder to be consolidated later
      // once more stock arrives (see consolidateBackorder()).
      hasBackorder = true;
      remainingNeeded = totalAvailableForProduct;
      backorderDetails.push({
        quotationItemId: item.id,
        productId: item.productId,
        productName: item.productNameSnapshot,
        required: requiredQty,
        allocatedNow: totalAvailableForProduct,
        backorderedQuantity: shortage,
      });
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

    // Advance quotation status to FULFILLMENT; fulfillmentStatus reflects
    // whether every line was fully covered or some quantity is backordered.
    const updatedQuote = await tx.quotation.update({
      where: { id: quote.id },
      data: {
        status: 'FULFILLMENT',
        fulfillmentStatus: hasBackorder ? 'PARTIALLY_FULFILLED' : 'ALLOCATED',
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
        hasBackorder,
        backorderDetails,
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
    `📦 [FINANCE] Inventory Auto-Allocated: Quote #${quote.quoteNumber} | Allocations: ${results.createdAllocations.length} | Split: ${isSplitOccurred} | Backorder: ${hasBackorder}`
  );

  return {
    success: true,
    message: hasBackorder
      ? 'Available inventory allocated now; remaining quantity is backordered pending restock.'
      : isSplitOccurred
      ? 'Inventory successfully allocated and split across multiple warehouses.'
      : 'Inventory successfully allocated.',
    allocations: results.createdAllocations,
    isSplitOccurred,
    hasBackorder,
    backorderDetails,
    quotation: results.updatedQuote,
  };
}

/**
 * Computes, from current DB state, which quotation lines still have
 * unallocated quantity ("backordered") and whether newly-arrived stock now
 * covers enough of the shortfall to offer a "Consolidate Remaining
 * Backorder" action.
 */
export async function getBackorderStatus(tenantId, quotationId) {
  const quote = await prisma.quotation.findFirst({
    where: { id: quotationId, tenantId },
    include: {
      items: { include: { product: true } },
      warehouseAllocations: true,
    },
  });

  if (!quote) {
    const err = new Error('Quotation not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const physicalItems = quote.items.filter(
    (item) => item.productTypeSnapshot === 'HARDWARE' || item.product?.isInventoryTracked
  );
  const productIds = physicalItems.map((item) => item.productId);

  const inventories = productIds.length
    ? await prisma.inventory.findMany({ where: { tenantId, productId: { in: productIds } } })
    : [];

  const availableByProduct = new Map();
  for (const inv of inventories) {
    availableByProduct.set(
      inv.productId,
      (availableByProduct.get(inv.productId) || 0) + inv.availableQuantity
    );
  }

  const items = physicalItems
    .map((item) => {
      const allocatedQuantity = quote.warehouseAllocations
        .filter((a) => a.quotationItemId === item.id && a.status !== 'CANCELLED')
        .reduce((sum, a) => sum + a.allocatedQuantity, 0);
      const backorderedQuantity = Math.max(0, item.quantity - allocatedQuantity);
      const currentlyAvailableStock = availableByProduct.get(item.productId) || 0;

      return {
        quotationItemId: item.id,
        productId: item.productId,
        productName: item.productNameSnapshot,
        requiredQuantity: item.quantity,
        allocatedQuantity,
        backorderedQuantity,
        currentlyAvailableStock,
        canConsolidate: backorderedQuantity > 0 && currentlyAvailableStock > 0,
      };
    })
    .filter((item) => item.backorderedQuantity > 0);

  return {
    hasBackorder: items.length > 0,
    canConsolidateAny: items.some((item) => item.canConsolidate),
    items,
  };
}

/**
 * Allocates newly-available stock against a quotation's remaining
 * backordered quantity. Additive: existing allocations are left untouched,
 * new allocation rows are created only for the shortfall that can now be
 * covered.
 */
export async function consolidateBackorder(tenantId, quotationId, actorUserId) {
  const backorderStatus = await getBackorderStatus(tenantId, quotationId);

  if (!backorderStatus.hasBackorder) {
    const err = new Error('This quotation has no backordered items to consolidate.');
    err.statusCode = 400;
    err.code = 'NO_BACKORDER';
    throw err;
  }

  const consolidatable = backorderStatus.items.filter((item) => item.canConsolidate);
  if (consolidatable.length === 0) {
    const err = new Error('No newly-arrived stock is available yet to cover the backordered quantity.');
    err.statusCode = 409;
    err.code = 'STOCK_NOT_YET_AVAILABLE';
    throw err;
  }

  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId, status: 'ACTIVE' },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }],
  });

  const results = await prisma.$transaction(async (tx) => {
    const createdAllocations = [];
    let anyStillShort = false;

    for (const backItem of consolidatable) {
      let remainingNeeded = backItem.backorderedQuantity;

      for (const wh of warehouses) {
        if (remainingNeeded <= 0) break;

        const inv = await tx.inventory.findUnique({
          where: { warehouseId_productId: { warehouseId: wh.id, productId: backItem.productId } },
        });
        const available = inv?.availableQuantity || 0;
        if (available <= 0) continue;

        const allocateQty = Math.min(available, remainingNeeded);
        const updatedInv = await tx.inventory.update({
          where: { warehouseId_productId: { warehouseId: wh.id, productId: backItem.productId } },
          data: {
            availableQuantity: { decrement: allocateQty },
            allocatedQuantity: { increment: allocateQty },
          },
        });

        if (updatedInv.availableQuantity < 0) {
          const err = new Error(
            `Concurrent stock change detected while consolidating backorder for ${backItem.productName}.`
          );
          err.statusCode = 409;
          err.code = 'CONCURRENT_UPDATE_CONFLICT';
          throw err;
        }

        const trackingNumber = `TRK-${wh.code}-${Math.floor(100000 + Math.random() * 900000)}`;
        const alloc = await tx.warehouseAllocation.create({
          data: {
            tenantId,
            quotationId,
            quotationItemId: backItem.quotationItemId,
            warehouseId: wh.id,
            productId: backItem.productId,
            allocatedQuantity: allocateQty,
            fulfilledQuantity: 0,
            status: 'ALLOCATED',
            trackingNumber,
          },
          include: { warehouse: true, product: true },
        });

        createdAllocations.push(alloc);
        remainingNeeded -= allocateQty;
      }

      if (remainingNeeded > 0) anyStillShort = true;
    }

    // Any item that was backordered but not consolidatable this round is
    // still short, so the quote as a whole may remain partially fulfilled.
    const stillBackorderedElsewhere = backorderStatus.items.some(
      (item) => !item.canConsolidate
    );

    const updatedQuote = await tx.quotation.update({
      where: { id: quotationId },
      data: {
        fulfillmentStatus: anyStillShort || stillBackorderedElsewhere ? 'PARTIALLY_FULFILLED' : 'ALLOCATED',
      },
    });

    await logAudit({
      tenantId,
      userId: actorUserId,
      action: 'BACKORDER_CONSOLIDATED',
      entityType: 'QUOTATION',
      entityId: quotationId,
      metadata: {
        quoteNumber: updatedQuote.quoteNumber,
        allocationsCreated: createdAllocations.length,
        fullyResolved: !(anyStillShort || stillBackorderedElsewhere),
        allocations: createdAllocations.map((a) => ({
          warehouse: a.warehouse?.name,
          product: a.product?.name,
          quantity: a.allocatedQuantity,
        })),
      },
    });

    return { createdAllocations, updatedQuote, fullyResolved: !(anyStillShort || stillBackorderedElsewhere) };
  });

  console.log(
    `📦 [FINANCE] Backorder Consolidated: Quote ${quotationId} | New Allocations: ${results.createdAllocations.length} | Fully Resolved: ${results.fullyResolved}`
  );

  return {
    success: true,
    message: results.fullyResolved
      ? 'Backordered stock has arrived and been fully allocated.'
      : 'Partially consolidated backorder — some quantity is still awaiting restock.',
    allocations: results.createdAllocations,
    fullyResolved: results.fullyResolved,
    quotation: results.updatedQuote,
  };
}

/**
 * Lets Finance/Operations manually override the automatic warehouse split
 * for one or more quotation lines — e.g. to route around a warehouse the
 * auto-allocator would have picked for operational reasons not captured by
 * priority/stock alone. Existing ALLOCATED (not yet fulfilled) allocations
 * for the affected lines are reverted and replaced with the supplied plan,
 * with the same transactional stock-safety guarantees as the auto path.
 */
export async function overrideAllocation(tenantId, quotationId, actorUserId, manualAllocations) {
  if (!Array.isArray(manualAllocations) || manualAllocations.length === 0) {
    const err = new Error('At least one manual allocation entry is required.');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const quote = await prisma.quotation.findFirst({
    where: { id: quotationId, tenantId },
    include: { items: true },
  });

  if (!quote) {
    const err = new Error('Quotation not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (!['CUSTOMER_CONFIRMED', 'FULFILLMENT', 'PARTIALLY_FULFILLED'].includes(quote.status)) {
    const err = new Error(
      `Quotation cannot be allocated in status: ${quote.status}. Must be in CUSTOMER_CONFIRMED or FULFILLMENT.`
    );
    err.statusCode = 400;
    err.code = 'QUOTE_NOT_CONFIRMED';
    throw err;
  }

  const itemsById = new Map(quote.items.map((i) => [i.id, i]));
  for (const plan of manualAllocations) {
    const item = itemsById.get(plan.quotationItemId);
    const qty = Number(plan.quantity);
    if (!item) {
      const err = new Error(`Quotation line ${plan.quotationItemId} does not belong to this quotation.`);
      err.statusCode = 400;
      err.code = 'INVALID_LINE_ITEM';
      throw err;
    }
    if (!plan.warehouseId || !Number.isFinite(qty) || qty <= 0) {
      const err = new Error('Each manual allocation entry requires a warehouseId and a positive quantity.');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
  }

  const affectedItemIds = [...new Set(manualAllocations.map((p) => p.quotationItemId))];

  const results = await prisma.$transaction(async (tx) => {
    // Revert existing not-yet-fulfilled allocations for the affected lines
    const existing = await tx.warehouseAllocation.findMany({
      where: { quotationId, quotationItemId: { in: affectedItemIds }, status: 'ALLOCATED' },
    });
    for (const prev of existing) {
      await tx.inventory.update({
        where: { warehouseId_productId: { warehouseId: prev.warehouseId, productId: prev.productId } },
        data: {
          availableQuantity: { increment: prev.allocatedQuantity },
          allocatedQuantity: { decrement: prev.allocatedQuantity },
        },
      });
    }
    await tx.warehouseAllocation.deleteMany({
      where: { quotationId, quotationItemId: { in: affectedItemIds }, status: 'ALLOCATED' },
    });

    // Create the manually-specified allocations, enforcing real stock limits
    const createdAllocations = [];
    for (const plan of manualAllocations) {
      const item = itemsById.get(plan.quotationItemId);
      const qty = Number(plan.quantity);

      const warehouse = await tx.warehouse.findFirst({
        where: { id: plan.warehouseId, tenantId },
      });
      if (!warehouse) {
        const err = new Error(`Warehouse ${plan.warehouseId} not found in this organization.`);
        err.statusCode = 400;
        err.code = 'INVALID_WAREHOUSE';
        throw err;
      }

      const updatedInv = await tx.inventory.update({
        where: { warehouseId_productId: { warehouseId: plan.warehouseId, productId: item.productId } },
        data: {
          availableQuantity: { decrement: qty },
          allocatedQuantity: { increment: qty },
        },
      });

      if (updatedInv.availableQuantity < 0) {
        const err = new Error(
          `Insufficient stock in ${warehouse.name} for "${item.productNameSnapshot}" — requested ${qty}.`
        );
        err.statusCode = 409;
        err.code = 'INSUFFICIENT_INVENTORY';
        throw err;
      }

      const trackingNumber = `TRK-${warehouse.code}-${Math.floor(100000 + Math.random() * 900000)}`;
      const alloc = await tx.warehouseAllocation.create({
        data: {
          tenantId,
          quotationId,
          quotationItemId: item.id,
          warehouseId: plan.warehouseId,
          productId: item.productId,
          allocatedQuantity: qty,
          fulfilledQuantity: 0,
          status: 'ALLOCATED',
          trackingNumber,
        },
        include: { warehouse: true, product: true },
      });
      createdAllocations.push(alloc);
    }

    // Recompute overall fulfillment status across ALL of the quote's physical lines
    const allAllocations = await tx.warehouseAllocation.findMany({
      where: { quotationId, status: { not: 'CANCELLED' } },
    });
    const physicalItems = quote.items.filter((i) => i.productTypeSnapshot === 'HARDWARE');
    const anyShort = physicalItems.some((item) => {
      const allocated = allAllocations
        .filter((a) => a.quotationItemId === item.id)
        .reduce((sum, a) => sum + a.allocatedQuantity, 0);
      return allocated < item.quantity;
    });

    const updatedQuote = await tx.quotation.update({
      where: { id: quotationId },
      data: {
        status: quote.status === 'CUSTOMER_CONFIRMED' ? 'FULFILLMENT' : quote.status,
        fulfillmentStatus: anyShort ? 'PARTIALLY_FULFILLED' : 'ALLOCATED',
      },
    });

    await logAudit({
      tenantId,
      userId: actorUserId,
      action: 'WAREHOUSE_ALLOCATION_OVERRIDDEN',
      entityType: 'QUOTATION',
      entityId: quotationId,
      metadata: {
        quoteNumber: updatedQuote.quoteNumber,
        manualAllocations: createdAllocations.map((a) => ({
          warehouse: a.warehouse?.name,
          product: a.product?.name,
          quantity: a.allocatedQuantity,
        })),
      },
    });

    return { createdAllocations, updatedQuote };
  });

  console.log(
    `📦 [FINANCE] Warehouse Allocation Manually Overridden: Quote ${quotationId} | Lines: ${affectedItemIds.length}`
  );

  return {
    success: true,
    message: 'Warehouse allocation manually overridden.',
    allocations: results.createdAllocations,
    quotation: results.updatedQuote,
  };
}
