/**
 * billingService.js — Hybrid Billing, Invoicing, and Subscription Management Engine
 *
 * Implements:
 * - Hybrid billing separation: One-Time Capex (Hardware & Services) vs Recurring Opex (Subscriptions)
 * - Authoritative snapshot calculations from QuotationItems
 * - Idempotent invoice generation (prevents duplicate invoice creation)
 * - Itemized invoice lines with taxes, discounts, and billing types
 * - Automated recurring subscription billing with nextBillingDate advance
 * - Full audit trails
 */

import prisma from '../db/prisma.js';
import { logAudit } from '../utils/audit.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Advances a date by one full billing cycle for the given frequency. */
function advanceByCycle(date, billingFrequency) {
  const next = new Date(date);
  if (billingFrequency === 'YEARLY') {
    next.setFullYear(next.getFullYear() + 1);
  } else if (billingFrequency === 'QUARTERLY') {
    next.setMonth(next.getMonth() + 3);
  } else {
    next.setMonth(next.getMonth() + 1); // MONTHLY (default)
  }
  return next;
}

/** Inverse of advanceByCycle — derives the start of the current billing cycle from its end. */
function subtractCycle(date, billingFrequency) {
  const prev = new Date(date);
  if (billingFrequency === 'YEARLY') {
    prev.setFullYear(prev.getFullYear() - 1);
  } else if (billingFrequency === 'QUARTERLY') {
    prev.setMonth(prev.getMonth() - 3);
  } else {
    prev.setMonth(prev.getMonth() - 1);
  }
  return prev;
}

export function calculateHybridBilling(quote) {
  const items = quote.items || [];

  const oneTimeItems = [];
  const recurringItems = [];

  let oneTimeSubtotal = 0;
  let oneTimeDiscount = 0;
  let oneTimeTax = 0;
  let oneTimeTotal = 0;

  let recurringMRR = 0;

  for (const item of items) {
    const isSubscription =
      item.productTypeSnapshot === 'SUBSCRIPTION' ||
      item.product?.billingType === 'RECURRING';

    const unitPrice = parseFloat(item.unitPrice) || 0;
    const qty = item.quantity || 1;
    const discountAmount = parseFloat(item.discountAmount) || 0;
    const taxAmount = parseFloat(item.taxAmount) || 0;
    const lineTotal = parseFloat(item.lineTotal) || 0;

    const formattedItem = {
      id: item.id,
      productId: item.productId,
      productName: item.productNameSnapshot,
      productType: item.productTypeSnapshot,
      quantity: qty,
      unitPrice,
      discountAmount,
      taxAmount,
      lineTotal,
      billingType: isSubscription ? 'RECURRING' : 'ONE_TIME',
    };

    if (isSubscription) {
      recurringItems.push(formattedItem);
      recurringMRR += lineTotal;
    } else {
      oneTimeItems.push(formattedItem);
      oneTimeSubtotal += unitPrice * qty;
      oneTimeDiscount += discountAmount;
      oneTimeTax += taxAmount;
      oneTimeTotal += lineTotal;
    }
  }

  const recurringARR = recurringMRR * 12;

  return {
    oneTime: {
      items: oneTimeItems,
      subtotal: Math.round(oneTimeSubtotal * 100) / 100,
      discountAmount: Math.round(oneTimeDiscount * 100) / 100,
      taxAmount: Math.round(oneTimeTax * 100) / 100,
      totalAmount: Math.round(oneTimeTotal * 100) / 100,
      total: Math.round(oneTimeTotal * 100) / 100,
    },
    recurring: {
      items: recurringItems,
      mrr: Math.round(recurringMRR * 100) / 100,
      arr: Math.round(recurringARR * 100) / 100,
      totalMRR: Math.round(recurringMRR * 100) / 100,
      billingInterval: 'MONTHLY',
    },
    grandTotal: Math.round((oneTimeTotal + recurringMRR) * 100) / 100,
  };
}

