import express from 'express';
import { memStore } from '../config/db.js';

const router = express.Router();

// Get all quotes pending approval (Manager or Finance queue)
router.get('/pending', (req, res) => {
  const pendingQuotes = memStore.quotes
    .filter(q => q.status === 'PENDING_APPROVAL' || q.approval_status === 'PENDING_APPROVAL' || q.approval_status === 'PENDING_MANAGER' || q.approval_status === 'PENDING_FINANCE')
    .map(q => {
      const items = memStore.quote_items.filter(i => i.quote_id === q.id);
      const approvalRecord = memStore.quote_approvals.find(a => a.quote_id === q.id && a.status === 'PENDING');
      const latestNegotiation = memStore.negotiation_history
        .filter(n => n.quote_id === q.id)
        .sort((a, b) => b.round_number - a.round_number)[0] || null;

      return {
        ...q,
        items,
        pending_role: q.approval_status === 'PENDING_MANAGER' ? 'MANAGER' : 'FINANCE',
        approval_id: approvalRecord?.id,
        latest_negotiation: latestNegotiation
      };
    });

  res.json({ success: true, pending_approvals: pendingQuotes });
});

// Manager or Finance approves quote (Steps 6 & 12)
router.post('/:id/approve', (req, res) => {
  const quote = memStore.quotes.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

  const {
    reviewer_role = 'MANAGER',
    reviewer_name = 'Sarah Jenkins (VP Sales)',
    notes = 'Approved for strategic enterprise account expansion.'
  } = req.body;

  // Check if this was during negotiation re-check (Step 12) or initial sales quote (Step 6)
  const isNegotiationApproval = quote.current_step >= 10;
  const targetStep = isNegotiationApproval ? 12 : 6;

  // Mark pending approval record as approved
  const approvalRecord = memStore.quote_approvals.find(a => a.quote_id === quote.id && a.status === 'PENDING');
  if (approvalRecord) {
    approvalRecord.status = 'APPROVED';
    approvalRecord.reviewer_name = reviewer_name;
    approvalRecord.notes = notes;
    approvalRecord.resolved_at = new Date().toISOString();
  }

  // Dual tier check: If high contract value and Manager just approved, does it need Finance?
  if (quote.approval_status === 'PENDING_MANAGER' && quote.requires_finance && reviewer_role === 'MANAGER') {
    quote.approval_status = 'PENDING_FINANCE';
    quote.manager_note = notes;
    memStore.quote_approvals.push({
      id: `appr-fin-${Date.now()}`,
      quote_id: quote.id,
      step_role: 'FINANCE',
      status: 'PENDING',
      reviewer_name: 'David Sterling (CFO / Finance Controller)',
      notes: null,
      created_at: new Date().toISOString(),
      resolved_at: null
    });

    memStore.audit_logs.unshift({
      id: `audit-${Date.now()}`,
      quote_id: quote.id,
      actor: reviewer_name,
      step_number: targetStep,
      action: 'MANAGER_APPROVED_ROUTED_TO_FINANCE',
      details: `Manager approved deal. High value requires Finance Controller sign-off. Note: "${notes}"`,
      created_at: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: 'Manager approved. Deal routed to Finance Controller queue.',
      quote
    });
  }

  // Complete final approval
  quote.status = 'MANAGER_APPROVED';
  quote.approval_status = 'MANAGER_APPROVED';
  if (reviewer_role === 'FINANCE') {
    quote.finance_note = notes;
    quote.status = 'FINANCE_APPROVED';
    quote.approval_status = 'FINANCE_APPROVED';
  } else {
    quote.manager_note = notes;
  }
  quote.current_step = targetStep;
  quote.updated_at = new Date().toISOString();

  // If this was negotiation approval, also mark negotiation record accepted
  const latestNegotiation = memStore.negotiation_history
    .filter(n => n.quote_id === quote.id && n.status === 'MANAGER_REVIEW')
    .sort((a, b) => b.round_number - a.round_number)[0];
  if (latestNegotiation) {
    latestNegotiation.status = 'ACCEPTED';
  }

  memStore.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    quote_id: quote.id,
    actor: reviewer_name,
    step_number: targetStep,
    action: isNegotiationApproval ? 'MANAGER_APPROVED_COUNTER_OFFER' : 'MANAGER_APPROVED_INITIAL_QUOTE',
    details: `${reviewer_name} (${reviewer_role}) APPROVED quote ${quote.quote_number}. Note: "${notes}". Status -> APPROVED.`,
    created_at: new Date().toISOString()
  });

  res.json({
    success: true,
    message: isNegotiationApproval
      ? 'Counter-offer approved by Manager. Customer can now confirm and execute.'
      : 'Quote approved by Manager. Ready for Upsell Recommendations & Fulfillment.',
    quote
  });
});

// Reject quote
router.post('/:id/reject', (req, res) => {
  const quote = memStore.quotes.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

  const { reviewer_name = 'Manager', notes = 'Discount exceeds margin tolerance. Revise pricing.' } = req.body;
  quote.approval_status = 'REJECTED';
  quote.manager_note = notes;
  quote.updated_at = new Date().toISOString();

  memStore.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    quote_id: quote.id,
    actor: reviewer_name,
    step_number: quote.current_step,
    action: 'QUOTE_REJECTED',
    details: `Quote rejected by ${reviewer_name}. Reason: "${notes}". Returned to Sales Rep.`,
    created_at: new Date().toISOString()
  });

  res.json({ success: true, message: 'Quote rejected.', quote });
});

export default router;
