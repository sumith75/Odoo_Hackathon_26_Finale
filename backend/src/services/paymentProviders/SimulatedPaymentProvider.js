/**
 * SimulatedPaymentProvider.js — Deterministic In-Memory & Database Payment Provider
 *
 * Simulates commercial payment gateway behavior (settlement, authorization,
 * refunds, failures) for hackathon verification without external dependencies.
 */

import PaymentProvider from './PaymentProvider.js';

const VALID_METHODS = ['SIMULATED', 'CARD', 'UPI', 'BANK_TRANSFER', 'CASH'];

export class SimulatedPaymentProvider extends PaymentProvider {
  constructor() {
    super();
    this.name = 'SIMULATED';
  }

  /**
   * Process a simulated payment.
   */
  async processPayment(params) {
    const {
      amount,
      currency = 'INR',
      method = 'SIMULATED',
      transactionReference,
      notes = '',
      options = {},
    } = params;

    const normalizedMethod = String(method || 'SIMULATED').toUpperCase();

    // Check if intentional simulation failure requested
    if (
      options.simulateFailure ||
      normalizedMethod === 'FAIL' ||
      (typeof notes === 'string' && notes.includes('TRIGGER_SIMULATED_FAILURE'))
    ) {
      return {
        success: false,
        status: 'FAILED',
        transactionReference: transactionReference || this.generateTransactionReference('FAIL'),
        amount: Number(amount),
        currency,
        method: normalizedMethod,
        provider: this.name,
        failureReason: 'SIMULATED_GATEWAY_DECLINE: Issuer declined simulated transaction',
        paidAt: null,
      };
    }

    // Validate method
    if (!VALID_METHODS.includes(normalizedMethod)) {
      return {
        success: false,
        status: 'FAILED',
        transactionReference: transactionReference || this.generateTransactionReference('INV'),
        amount: Number(amount),
        currency,
        method: normalizedMethod,
        provider: this.name,
        failureReason: `UNSUPPORTED_PAYMENT_METHOD: '${method}' is not recognized. Valid: ${VALID_METHODS.join(', ')}`,
        paidAt: null,
      };
    }

    const finalTxnRef = transactionReference || this.generateTransactionReference('PAY');

    return {
      success: true,
      status: 'SUCCEEDED',
      transactionReference: finalTxnRef,
      amount: Number(amount),
      currency,
      method: normalizedMethod,
      provider: this.name,
      paidAt: new Date(),
    };
  }

  /**
   * Process a simulated refund.
   */
  async refundPayment(params) {
    const { payment, amount, reason = 'Customer refund' } = params;

    const refundAmount = Number(amount);
    const originalAmount = Number(payment.amount);
    const previousRefunds = Number(payment.refundedAmount || 0);
    const availableForRefund = originalAmount - previousRefunds;

    if (refundAmount > availableForRefund + 0.01) {
      return {
        success: false,
        status: 'FAILED',
        refundReference: null,
        amount: refundAmount,
        currency: payment.currency || 'INR',
        failureReason: `REFUND_EXCEEDS_PAYMENT: Requested ₹${refundAmount} exceeds available refundable balance of ₹${availableForRefund}.`,
      };
    }

    const refundRef = this.generateTransactionReference('REF');
    const newTotalRefunded = previousRefunds + refundAmount;
    const isFullRefund = newTotalRefunded >= originalAmount - 0.01;

    return {
      success: true,
      status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      refundReference: refundRef,
      amount: refundAmount,
      totalRefunded: newTotalRefunded,
      currency: payment.currency || 'INR',
      reason,
      refundedAt: new Date(),
    };
  }

  /**
   * Query status of a transaction.
   */
  async getPaymentStatus(transactionReference) {
    return {
      status: 'SUCCEEDED',
      transactionReference,
      provider: this.name,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a readable reference like: PAY-DF360-2026-A1B2C3
   */
  generateTransactionReference(prefix = 'PAY') {
    const year = new Date().getFullYear();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-DF360-${year}-${randomSuffix}`;
  }
}

export default new SimulatedPaymentProvider();