async function generateInvoiceNumber(tenantId) {
  const currentYear = new Date().getFullYear();
  const prefix = `INV-${currentYear}-`;

  // Use MAX-based sequence: safe across deletions and re-inserts (unlike count+1)
  const lastInvoice = await prisma.invoice.findFirst({
    where: { tenantId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  let nextSeq = 1;
  if (lastInvoice) {
    const lastSeqStr = lastInvoice.invoiceNumber.replace(prefix, '');
    const lastSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

export async function generateOneTimeInvoice(tenantId, quotationId, actorUserId) {
  if (typeof tenantId === 'object' && tenantId !== null) {
    const opts = tenantId;
    actorUserId = opts.actorUserId || opts.userId || opts.generatedBy;
    quotationId = opts.quotationId || opts.quoteId;
    tenantId = opts.tenantId;
  }

  const quote = await prisma.quotation.findFirst({
    where: { id: quotationId, tenantId },
    include: {
      items: { include: { product: true } },
      customer: true,
      invoices: true,
    },
  });

  if (!quote) {
    const err = new Error('Quotation not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Idempotency: check if ONE_TIME invoice already exists
  const existingInvoice = quote.invoices.find((inv) => inv.invoiceType === 'ONE_TIME');
  if (existingInvoice) {
    console.log(`ℹ️ [BILLING] Invoice already exists for Quote #${quote.quoteNumber}: ${existingInvoice.invoiceNumber}`);
    return {
      success: true,
      isExisting: true,
      message: `Invoice ${existingInvoice.invoiceNumber} already exists for this quotation.`,
      invoice: existingInvoice,
    };
  }

  const hybrid = calculateHybridBilling(quote);
  const oneTime = hybrid.oneTime;

  if (oneTime.items.length === 0) {
    const err = new Error('No one-time products exist on this quotation to invoice.');
    err.statusCode = 400;
    err.code = 'NO_ONETIME_ITEMS';
    throw err;
  }

  const invoiceNumber = await generateInvoiceNumber(tenantId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        quotationId: quote.id,
        customerId: quote.customerId,
        invoiceType: 'ONE_TIME',
        status: 'ISSUED',
        subtotal: oneTime.subtotal,
        discountAmount: oneTime.discountAmount,
        taxAmount: oneTime.taxAmount,
        totalAmount: oneTime.totalAmount,
        amountPaid: 0,
        amountDue: oneTime.totalAmount,
        issueDate: new Date(),
        dueDate,
        currency: quote.tenant?.currency || 'INR',
        items: {
          create: oneTime.items.map((it) => ({
            tenantId,
            quotationItemId: it.id,
            productId: it.productId,
            description: it.productName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountAmount: it.discountAmount,
            taxAmount: it.taxAmount,
            lineTotal: it.lineTotal,
            billingType: 'ONE_TIME',
          })),
        },
      },
      include: { items: true, customer: true },
    });

    // Update quote status to INVOICED
    await tx.quotation.update({
      where: { id: quote.id },
      data: {
        status: 'INVOICED',
        billingStatus: 'INVOICED',
      },
    });

    // Audit Log
    await logAudit({
      tenantId,
      userId: actorUserId,
      action: 'INVOICE_GENERATED',
      entityType: 'INVOICE',
      entityId: invoice.id,
      metadata: {
        invoiceNumber,
        quotationNumber: quote.quoteNumber,
        invoiceType: 'ONE_TIME',
        totalAmount: oneTime.totalAmount,
      },
    });

    return invoice;
  });

  console.log(`🧾 [BILLING] One-Time Invoice Generated: ${result.invoiceNumber} | Amount: ${result.totalAmount}`);

  return {
    success: true,
    isExisting: false,
    message: `Invoice ${result.invoiceNumber} generated successfully.`,
    invoice: result,
  };
}

export async function generateRecurringInvoice(tenantId, subscriptionId, actorUserId) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, tenantId },
    include: {
      customer: true,
      product: true,
      quotation: true,
    },
  });

  if (!subscription) {
    const err = new Error('Subscription not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (subscription.status !== 'ACTIVE') {
    const err = new Error(`Cannot bill subscription with status: ${subscription.status}`);
    err.statusCode = 400;
    err.code = 'SUBSCRIPTION_INACTIVE';
    throw err;
  }

  const invoiceNumber = await generateInvoiceNumber(tenantId);
  const now = new Date();
  const periodStart = subscription.startDate;
  const periodEnd = subscription.nextBillingDate;

  const nextBilling = advanceByCycle(subscription.nextBillingDate, subscription.billingFrequency);

  const amount = parseFloat(subscription.recurringTotal);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        quotationId: subscription.quotationId,
        customerId: subscription.customerId,
        subscriptionId: subscription.id,
        invoiceType: 'RECURRING',
        status: 'ISSUED',
        subtotal: amount,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: amount,
        amountPaid: 0,
        amountDue: amount,
        issueDate: now,
        dueDate,
        currency: 'INR',
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        items: {
          create: [
            {
              tenantId,
              quotationItemId: subscription.quotationItemId,
              productId: subscription.productId,
              description: `${subscription.product.name} (Recurring Cycle: ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()})`,
              quantity: subscription.quantity,
              unitPrice: subscription.recurringUnitPrice,
              discountAmount: 0,
              taxAmount: 0,
              lineTotal: amount,
              billingType: 'RECURRING',
              servicePeriodStart: periodStart,
              servicePeriodEnd: periodEnd,
            },
          ],
        },
      },
      include: { items: true, customer: true },
    });

    // Advance nextBillingDate on subscription
    const updatedSub = await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        nextBillingDate: nextBilling,
      },
    });

    // Audit Log
    await logAudit({
      tenantId,
      userId: actorUserId,
      action: 'RECURRING_INVOICE_GENERATED',
      entityType: 'INVOICE',
      entityId: invoice.id,
      metadata: {
        invoiceNumber,
        subscriptionId: subscription.id,
        period: `${periodStart.toISOString()} to ${periodEnd.toISOString()}`,
        nextBillingDate: nextBilling.toISOString(),
      },
    });

    return { invoice, subscription: updatedSub };
  });

  console.log(
    `🔄 [BILLING] Recurring Invoice Generated: ${result.invoice.invoiceNumber} | Sub: ${subscription.product?.name} | Next: ${nextBilling.toLocaleDateString()}`
  );

  return {
    success: true,
    message: `Recurring invoice ${result.invoice.invoiceNumber} generated. Next billing date advanced to ${nextBilling.toLocaleDateString()}.`,
    invoice: result.invoice,
    subscription: result.subscription,
  };
}

