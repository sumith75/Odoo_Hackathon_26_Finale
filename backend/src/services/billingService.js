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

  const nextBilling = new Date(subscription.nextBillingDate);
  nextBilling.setMonth(nextBilling.getMonth() + 1);

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
