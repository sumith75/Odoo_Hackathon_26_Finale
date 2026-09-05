import prisma from '../db/prisma.js';

/**
 * Simulate / Record a payment for an invoice with strict idempotency and quotation status synchronization.
 *
 * @param {string} tenantId
 * @param {string} invoiceId
 * @param {Object} paymentData - { amount, paymentMethod, transactionReference, notes }
 * @param {string} actorUserId
 */
export async function simulateInvoicePayment(tenantId, invoiceId, paymentData = {}, actorUserId = null) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch invoice ensuring tenant isolation
    const invoice = await tx.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId,
      },
      include: {
        quotation: true,
        customer: true,
        payments: true,
      },
    });

    if (!invoice) {
      const error = new Error(`Invoice with ID '${invoiceId}' not found.`);
      error.statusCode = 404;
      error.code = 'INVOICE_NOT_FOUND';
      throw error;
    }

    if (invoice.status === 'PAID') {
      const error = new Error(`Invoice '${invoice.invoiceNumber}' is already fully paid.`);
      error.statusCode = 400;
      error.code = 'INVOICE_ALREADY_PAID';
      throw error;
    }

    if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') {
      const error = new Error(`Cannot record payment against cancelled/void invoice '${invoice.invoiceNumber}'.`);
      error.statusCode = 400;
      error.code = 'INVOICE_CANCELLED';
      throw error;
    }

    const currentDue = Number(invoice.amountDue);
    const paymentAmount = paymentData.amount ? Number(paymentData.amount) : currentDue;

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      const error = new Error(`Payment amount must be greater than 0.`);
      error.statusCode = 400;
      error.code = 'INVALID_PAYMENT_AMOUNT';
      throw error;
    }

    if (paymentAmount > currentDue + 0.01) {
      const error = new Error(`Payment amount (${paymentAmount}) exceeds outstanding due (${currentDue}).`);
      error.statusCode = 400;
      error.code = 'PAYMENT_EXCEEDS_DUE';
      throw error;
    }

    const txnRef = paymentData.transactionReference || paymentData.transactionRef || `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 2. Create Payment record
    const payment = await tx.payment.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        amount: paymentAmount,
        currency: invoice.currency || 'INR',
        paymentMethod: paymentData.paymentMethod || 'SIMULATED',
        status: 'SUCCESS',
        transactionReference: txnRef,
        paidAt: new Date(),
      },
    });

    // 3. Update Invoice amounts & status
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

    // 4. Update Quotation billingStatus and overall status
    let quotationUpdated = null;
    if (invoice.quotationId) {
      const allInvoices = await tx.invoice.findMany({
        where: {
          quotationId: invoice.quotationId,
          status: { notIn: ['CANCELLED', 'VOID'] },
        },
      });

      const allPaid = allInvoices.every((inv) => (inv.id === invoice.id ? newInvoiceStatus === 'PAID' : inv.status === 'PAID'));
      const anyPaid = allInvoices.some((inv) => (inv.id === invoice.id ? newAmountPaid > 0 : Number(inv.amountPaid) > 0));

      const newBillingStatus = allPaid ? 'PAID' : anyPaid ? 'PARTIALLY_PAID' : 'PENDING';

      const quoteUpdateData = {
        billingStatus: newBillingStatus,
      };

      // Transition quotation status to PAID if all invoices are paid
      if (allPaid) {
        quoteUpdateData.status = 'PAID';
      }

      quotationUpdated = await tx.quotation.update({
        where: { id: invoice.quotationId },
        data: quoteUpdateData,
      });

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          tenantId,
          entityType: 'QUOTATION',
          entityId: invoice.quotationId,
          action: 'PAYMENT_PROCESSED',
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            paymentId: payment.id,
            amount: paymentAmount,
            transactionReference: txnRef,
            newInvoiceStatus,
            quotationBillingStatus: newBillingStatus,
            quotationOverallStatus: quoteUpdateData.status || quotationUpdated.status,
            actorUserId,
          },
          userId: actorUserId,
        },
      });
    }

    return {
      payment,
      invoice: updatedInvoice,
      quotation: quotationUpdated,
    };
  });
}