/**
 * Mid-cycle subscription quantity change with proration.
 *
 * An increase bills the customer now for the prorated cost of the added
 * quantity over the remaining days of the current cycle. A decrease issues
 * a credit note (represented as a negative-amount invoice, since there is
 * no separate credit-note entity) for the prorated value of the removed
 * quantity, per the spec's "proration rules for mid cycle quantity ...
 * changes" and "partial refund or credit note" requirements.
 */
export async function changeSubscriptionQuantity(tenantId, subscriptionId, newQuantity, actorUserId, reason) {
  const qty = Number(newQuantity);
  if (!Number.isFinite(qty) || qty < 0) {
    const err = new Error('newQuantity must be a non-negative number.');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, tenantId },
    include: { product: true, customer: true },
  });

  if (!subscription) {
    const err = new Error('Subscription not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (subscription.status !== 'ACTIVE') {
    const err = new Error(`Cannot change quantity on a subscription with status: ${subscription.status}`);
    err.statusCode = 400;
    err.code = 'SUBSCRIPTION_INACTIVE';
    throw err;
  }

  if (qty === subscription.quantity) {
    return {
      success: true,
      message: 'Requested quantity matches the current quantity — nothing to prorate.',
      proration: null,
      subscription,
    };
  }

  const cycleEnd = new Date(subscription.nextBillingDate);
  const cycleStart = subtractCycle(cycleEnd, subscription.billingFrequency);
  const totalCycleDays = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / MS_PER_DAY));
  const now = new Date();
  const remainingDays = Math.max(0, Math.min(totalCycleDays, Math.round((cycleEnd.getTime() - now.getTime()) / MS_PER_DAY)));

  const unitPrice = parseFloat(subscription.recurringUnitPrice);
  const quantityDelta = qty - subscription.quantity;
  const proratedAmount = Math.round(((unitPrice * quantityDelta * remainingDays) / totalCycleDays) * 100) / 100;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const result = await prisma.$transaction(async (tx) => {
    const updatedSub = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        quantity: qty,
        recurringTotal: Math.round(unitPrice * qty * 100) / 100,
      },
    });

    let adjustmentInvoice = null;

    if (proratedAmount !== 0) {
      const invoiceNumber = await generateInvoiceNumber(tenantId);
      const isCredit = proratedAmount < 0;
      const description = isCredit
        ? `Credit note — mid-cycle quantity decrease for ${subscription.product.name} (${subscription.quantity} -> ${qty}, ${remainingDays}/${totalCycleDays} days remaining in cycle)`
        : `Mid-cycle proration — quantity increase for ${subscription.product.name} (${subscription.quantity} -> ${qty}, ${remainingDays}/${totalCycleDays} days remaining in cycle)`;

      adjustmentInvoice = await tx.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          quotationId: subscription.quotationId,
          customerId: subscription.customerId,
          subscriptionId,
          invoiceType: 'RECURRING',
          status: 'ISSUED',
          subtotal: proratedAmount,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: proratedAmount,
          amountPaid: 0,
          amountDue: proratedAmount,
          issueDate: now,
          dueDate: isCredit ? now : dueDate,
          currency: 'INR',
          billingPeriodStart: now,
          billingPeriodEnd: cycleEnd,
          items: {
            create: [
              {
                tenantId,
                quotationItemId: subscription.quotationItemId,
                productId: subscription.productId,
                description,
                quantity: Math.abs(quantityDelta),
                unitPrice,
                discountAmount: 0,
                taxAmount: 0,
                lineTotal: proratedAmount,
                billingType: 'RECURRING',
                servicePeriodStart: now,
                servicePeriodEnd: cycleEnd,
              },
            ],
          },
        },
        include: { items: true },
      });
    }

    await logAudit({
      tenantId,
      userId: actorUserId,
      action: 'SUBSCRIPTION_QUANTITY_CHANGED',
      entityType: 'SUBSCRIPTION',
      entityId: subscriptionId,
      metadata: {
        previousQuantity: subscription.quantity,
        newQuantity: qty,
        proratedAmount,
        remainingDays,
        totalCycleDays,
        reason: reason || null,
        adjustmentInvoiceNumber: adjustmentInvoice?.invoiceNumber || null,
      },
    });

    return { updatedSub, adjustmentInvoice };
  });

  console.log(
    `📐 [BILLING] Subscription ${subscriptionId} quantity ${subscription.quantity} -> ${qty} | Prorated: ${proratedAmount} | Remaining ${remainingDays}/${totalCycleDays} days`
  );

  return {
    success: true,
    message:
      proratedAmount > 0
        ? `Prorated adjustment invoice of ₹${proratedAmount} generated for the quantity increase.`
        : proratedAmount < 0
        ? `Credit note of ₹${Math.abs(proratedAmount)} issued for the quantity decrease.`
        : 'Quantity changed with no mid-cycle cost impact.',
    proration: {
      previousQuantity: subscription.quantity,
      newQuantity: qty,
      remainingDays,
      totalCycleDays,
      proratedAmount,
    },
    subscription: result.updatedSub,
    adjustmentInvoice: result.adjustmentInvoice,
  };
}

