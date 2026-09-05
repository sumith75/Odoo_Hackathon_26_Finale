/**
 * PaymentProvider.js — Abstract Payment Provider Interface
 *
 * Defines the contract that all payment gateways/providers must implement
 * (e.g. SimulatedPaymentProvider, StripePaymentProvider, RazorpayPaymentProvider).
 */

export class PaymentProvider {
  /**
   * Process an inbound payment.
   *
   * @param {Object} params
   * @param {number} params.amount - Payment amount in base units (e.g. INR)
   * @param {string} params.currency - ISO currency code (e.g. 'INR')
   * @param {string} params.method - Payment method (e.g. 'SIMULATED', 'CARD', 'UPI', 'BANK_TRANSFER', 'CASH')
   * @param {string} [params.transactionReference] - Optional client or system reference
   * @param {string} [params.idempotencyKey] - Unique key to prevent double charging
   * @param {Object} [params.customer] - Customer details { id, name, email }
   * @param {Object} [params.invoice] - Invoice details { id, invoiceNumber, totalAmount, amountDue }
   * @param {string} [params.notes] - Payment memo or description
   * @param {Object} [params.options] - Provider-specific flags (e.g. simulateFailure)
   * @returns {Promise<{
   *   success: boolean,
   *   status: 'SUCCEEDED' | 'FAILED' | 'PENDING',
   *   transactionReference: string,
   *   amount: number,
   *   currency: string,
   *   method: string,
   *   provider: string,
   *   failureReason?: string,
   *   rawResponse?: any
   * }>}
   */
  async processPayment(params) {
    throw new Error('processPayment() must be implemented by payment provider subclass');
  }

  /**
   * Refund an existing payment.
   *
   * @param {Object} params
   * @param {Object} params.payment - Original payment record
   * @param {number} params.amount - Refund amount
   * @param {string} [params.reason] - Refund reason
   * @returns {Promise<{
   *   success: boolean,
   *   status: 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'FAILED',
   *   refundReference: string,
   *   amount: number,
   *   currency: string,
   *   rawResponse?: any
   * }>}
   */
  async refundPayment(params) {
    throw new Error('refundPayment() must be implemented by payment provider subclass');
  }

  /**
   * Query payment status from the provider.
   *
   * @param {string} transactionReference
   * @returns {Promise<{ status: string, details?: any }>}
   */
  async getPaymentStatus(transactionReference) {
    throw new Error('getPaymentStatus() must be implemented by payment provider subclass');
  }
}

export default PaymentProvider;
