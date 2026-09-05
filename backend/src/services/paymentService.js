/**
 * paymentService.js — Centralized Payment Engine & Settlement Service
 *
 * Provides authoritative, PostgreSQL-persisted payment lifecycle management:
 * - recordPayment(): Transactional payment processing with row-locking, idempotency,
 *                    partial payments, quotation state sync, audit logs, notifications,
 *                    and Deal Health telemetry invalidation.
 * - refundPayment(): Partial and full payment refunds, restoring invoice balances.
 * - listPayments(): Multi-tenant, paginated, filtered payment query.
 * - getPaymentById(): Isolated payment detail lookup.
 * - getInvoicePaymentSummary(): Payment & balance rollup.
 * - simulateInvoicePayment(): Backwards-compatible alias for existing endpoints & tests.
 */

import prisma from '../db/prisma.js';
import simulatedPaymentProvider from './paymentProviders/SimulatedPaymentProvider.js';
import { logAudit } from '../utils/audit.js';
import { createNotification } from './notificationService.js';
import { invalidateDealHealthCache } from './dealHealthService.js';

const MAX_PAGINATION_LIMIT = 100;

/**
 * Record a payment against an invoice with strict PostgreSQL transaction and idempotency.
 */
export async function recordPayment(options) {
  let {
    tenantId,
    invoiceId,
    amount,
    currency,
    method = 'SIMULATED',
    paymentMethod,
    provider = 'SIMULATED',
    transactionReference,
    idempotencyKey,
    notes,
    actorUserId,
    simulateFailure = false,
  } = options;

  const finalMethod = (paymentMethod || method || 'SIMULATED').toUpperCase();

  if (!tenantId) {
    const err = new Error('Tenant ID is required to record a payment.');
    err.statusCode = 400;
    err.code = 'TENANT_REQUIRED';
    throw err;
  }

  if (!invoiceId) {
    const err = new Error('Invoice ID is required to record a payment.');
    err.statusCode = 400;
    err.code = 'INVOICE_REQUIRED';
    throw err;
  }
  const result = await prisma.$transaction(
    async (tx) => {
      // 1. Fetch invoice ensuring tenant isolation with lock
      const invoice = await tx.invoice.findFirst({
        where: {
          id: invoiceId,
          tenantId,
        },
        include: {
          quotation: {
            include: {
              salesRep: { select: { id: true, name: true, email: true } },
            },
          },
          customer: true,
          payments: true,
        },
      });

      if (!invoice) {
        const err = new Error(`Invoice with ID '${invoiceId}' not found.`);
        err.statusCode = 404;
        err.code = 'INVOICE_NOT_FOUND';
        throw err;
      }

      // 2. Idempotency verification (Must run before status/balance checks so replays succeed)
      const txnRef = transactionReference || options.referenceNumber;
      if (idempotencyKey) {
        const existingPayment = await tx.payment.findFirst({
          where: {
            tenantId,
            idempotencyKey,
          },
          include: { invoice: true },
        });

        if (existingPayment) {
          if (
            (amount !== undefined && amount !== null && Math.abs(Number(existingPayment.amount) - Number(amount)) > 0.01) ||
            existingPayment.invoiceId !== invoice.id
          ) {
            const err = new Error(
              `Idempotency conflict: Key '${idempotencyKey}' was already used with differing amount or invoice.`
            );
            err.statusCode = 409;
            err.code = 'IDEMPOTENCY_CONFLICT';
            throw err;
          }

          return {
            success: true,
            isExisting: true,
            message: `Payment already processed idempotently with key '${idempotencyKey}'.`,
            payment: existingPayment,
            invoice: existingPayment.invoice || invoice,
            quotation: invoice.quotation,
          };
        }
      }

      if (txnRef) {
        const existingByRef = await tx.payment.findFirst({
          where: {
            tenantId,
            transactionReference: txnRef,
          },
          include: { invoice: true },
        });

        if (existingByRef) {
          if (
            (amount !== undefined && amount !== null && Math.abs(Number(existingByRef.amount) - Number(amount)) > 0.01) ||
            existingByRef.invoiceId !== invoice.id
          ) {
            const err = new Error(
              `Transaction reference conflict: Reference '${txnRef}' already exists with differing payload.`
            );
            err.statusCode = 409;
            err.code = 'TRANSACTION_REFERENCE_CONFLICT';
            throw err;
          }

          return {
            success: true,
            isExisting: true,
            message: `Payment already processed with transaction reference '${txnRef}'.`,
            payment: existingByRef,
            invoice: existingByRef.invoice || invoice,
            quotation: invoice.quotation,
          };
        }
      }

      // 3. Validate invoice payable state
      if (invoice.status === 'PAID') {
        const err = new Error(`Invoice '${invoice.invoiceNumber}' is already fully paid.`);
        err.statusCode = 400;
        err.code = 'INVOICE_ALREADY_PAID';
        throw err;
      }

      if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') {
        const err = new Error(`Cannot record payment against ${invoice.status.toLowerCase()} invoice '${invoice.invoiceNumber}'.`);
        err.statusCode = 400;
        err.code = 'INVOICE_NOT_PAYABLE';
        throw err;
      }

      const currentDue = Number(invoice.amountDue);
      const paymentAmount = amount !== undefined && amount !== null ? Number(amount) : currentDue;

      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        const err = new Error('Payment amount must be a valid number greater than 0.');
        err.statusCode = 400;
        err.code = 'INVALID_PAYMENT_AMOUNT';
        throw err;
      }

      // Validate currency if specified
      const targetCurrency = currency || invoice.currency || 'INR';
      if (currency && invoice.currency && currency !== invoice.currency) {
        const err = new Error(`Currency mismatch. Invoice currency is ${invoice.currency}, received ${currency}.`);
        err.statusCode = 400;
        err.code = 'CURRENCY_MISMATCH';
        throw err;
      }

      // 4. Reject overpayment
      if (paymentAmount > currentDue + 0.01) {
        const err = new Error(
          `Payment amount (₹${paymentAmount.toLocaleString('en-IN')}) exceeds outstanding due (₹${currentDue.toLocaleString('en-IN')}).`
        );
        err.statusCode = 400;
        err.code = 'PAYMENT_EXCEEDS_DUE';
        throw err;
      }

      // 5. Process through PaymentProvider
      const providerResult = await simulatedPaymentProvider.processPayment({
        amount: paymentAmount,
        currency: targetCurrency,
        method: finalMethod,
        transactionReference: txnRef,
        idempotencyKey,
        customer: invoice.customer,
        invoice,
        notes,
        options: { simulateFailure },
      });

      if (!providerResult.success || providerResult.status === 'FAILED') {
        // Record failed payment in DB without touching invoice balances
        const failedPayment = await tx.payment.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            customerId: invoice.customerId,
            amount: paymentAmount,
            currency: targetCurrency,
            paymentMethod: finalMethod,
            provider: providerResult.provider || 'SIMULATED',
            status: 'FAILED',
            transactionReference: providerResult.transactionReference,
            idempotencyKey: idempotencyKey || null,
            notes: notes || null,
            failureReason: providerResult.failureReason || 'Payment declined',
            recordedBy: actorUserId || null,
            paidAt: new Date(),
          },
        });

        const err = new Error(providerResult.failureReason || 'Payment processing failed');
        err.statusCode = 400;
        err.code = 'PAYMENT_FAILED';
        err.payment = failedPayment;
        err.invoice = invoice;
        throw err;
      }

      // 6. Create successful Payment record
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount: paymentAmount,
          refundedAmount: 0,
          currency: targetCurrency,
          paymentMethod: finalMethod,
          provider: providerResult.provider || 'SIMULATED',
          status: 'SUCCEEDED',
          transactionReference: providerResult.transactionReference,
          idempotencyKey: idempotencyKey || null,
          notes: notes || null,
          recordedBy: actorUserId || null,
          paidAt: providerResult.paidAt || new Date(),
        },
      });

      // 7. Update Invoice totals and state
      const newAmountPaid = Number(invoice.amountPaid) + paymentAmount;
      const newAmountDue = Math.max(0, currentDue - paymentAmount);
      const newInvoiceStatus = newAmountDue <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newInvoiceStatus,
        },
      });

      // 8. Update Quotation status & billingStatus if attached
      let quotationUpdated = null;
      if (invoice.quotationId) {
        const allInvoices = await tx.invoice.findMany({
          where: {
            quotationId: invoice.quotationId,
            status: { notIn: ['CANCELLED', 'VOID'] },
          },
        });

        const allPaid = allInvoices.every((inv) =>
          inv.id === invoice.id ? newInvoiceStatus === 'PAID' : inv.status === 'PAID'
        );
        const anyPaid = allInvoices.some((inv) =>
          inv.id === invoice.id ? newAmountPaid > 0 : Number(inv.amountPaid) > 0
        );

        const newBillingStatus = allPaid ? 'PAID' : anyPaid ? 'PARTIALLY_PAID' : 'PENDING';
        const quoteUpdateData = {
          billingStatus: newBillingStatus,
        };

        if (allPaid) {
          quoteUpdateData.status = 'PAID';
        }

        quotationUpdated = await tx.quotation.update({
          where: { id: invoice.quotationId },
          data: quoteUpdateData,
        });
      }

      return {
        success: true,
        payment,
        invoice: updatedInvoice,
        quotation: quotationUpdated,
        paymentAmount,
        newInvoiceStatus,
        newAmountPaid,
        newAmountDue,
        originalInvoice: invoice,
      };
    },
    { maxWait: 15000, timeout: 30000 }
  );

  // If replayed existing payment, return immediately
  if (result.isExisting) {
    return result;
  }

  const { payment, invoice, quotation, paymentAmount, newInvoiceStatus, newAmountPaid, newAmountDue, originalInvoice } = result;

  // Post-commit: Deal Health invalidation
  if (invoice.quotationId) {
    invalidateDealHealthCache(tenantId, invoice.quotationId).catch(() => {});
  }

  // Post-commit: Immutable Audit Trail
  logAudit({
    tenantId,
    userId: actorUserId,
    actorRole: 'FINANCE_OPERATIONS',
    action: 'PAYMENT_SUCCEEDED',
    entityType: 'PAYMENT',
    entityId: payment.id,
    description: `Payment of ₹${paymentAmount} settled via ${finalMethod} for invoice ${invoice.invoiceNumber}. Status: ${newInvoiceStatus}.`,
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      quotationId: invoice.quotationId,
      amount: paymentAmount,
      transactionReference: payment.transactionReference,
      newInvoiceStatus,
      newAmountPaid,
      newAmountDue,
      actorUserId,
    },
  }).catch(() => {});

  if (newInvoiceStatus === 'PAID') {
    logAudit({
      tenantId,
      userId: actorUserId,
      actorRole: 'FINANCE_OPERATIONS',
      action: 'INVOICE_PAID',
      entityType: 'INVOICE',
      entityId: invoice.id,
      description: `Invoice ${invoice.invoiceNumber} is fully settled and marked PAID.`,
      metadata: {
        totalAmount: Number(invoice.totalAmount),
        finalPaymentId: payment.id,
      },
    }).catch(() => {});
  }

  // Post-commit: Multi-party Event Notifications
  if (actorUserId) {
    createNotification({
      tenantId,
      recipientUserId: actorUserId,
      recipientRole: 'FINANCE_OPERATIONS',
      type: 'PAYMENT_RECORDED',
      title: 'Payment Recorded',
      message: `Payment of ₹${paymentAmount.toLocaleString('en-IN')} recorded for Invoice ${invoice.invoiceNumber}.`,
      entityType: 'INVOICE',
      entityId: invoice.id,
    }).catch(() => {});
  }

  if (originalInvoice.quotation?.salesRepId) {
    createNotification({
      tenantId,
      recipientUserId: originalInvoice.quotation.salesRepId,
      recipientRole: 'SALES_REP',
      type: newInvoiceStatus === 'PAID' ? 'DEAL_PAID' : 'PAYMENT_RECORDED',
      title: newInvoiceStatus === 'PAID' ? 'Deal Fully Settled' : 'Payment Received',
      message:
        newInvoiceStatus === 'PAID'
          ? `Invoice ${invoice.invoiceNumber} for deal ${originalInvoice.quotation.quoteNumber} has been fully paid.`
          : `Partial payment of ₹${paymentAmount.toLocaleString('en-IN')} recorded for invoice ${invoice.invoiceNumber}.`,
      entityType: 'QUOTATION',
      entityId: invoice.quotationId,
    }).catch(() => {});
  }

  if (originalInvoice.customerId) {
    createNotification({
      tenantId,
      recipientCustomerId: originalInvoice.customerId,
      recipientRole: 'CUSTOMER',
      type: 'PAYMENT_RECEIVED',
      title: 'Payment Received',
      message: `We received your payment of ₹${paymentAmount.toLocaleString('en-IN')} for Invoice ${invoice.invoiceNumber}.`,
      entityType: 'INVOICE',
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        transactionReference: payment.transactionReference,
      },
    }).catch(() => {});
  }

  return {
    success: true,
    payment,
    invoice,
    quotation,
  };
}

