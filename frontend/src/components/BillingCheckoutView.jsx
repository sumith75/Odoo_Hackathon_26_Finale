import React from 'react';
import InvoicesView from './finance/InvoicesView';

/**
 * BillingCheckoutView — Database-backed Billing & Invoice Settlement
 * Replaces legacy static mock items with live PostgreSQL invoices & payments
 */
export default function BillingCheckoutView({ quoteId, onPaymentCompleted }) {
  return (
    <div className="space-y-6">
      <InvoicesView onSelectInvoice={onPaymentCompleted} />
    </div>
  );
}