/**
 * Cancels an active subscription, issuing a prorated credit note for any
 * unused time remaining in the current billing cycle.
 */
export async function cancelSubscription(tenantId, subscriptionId, actorUserId, reason) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, tenantId },
    include: { product: true },
  });

  if (!subscription) {
    const err = new Error('Subscription not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (subscription.status !== 'ACTIVE') {
    const err = new Error(`Subscription is already ${subscription.status}.`);
    err.statusCode = 400;
    err.code = 'SUBSCRIPTION_ALREADY_INACTIVE';
    throw err;
  }

  const cycleEnd = new Date(subscription.nextBillingDate);
  const cycleStart = subtractCycle(cycleEnd, subscription.billingFrequency);
  const totalCycleDays = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / MS_PER_DAY));
  const now = new Date();
  const remainingDays = Math.max(0, Math.min(totalCycleDays, Math.round((cycleEnd.getTime() - now.getTime()) / MS_PER_DAY)));

  const unusedAmount = Math.round(
    ((parseFloat(subscription.recurringTotal) * remainingDays) / totalCycleDays) * 100
  ) / 100;

  const result = await prisma.$transaction(async (tx) => {
    const updatedSub = await tx.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELLED', endDate: now },
    });

    let creditNote = null;
    if (unusedAmount > 0) {
      const invoiceNumber = await generateInvoiceNumber(tenantId);
      creditNote = await tx.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          quotationId: subscription.quotationId,
          customerId: subscription.customerId,
          subscriptionId,
          invoiceType: 'RECURRING',
          status: 'ISSUED',
          subtotal: -unusedAmount,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: -unusedAmount,
          amountPaid: 0,
          amountDue: -unusedAmount,
          issueDate: now,
          dueDate: now,
          currency: 'INR',
          billingPeriodStart: now,
          billingPeriodEnd: cycleEnd,
          items: {
            create: [
              {
                tenantId,
                quotationItemId: subscription.quotationItemId,
                productId: subscription.productId,
                description: `Credit note — unused subscription time for ${subscription.product.name} following cancellation (${remainingDays}/${totalCycleDays} days remaining in cycle)`,
                quantity: subscription.quantity,
                unitPrice: parseFloat(subscription.recurringUnitPrice),
                discountAmount: 0,
                taxAmount: 0,
                lineTotal: -unusedAmount,
                billingType: 'RECURRING',
                servicePeriodStart: now,
                servicePeriodEnd: cycleEnd,
              },
            ],
          },
        },
        include: { items: true },
      });
    }

    await logAudit({
      tenantId,
      userId: actorUserId,
      action: 'SUBSCRIPTION_CANCELLED',
      entityType: 'SUBSCRIPTION',
      entityId: subscriptionId,
      metadata: {
        reason: reason || null,
        remainingDays,
        totalCycleDays,
        unusedAmount,
        creditNoteNumber: creditNote?.invoiceNumber || null,
      },
    });

    return { updatedSub, creditNote };
  });

  console.log(
    `🛑 [BILLING] Subscription ${subscriptionId} cancelled | Unused-time credit: ${unusedAmount}`
  );

  return {
    success: true,
    message:
      unusedAmount > 0
        ? `Subscription cancelled. Credit note of ₹${unusedAmount} issued for unused time.`
        : 'Subscription cancelled.',
    subscription: result.updatedSub,
    creditNote: result.creditNote,
  };
}
