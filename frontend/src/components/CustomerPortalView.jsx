import React from 'react';
import CustomerDealRoom from './customer/CustomerDealRoom';

/**
 * CustomerPortalView — Database-backed Customer Deal Room
 * Replaces legacy static mock data with live PostgreSQL deal negotiation and counter-offer workflows
 */
export default function CustomerPortalView({ quoteId, onQuoteConfirmed, onCounterOfferSubmitted }) {
  return (
    <div className="space-y-6">
      <CustomerDealRoom
        quoteId={quoteId}
        onConfirmed={onQuoteConfirmed}
        onCounterSubmitted={onCounterOfferSubmitted}
      />
    </div>
  );
}
