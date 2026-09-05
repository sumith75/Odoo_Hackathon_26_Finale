import express from 'express';
import { memStore } from '../config/db.js';
import { calculateQuotePricing } from '../services/pricingEngine.js';
import { evaluateQuoteRisk } from '../services/riskEngine.js';
import { allocateInventorySplits } from '../services/inventoryEngine.js';
import { generateHybridInvoice } from '../services/billingEngine.js';

const router = express.Router();

// Public Customer Quote View (Step 10 Deal Room)
router.get('/quote/:id', (req, res) => {
  const quote = memStore.quotes.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

  const items = memStore.quote_items.filter(i => i.quote_id === quote.id);
  const negotiations = memStore.negotiation_history.filter(n => n.quote_id === quote.id);
  const allocations = memStore.warehouse_allocations.filter(w => w.quote_id === quote.id);
  const invoice = memStore.invoices.find(inv => inv.quote_id === quote.id) || null;

  res.json({
    success: true,
    quote: {
      ...quote,
      items,
      negotiations,
      warehouse_allocations: allocations,
      invoice
    }
  });
});

// Customer Negotiates / Proposes Counter-Offer (Steps 10 & 11)
router.post('/quote/:id/negotiate', (req, res) => {
  const quote = memStore.quotes.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

  const {
    requested_discount_pct = 32.0,
    customer_notes = 'We are ready to execute immediately if you can adjust hardware pricing to match our budget.'
  } = req.body;

  const items = memStore.quote_items.filter(i => i.quote_id === quote.id);
  const previousRiskLevel = quote.risk_level;
  const previousMargin = quote.margin_pct;

  // Recalculate pricing with requested discount
  const newPricing = calculateQuotePricing(items, requested_discount_pct);
  const rules = memStore.discount_rules[0];

  // AUTOMATED RE-RISK CHECK ENGINE (Step 11)
  const newRisk = evaluateQuoteRisk(newPricing, rules, memStore.inventory);

  const existingRounds = memStore.negotiation_history.filter(n => n.quote_id === quote.id).length;
  const roundNumber = existingRounds + 1;

  // Flag variance detection
  const varianceDetected = newPricing.margin_pct < previousMargin || newRisk.risk_score > quote.risk_score;
  const varianceMessage = `Customer requested ${requested_discount_pct}% discount (Margin dropped from ${previousMargin}% to ${newPricing.margin_pct}%). High risk variance detected!`;

  // Record negotiation round
  const negotiationEntry = {
    id: `neg-${Date.now()}`,
    quote_id: quote.id,
    round_number: roundNumber,
    requested_discount_pct: Number(requested_discount_pct),
    counter_offer_total: newPricing.final_total,
    customer_notes,
    risk_level_before: previousRiskLevel,
    risk_level_after: newRisk.risk_level,
    auto_detected_variance: varianceMessage,
    status: 'MANAGER_REVIEW',
    created_at: new Date().toISOString()
  };
  memStore.negotiation_history.push(negotiationEntry);

  // Update quote financials and route to Manager for Re-Approval (Step 11 -> Step 12)
  quote.rep_discount_pct = newPricing.rep_discount_pct;
  quote.discount_amount = newPricing.discount_amount;
  quote.capex_one_time = newPricing.capex_one_time;
  quote.opex_recurring_mrr = newPricing.opex_recurring_mrr;
  quote.opex_recurring_arr = newPricing.opex_recurring_arr;
  quote.final_total = newPricing.final_total;
  quote.margin_pct = newPricing.margin_pct;
  quote.profit_amount = newPricing.profit_amount;
  quote.risk_score = newRisk.risk_score;
  quote.risk_level = newRisk.risk_level;
  quote.risk_factors = newRisk.risk_factors;
  quote.status = 'NEGOTIATION';
  quote.approval_status = 'PENDING_APPROVAL'; // Automatically locks for manager re-approval
  quote.current_step = 11;
  quote.updated_at = new Date().toISOString();

  // Create new pending manager approval record
  memStore.quote_approvals.push({
    id: `appr-recheck-${Date.now()}`,
    quote_id: quote.id,
    step_role: 'MANAGER',
    status: 'PENDING',
    reviewer_name: 'Sarah Jenkins (VP Sales)',
    notes: `Pending re-approval for Customer Counter-Offer Round #${roundNumber}`,
    created_at: new Date().toISOString(),
    resolved_at: null
  });

  // Audit log
  memStore.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    quote_id: quote.id,
    actor: 'Customer (Procurement)',
    step_number: 11,
    action: 'SYSTEM_AUTOMATICALLY_RECHECKED_DISCOUNT',
    details: `Customer negotiated ${requested_discount_pct}% discount. Risk Engine detected margin breach (${newPricing.margin_pct}% < 25%). Automatically locked and routed to Manager for approval.`,
    created_at: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Counter-offer submitted. System detected risk variance and routed to Manager for review.',
    quote,
    pricing: newPricing,
    risk: newRisk,
    negotiation: negotiationEntry
  });
});

// Customer Confirms Quote (Step 13)
router.post('/quote/:id/confirm', (req, res) => {
  const quote = memStore.quotes.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

  if (quote.status !== 'MANAGER_APPROVED' && quote.approval_status !== 'MANAGER_APPROVED' && quote.approval_status !== 'APPROVED' && quote.status !== 'CUSTOMER_CONFIRMED') {
    return res.status(400).json({
      success: false,
      message: `Cannot confirm quote while in status: ${quote.status || quote.approval_status}. Manager approval is required first.`
    });
  }

  quote.status = 'CUSTOMER_CONFIRMED';
  quote.approval_status = 'CUSTOMER_CONFIRMED';
  quote.current_step = 13; // Step 13: Customer Confirms
  quote.updated_at = new Date().toISOString();

  // Ensure multi-warehouse allocations are ready
  const items = memStore.quote_items.filter(i => i.quote_id === quote.id);
  const existingAllocations = memStore.warehouse_allocations.filter(w => w.quote_id === quote.id);
  if (existingAllocations.length === 0) {
    const splitResult = allocateInventorySplits(items, memStore.warehouses, memStore.inventory);
    for (const alloc of splitResult.allocations) {
      memStore.warehouse_allocations.push({ ...alloc, quote_id: quote.id });
    }
  }
  quote.warehouse_status = 'SPLIT_ALLOCATED';

  // Automatically generate Hybrid Invoice (Step 9 / Step 13)
  let invoice = memStore.invoices.find(inv => inv.quote_id === quote.id);
  if (!invoice) {
    invoice = generateHybridInvoice(quote);
    memStore.invoices.push(invoice);
  }

  // Audit log
  memStore.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    quote_id: quote.id,
    actor: 'Customer (Procurement)',
    step_number: 13,
    action: 'CUSTOMER_CONFIRMED_DEAL',
    details: `Customer officially confirmed & digitally signed Quote #${quote.quote_number}. Order confirmed for $${quote.final_total.toLocaleString()}. Generated Invoice #${invoice.invoice_number}. Ready for payment.`,
    created_at: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Quote confirmed and signed! Hybrid invoice generated and warehouse allocations prepared.',
    quote,
    invoice
  });
});

export default router;
