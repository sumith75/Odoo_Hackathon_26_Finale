import React from 'react';
import CPQStudio from './sales/CPQStudio';

/**
 * SalesRepCPQView — Database-backed CPQ Engine
 * Replaces legacy static mock items with live PostgreSQL catalog and customer data
 */
export default function SalesRepCPQView({ onQuoteCreated, prefillExcessiveDiscount = false }) {
  return (
    <div className="space-y-6">
      <CPQStudio
        onSaved={onQuoteCreated}
        onSubmitted={onQuoteCreated}
        onCancel={() => {}}
      />
    </div>
  );
}
