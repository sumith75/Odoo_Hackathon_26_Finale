import React from 'react';
import FulfillmentView from './finance/FulfillmentView';

/**
 * WarehouseFulfillmentView — Database-backed Warehouse Allocations
 * Replaces legacy static mock items with live PostgreSQL warehouse fulfillment allocations
 */
export default function WarehouseFulfillmentView({ quoteId }) {
  return (
    <div className="space-y-6">
      <FulfillmentView onSelectFulfillment={() => {}} />
    </div>
  );
}
