import React from 'react';
import ApprovalInbox from './manager/ApprovalInbox';

/**
 * ApprovalInboxView — Database-backed Manager Approval Inbox
 * Replaces legacy static mock items with live PostgreSQL approval requests
 */
export default function ApprovalInboxView({ onApproved }) {
  return (
    <div className="space-y-6">
      <ApprovalInbox onSelectQuote={onApproved} />
    </div>
  );
}