/**
 * Refund a payment (full or partial) and adjust invoice due balances.
 */
export async function refundPayment(options) {
  const { tenantId, paymentId, amount, reason = 'Customer refund', actorUserId, idempotencyKey } = options;

  if (!tenantId || !paymentId) {
    const err = new Error('Tenant ID and Payment ID are required to process a refund.');
    err.statusCode = 400;
    err.code = 'INVALID_ARGUMENTS';
    throw err;
  }

  return await prisma.$transaction(
    async (tx) => {
      // 1. Fetch payment with invoice
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, tenantId },
      include: {
        invoice: {
          include: { quotation: true },
        },
      },
    });

    if (!payment) {
      const err = new Error(`Payment with ID '${paymentId}' not found.`);
      err.statusCode = 404;
      err.code = 'PAYMENT_NOT_FOUND';
      throw err;
    }

    if (payment.status !== 'SUCCEEDED' && payment.status !== 'SUCCESS' && payment.status !== 'PARTIALLY_REFUNDED') {
      const err = new Error(`Cannot refund payment with status '${payment.status}'. Only successful payments can be refunded.`);
      err.statusCode = 400;
      err.code = 'PAYMENT_NOT_REFUNDABLE';
      throw err;
    }

    const originalAmount = Number(payment.amount);
    const existingRefunded = Number(payment.refundedAmount || 0);
    const availableForRefund = originalAmount - existingRefunded;

    const refundAmount = amount !== undefined && amount !== null ? Number(amount) : availableForRefund;

    if (isNaN(refundAmount) || refundAmount <= 0) {
      const err = new Error('Refund amount must be greater than 0.');
      err.statusCode = 400;
      err.code = 'INVALID_REFUND_AMOUNT';
      throw err;
    }

    if (refundAmount > availableForRefund + 0.01) {
      const err = new Error(
        `Requested refund (₹${refundAmount.toLocaleString('en-IN')}) exceeds available refundable balance (₹${availableForRefund.toLocaleString('en-IN')}).`
      );
      err.statusCode = 400;
      err.code = 'REFUND_EXCEEDS_PAYMENT';
      throw err;
    }

    // 2. Process via provider
    const providerRefund = await simulatedPaymentProvider.refundPayment({
      payment,
      amount: refundAmount,
      reason,
    });

    if (!providerRefund.success) {
      const err = new Error(providerRefund.failureReason || 'Refund processing failed');
      err.statusCode = 400;
      err.code = 'REFUND_FAILED';
      throw err;
    }

    // 3. Update Payment record
    const newRefundedAmount = existingRefunded + refundAmount;
    const isFullRefund = newRefundedAmount >= originalAmount - 0.01;
    const newPaymentStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: newRefundedAmount,
        status: newPaymentStatus,
      },
    });

    // 4. Update Invoice balances
    const invoice = payment.invoice;
    const newInvoiceAmountPaid = Math.max(0, Number(invoice.amountPaid) - refundAmount);
    const newInvoiceAmountDue = Math.min(Number(invoice.totalAmount), Number(invoice.amountDue) + refundAmount);
    const newInvoiceStatus = newInvoiceAmountPaid <= 0.01 ? 'ISSUED' : 'PARTIALLY_PAID';

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newInvoiceAmountPaid,
        amountDue: newInvoiceAmountDue,
        status: newInvoiceStatus,
      },
    });

    // 5. Update Quotation if attached
    let updatedQuotation = null;
    if (invoice.quotationId) {
      const allInvoices = await tx.invoice.findMany({
        where: {
          quotationId: invoice.quotationId,
          status: { notIn: ['CANCELLED', 'VOID'] },
        },
      });

      const allPaid = allInvoices.every((inv) =>
        inv.id === invoice.id ? newInvoiceStatus === 'PAID' : inv.status === 'PAID'
      );
      const anyPaid = allInvoices.some((inv) =>
        inv.id === invoice.id ? newInvoiceAmountPaid > 0 : Number(inv.amountPaid) > 0
      );

      const newBillingStatus = allPaid ? 'PAID' : anyPaid ? 'PARTIALLY_PAID' : 'PENDING';
      const quoteUpdateData = {
        billingStatus: newBillingStatus,
      };

      if (!allPaid && invoice.quotation?.status === 'PAID') {
        quoteUpdateData.status = 'INVOICED';
      }

      updatedQuotation = await tx.quotation.update({
        where: { id: invoice.quotationId },
        data: quoteUpdateData,
      });

      await invalidateDealHealthCache(tenantId, invoice.quotationId);
    }

    // 6. Audit log
    await logAudit({
      tenantId,
      userId: actorUserId,
      actorRole: 'FINANCE_OPERATIONS',
      action: isFullRefund ? 'PAYMENT_REFUNDED' : 'PAYMENT_PARTIALLY_REFUNDED',
      entityType: 'PAYMENT',
      entityId: payment.id,
      description: `Refunded ₹${refundAmount} on payment ${payment.transactionReference}. New status: ${newPaymentStatus}.`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        refundReference: providerRefund.refundReference,
        refundAmount,
        newRefundedAmount,
        newInvoiceStatus,
        reason,
      },
    });

    // 7. Notifications
    if (actorUserId) {
      await createNotification({
        tenantId,
        recipientUserId: actorUserId,
        recipientRole: 'FINANCE_OPERATIONS',
        type: 'PAYMENT_REFUNDED',
        title: 'Payment Refunded',
        message: `Refund of ₹${refundAmount.toLocaleString('en-IN')} processed for Invoice ${invoice.invoiceNumber}.`,
        entityType: 'INVOICE',
        entityId: invoice.id,
      }).catch(() => {});
    }

      return {
        success: true,
        payment: updatedPayment,
        invoice: updatedInvoice,
        quotation: updatedQuotation,
        refundReference: providerRefund.refundReference,
        refundAmount,
      };
    },
    { maxWait: 15000, timeout: 30000 }
  );
}

