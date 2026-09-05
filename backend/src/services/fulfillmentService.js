/**
 * fulfillmentService.js — Physical Goods, Services, and Subscription Fulfillment Engine
 *
 * Handles:
 * - Full & partial physical allocation fulfillment from warehouses
 * - Inventory state updates (allocatedQuantity -> fulfilledQuantity)
 * - Service product fulfillment (Installation Service, Training, etc.)
 * - Automatic subscription activation & recurring schedule creation
 * - Status transitions (PARTIALLY_FULFILLED / FULFILLED)
 * - Audit logging
 */

import prisma from '../db/prisma.js';
import { logAudit } from '../utils/audit.js';

export async function getFulfillmentDossier(tenantId, quotationId) {
  const quote = await prisma.quotation.findFirst({
    where: { id: quotationId, tenantId },
    include: {
      customer: true,
      salesRep: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          product: true,
          warehouseAllocations: { include: { warehouse: true } },
        },
      },
      warehouseAllocations: {
        include: { warehouse: true, product: true, quotationItem: true },
      },
      subscriptions: { include: { product: true } },
      invoices: true,
      deliveryRequests: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!quote) {
    const err = new Error('Quotation not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Categorize items
  const physicalItems = quote.items.filter(
    (i) => i.productTypeSnapshot === 'HARDWARE' || i.product?.isInventoryTracked
  );
  const serviceItems = quote.items.filter(
    (i) => i.productTypeSnapshot === 'SERVICE'
  );
  const subscriptionItems = quote.items.filter(
    (i) => i.productTypeSnapshot === 'SUBSCRIPTION'
  );

  // Compute progress
  let totalPhysicalRequired = 0;
  let totalPhysicalAllocated = 0;
  let totalPhysicalFulfilled = 0;

  physicalItems.forEach((it) => {
    totalPhysicalRequired += it.quantity;
    const itemAllocations = quote.warehouseAllocations.filter((a) => a.quotationItemId === it.id);
    itemAllocations.forEach((a) => {
      totalPhysicalAllocated += a.allocatedQuantity;
      totalPhysicalFulfilled += a.fulfilledQuantity;
    });
  });

  const physicalProgress =
    totalPhysicalRequired > 0
      ? Math.round((totalPhysicalFulfilled / totalPhysicalRequired) * 100)
      : 100;

  const servicesCompleted = serviceItems.filter((s) => s.serviceFulfilled).length;
  const servicesProgress =
    serviceItems.length > 0 ? Math.round((servicesCompleted / serviceItems.length) * 100) : 100;

  return {
    quote,
    categories: {
      physical: physicalItems,
      service: serviceItems,
      subscription: subscriptionItems,
    },
    metrics: {
      totalPhysicalRequired,
      totalPhysicalAllocated,
      totalPhysicalFulfilled,
      physicalProgress,
      servicesCompleted,
      servicesTotal: serviceItems.length,
      servicesProgress,
      activeSubscriptions: quote.subscriptions.length,
    },
  };
}

export async function processFulfillment(tenantId, quotationId, payload = {}, actorUserId) {
  if (typeof tenantId === 'object' && tenantId !== null) {
    const opts = tenantId;
    actorUserId = opts.actorUserId || opts.userId || opts.recordedBy;
    quotationId = opts.quotationId || opts.quoteId;
    payload = opts.payload || opts;
    tenantId = opts.tenantId;
  }

  const { allocationIds = [], markAllPhysical = true, serviceItemIds = [] } = payload || {};

  const quote = await prisma.quotation.findFirst({
    where: { id: quotationId, tenantId },
    include: {
      items: { include: { product: true } },
      warehouseAllocations: true,
      subscriptions: true,
    },
  });

  if (!quote) {
    const err = new Error('Quotation not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Process Physical Warehouse Allocations
    let targetAllocations = quote.warehouseAllocations;
    if (Array.isArray(allocationIds) && allocationIds.length > 0) {
      targetAllocations = targetAllocations.filter((a) => allocationIds.includes(a.id));
    }

    for (const alloc of targetAllocations) {
      if (alloc.status !== 'FULFILLED') {
        const fulfillQty = alloc.allocatedQuantity - alloc.fulfilledQuantity;
        if (fulfillQty > 0) {
          // Update WarehouseAllocation
          await tx.warehouseAllocation.update({
            where: { id: alloc.id },
            data: {
              fulfilledQuantity: alloc.allocatedQuantity,
              status: 'FULFILLED',
            },
          });

          // Update Inventory: allocatedQuantity -> fulfilledQuantity
          await tx.inventory.update({
            where: {
              warehouseId_productId: {
                warehouseId: alloc.warehouseId,
                productId: alloc.productId,
              },
            },
            data: {
              allocatedQuantity: { decrement: fulfillQty },
              fulfilledQuantity: { increment: fulfillQty },
            },
          });
        }
      }
    }

    // 2. Process Service Items
    const serviceItems = quote.items.filter(
      (i) => i.productTypeSnapshot === 'SERVICE'
    );
    for (const s of serviceItems) {
      if (serviceItemIds.length === 0 || serviceItemIds.includes(s.id)) {
        await tx.quotationItem.update({
          where: { id: s.id },
          data: { serviceFulfilled: true },
        });
      }
    }

    // 3. Process Subscription Items -> Automatically create Subscription records
    const subscriptionItems = quote.items.filter(
      (i) => i.productTypeSnapshot === 'SUBSCRIPTION'
    );
    for (const sub of subscriptionItems) {
      const existingSub = await tx.subscription.findUnique({
        where: {
          quotationId_quotationItemId: {
            quotationId: quote.id,
            quotationItemId: sub.id,
          },
        },
      });

      if (!existingSub) {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        const subRecord = await tx.subscription.create({
          data: {
            tenantId,
            quotationId: quote.id,
            customerId: quote.customerId,
            quotationItemId: sub.id,
            productId: sub.productId,
            status: 'ACTIVE',
            quantity: sub.quantity,
            recurringUnitPrice: sub.unitPrice,
            recurringTotal: sub.lineTotal,
            billingFrequency: sub.product?.billingInterval || 'MONTHLY',
            startDate: new Date(),
            nextBillingDate: nextMonth,
          },
        });

        await logAudit({
          tenantId,
          userId: actorUserId,
          action: 'SUBSCRIPTION_CREATED',
          entityType: 'SUBSCRIPTION',
          entityId: subRecord.id,
          metadata: {
            quotationId: quote.id,
            productName: sub.productNameSnapshot,
            recurringTotal: parseFloat(sub.lineTotal),
            nextBillingDate: nextMonth.toISOString(),
          },
        });
      }
    }

    // 4. Evaluate overall fulfillment completion
    const allAllocations = await tx.warehouseAllocation.findMany({
      where: { quotationId: quote.id, tenantId },
    });
    const allServices = await tx.quotationItem.findMany({
      where: { quotationId: quote.id, productTypeSnapshot: 'SERVICE' },
    });

    const isAllPhysicalFulfilled =
      allAllocations.length === 0 || allAllocations.every((a) => a.status === 'FULFILLED');
    const isAllServicesFulfilled =
      allServices.length === 0 || allServices.every((s) => s.serviceFulfilled);

    const isComplete = isAllPhysicalFulfilled && isAllServicesFulfilled;
    const newStatus = isComplete ? 'FULFILLED' : 'PARTIALLY_FULFILLED';
    const newFulfillmentStatus = isComplete ? 'FULFILLED' : 'PARTIALLY_FULFILLED';

    const updatedQuote = await tx.quotation.update({
      where: { id: quote.id },
      data: {
        status: newStatus,
        fulfillmentStatus: newFulfillmentStatus,
      },
      include: {
        warehouseAllocations: { include: { warehouse: true } },
        subscriptions: true,
        items: true,
      },
    });

    // 5. Audit Log
    await logAudit({
      tenantId,
      userId: actorUserId,
      action: isComplete ? 'FULFILLMENT_COMPLETED' : 'FULFILLMENT_PARTIAL',
      entityType: 'QUOTATION',
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        newStatus,
        isComplete,
        physicalAllocationsFulfilled: allAllocations.filter((a) => a.status === 'FULFILLED').length,
        servicesFulfilled: allServices.filter((s) => s.serviceFulfilled).length,
      },
    });

    console.log(
      `🚚 [FINANCE] Fulfillment Processed: Quote #${quote.quoteNumber} -> Status: ${newStatus} (${newFulfillmentStatus})`
    );

    return {
      success: true,
      message: isComplete
        ? 'All physical and service items successfully fulfilled.'
        : 'Partial fulfillment processed.',
      quotation: updatedQuote,
    };
  }, { maxWait: 15000, timeout: 30000 });
}

export { processFulfillment as fulfillAllocations };

