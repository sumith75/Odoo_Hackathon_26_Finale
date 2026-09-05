/**
 * paymentRoutes.js — Dedicated Payment & Billing Settlement API
 *
 * Exposes authoritative endpoints:
 * - POST /api/invoices/:invoiceId/payments
 * - GET  /api/invoices/:invoiceId/payments
 * - GET  /api/payments/:paymentId
 * - POST /api/payments/:paymentId/refund
 * - GET  /api/payments
 */

import express from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { resolveTenant } from '../../middleware/tenant.js';
import {
  recordPayment,
  refundPayment,
  listPayments,
  getPaymentById,
  getInvoicePaymentSummary,
} from '../../services/paymentService.js';

const router = express.Router();

// All payment endpoints require authentication and tenant resolution
router.use(authenticateUser);
router.use(resolveTenant);

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/payments — Global Tenant Payment Registry (Paginated & Filtered)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireRole('FINANCE_OPERATIONS', 'ADMIN'), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      page,
      limit,
      invoiceId,
      customerId,
      status,
      paymentMethod,
      startDate,
      endDate,
    } = req.query;

    const result = await listPayments({
      tenantId,
      page,
      limit,
      invoiceId,
      customerId,
      status,
      paymentMethod,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('[PAYMENT_LIST_ERROR]:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'PAYMENT_LIST_ERROR',
        message: error.message,
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/payments/:paymentId — Single Payment Dossier
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/:paymentId',
  requireRole('FINANCE_OPERATIONS', 'ADMIN', 'SALES_MANAGER', 'SALES_REP'),
  async (req, res) => {
    try {
      const { paymentId } = req.params;
      const tenantId = req.tenantId;

      const payment = await getPaymentById(tenantId, paymentId);

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error('[PAYMENT_FETCH_ERROR]:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'PAYMENT_FETCH_ERROR',
          message: error.message,
        },
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/payments/:paymentId/refund — Process Refund
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:paymentId/refund',
  requireRole('FINANCE_OPERATIONS', 'ADMIN'),
  async (req, res) => {
    try {
      const { paymentId } = req.params;
      const tenantId = req.tenantId;
      const actorUserId = req.user.id;
      const { amount, reason, idempotencyKey } = req.body || {};

      const result = await refundPayment({
        tenantId,
        paymentId,
        amount,
        reason,
        actorUserId,
        idempotencyKey,
      });

      res.json({
        success: true,
        data: result,
        message: `Refund of ₹${result.refundAmount.toLocaleString('en-IN')} processed successfully.`,
      });
    } catch (error) {
      console.error('[PAYMENT_REFUND_ERROR]:', error);
      res.status(error.statusCode || 400).json({
        success: false,
        error: {
          code: error.code || 'REFUND_ERROR',
          message: error.message,
        },
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Invoices Router (for /api/invoices/:invoiceId/payments)
// ─────────────────────────────────────────────────────────────────────────────
export const invoicePaymentsRouter = express.Router();
invoicePaymentsRouter.use(authenticateUser);
invoicePaymentsRouter.use(resolveTenant);

// POST /api/invoices/:invoiceId/payments — Record Payment
invoicePaymentsRouter.post(
  '/:invoiceId/payments',
  requireRole('FINANCE_OPERATIONS', 'ADMIN'),
  async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const tenantId = req.tenantId;
      const actorUserId = req.user.id;
      const {
        amount,
        currency,
        method,
        paymentMethod,
        notes,
        idempotencyKey,
        transactionReference,
        simulateFailure,
      } = req.body || {};

      const result = await recordPayment({
        tenantId,
        invoiceId,
        amount,
        currency,
        method: method || paymentMethod,
        notes,
        idempotencyKey,
        transactionReference,
        actorUserId,
        simulateFailure,
      });

      res.status(result.isExisting ? 200 : 201).json({
        success: true,
        data: result,
        message: result.isExisting
          ? result.message
          : `Payment of ₹${Number(result.payment.amount).toLocaleString('en-IN')} settled. Invoice status: ${result.invoice.status}.`,
      });
    } catch (error) {
      console.error('[RECORD_PAYMENT_ERROR]:', error);
      res.status(error.statusCode || 400).json({
        success: false,
        error: {
          code: error.code || 'PAYMENT_RECORDING_ERROR',
          message: error.message,
        },
      });
    }
  }
);

// GET /api/invoices/:invoiceId/payments — List payments for invoice
invoicePaymentsRouter.get(
  '/:invoiceId/payments',
  requireRole('FINANCE_OPERATIONS', 'ADMIN', 'SALES_MANAGER', 'SALES_REP'),
  async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const tenantId = req.tenantId;

      const summary = await getInvoicePaymentSummary(tenantId, invoiceId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('[INVOICE_PAYMENTS_ERROR]:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INVOICE_PAYMENTS_ERROR',
          message: error.message,
        },
      });
    }
  }
);

export default router;