/**
 * List payments for a tenant with filtering and pagination.
 */
export async function listPayments(options) {
  const {
    tenantId,
    invoiceId,
    customerId,
    status,
    paymentMethod,
    page = 1,
    limit = 20,
    startDate,
    endDate,
  } = options;

  if (!tenantId) {
    const err = new Error('Tenant ID is required to list payments.');
    err.statusCode = 400;
    err.code = 'TENANT_REQUIRED';
    throw err;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const where = { tenantId };

  if (invoiceId) where.invoiceId = invoiceId;
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;
  if (paymentMethod) where.paymentMethod = paymentMethod.toUpperCase();

  if (startDate || endDate) {
    where.paidAt = {};
    if (startDate) where.paidAt.gte = new Date(startDate);
    if (endDate) where.paidAt.lte = new Date(endDate);
  }

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { paidAt: 'desc' },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceType: true,
            totalAmount: true,
            amountPaid: true,
            amountDue: true,
            status: true,
            quotationId: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            companyName: true,
          },
        },
      },
    }),
  ]);

  return {
    data: payments,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  };
}

/**
 * Get payment by ID with tenant isolation.
 */
export async function getPaymentById(tenantId, paymentId) {
  if (!tenantId || !paymentId) {
    const err = new Error('Tenant ID and Payment ID are required.');
    err.statusCode = 400;
    err.code = 'INVALID_ARGUMENTS';
    throw err;
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId },
    include: {
      invoice: {
        include: {
          customer: true,
          quotation: {
            select: { id: true, quoteNumber: true, status: true },
          },
        },
      },
      customer: true,
    },
  });

  if (!payment) {
    const err = new Error(`Payment with ID '${paymentId}' not found.`);
    err.statusCode = 404;
    err.code = 'PAYMENT_NOT_FOUND';
    throw err;
  }

  return payment;
}

/**
 * Get payment summary for an invoice.
 */
export async function getInvoicePaymentSummary(tenantId, invoiceId) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      payments: {
        orderBy: { paidAt: 'desc' },
      },
      customer: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!invoice) {
    const err = new Error(`Invoice with ID '${invoiceId}' not found.`);
    err.statusCode = 404;
    err.code = 'INVOICE_NOT_FOUND';
    throw err;
  }

  const payments = invoice.payments || [];
  const successfulPayments = payments.filter((p) => p.status === 'SUCCEEDED' || p.status === 'SUCCESS');
  const totalPaid = successfulPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalRefunded = successfulPayments.reduce((sum, p) => sum + Number(p.refundedAmount || 0), 0);
  const netPaid = totalPaid - totalRefunded;

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    totalAmount: Number(invoice.totalAmount),
    amountPaid: Number(invoice.amountPaid),
    amountDue: Number(invoice.amountDue),
    paymentsCount: payments.length,
    successfulPaymentsCount: successfulPayments.length,
    totalPaid,
    totalRefunded,
    netPaid,
    payments,
  };
}

/**
 * Backwards-compatible alias for existing modules and tests.
 */
export async function simulateInvoicePayment(tenantId, invoiceId, paymentData = {}, actorUserId = null) {
  if (typeof tenantId === 'object' && tenantId !== null) {
    const opts = tenantId;
    return await recordPayment({
      tenantId: opts.tenantId,
      invoiceId: opts.invoiceId,
      amount: opts.amount,
      paymentMethod: opts.paymentMethod || opts.method,
      transactionReference: opts.transactionReference || opts.referenceNumber,
      idempotencyKey: opts.idempotencyKey,
      notes: opts.notes,
      actorUserId: opts.actorUserId || opts.userId || opts.recordedBy,
    });
  }

  return await recordPayment({
    tenantId,
    invoiceId,
    amount: paymentData.amount,
    paymentMethod: paymentData.paymentMethod || paymentData.method,
    transactionReference: paymentData.transactionReference || paymentData.transactionRef || paymentData.referenceNumber,
    idempotencyKey: paymentData.idempotencyKey,
    notes: paymentData.notes,
    actorUserId,
  });
}
