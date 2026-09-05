import express from 'express';
import { memStore } from '../config/db.js';
import { allocateInventorySplits } from '../services/inventoryEngine.js';
import { generateHybridInvoice, processSimulatedPayment } from '../services/billingEngine.js';

const router = express.Router();

// Step 8: Trigger & view automatic warehouse split allocation
router.post('/quote/:id/split-warehouses', (req, res) => {
  const quote = memStore.quotes.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

  const items = memStore.quote_items.filter(i => i.quote_id === quote.id);
  const splitResult = allocateInventorySplits(items, memStore.warehouses, memStore.inventory);

  // Replace or set allocations
  memStore.warehouse_allocations = memStore.warehouse_allocations.filter(w => w.quote_id !== quote.id);
  for (const alloc of splitResult.allocations) {
    memStore.warehouse_allocations.push({
      ...alloc,
      quote_id: quote.id
    });
  }

  quote.warehouse_status = 'SPLIT_ALLOCATED';
  quote.current_step = Math.max(quote.current_step, 8); // Step 8

  memStore.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    quote_id: quote.id,
    actor: 'System (Inventory Engine)',
    step_number: 8,
    action: 'WAREHOUSE_AUTOMATICALLY_SPLIT_STOCK',
    details: `Stock automatically split across ${splitResult.warehouse_count} hubs: ${splitResult.allocations.filter(a => a.fulfillment_type === 'PHYSICAL').map(a => `${a.warehouse_name} (${a.allocated_quantity} units)`).join(', ')}. Dispatch manifests generated.`,
    created_at: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Warehouse stock split computed automatically.',
    allocations: splitResult.allocations,
    is_split: splitResult.is_split_occurred,
    quote
  });
});

// Step 9: Get or generate hybrid invoice (One-time Capex + Recurring Opex)
router.get('/quote/:id/invoice', (req, res) => {
  const quote = memStore.quotes.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

  let invoice = memStore.invoices.find(inv => inv.quote_id === quote.id);
  if (!invoice) {
    invoice = generateHybridInvoice(quote);
    memStore.invoices.push(invoice);
  }

  res.json({
    success: true,
    invoice,
    billing_breakdown: {
      one_time_capex: quote.capex_one_time,
      recurring_mrr: quote.opex_recurring_mrr,
      recurring_arr: quote.opex_recurring_arr,
      first_billing_total: invoice.amount_due_today
    }
  });
});

// Step 14: Process simulated payment settlement
router.post('/quote/:id/pay', (req, res) => {
  const quote = memStore.quotes.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

  const { payment_method = 'Corporate Credit Card (Stripe Verified)' } = req.body;

  let invoice = memStore.invoices.find(inv => inv.quote_id === quote.id);
  if (!invoice) {
    invoice = generateHybridInvoice(quote);
    memStore.invoices.push(invoice);
  }

  // Process settlement
  const paidInvoice = processSimulatedPayment(invoice, payment_method);
  const invoiceIdx = memStore.invoices.findIndex(inv => inv.id === invoice.id);
  if (invoiceIdx !== -1) {
    memStore.invoices[invoiceIdx] = paidInvoice;
  }

  quote.status = 'PAID';
  quote.payment_status = 'PAID';
  quote.warehouse_status = 'DISPATCHED';
  quote.current_step = 14; // Step 14: Payment Settled
  quote.updated_at = new Date().toISOString();

  // Deduct inventory quantities from stock
  const allocations = memStore.warehouse_allocations.filter(w => w.quote_id === quote.id);
  for (const alloc of allocations) {
    alloc.status = 'DISPATCHED';
    alloc.dispatch_date = new Date().toISOString();

    const inv = memStore.inventory.find(i => i.warehouse_id === alloc.warehouse_id && i.product_id === alloc.product_id);
    if (inv) {
      inv.available_stock = Math.max(0, inv.available_stock - alloc.allocated_quantity);
    }
  }

  memStore.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    quote_id: quote.id,
    actor: 'Billing Gateway',
    step_number: 14,
    action: 'PAYMENT_SETTLED_DISPATCH_TRIGGERED',
    details: `Payment of ₹${Number(paidInvoice.amount_due_today || paidInvoice.grand_total).toLocaleString('en-IN')} captured via ${payment_method}. Txn: ${paidInvoice.transaction_id}. Fulfillment dispatch orders triggered for all allocated warehouses.`,
    created_at: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Payment successfully processed! Order moved to fulfillment.',
    invoice: paidInvoice,
    quote,
    allocations
  });
});

export default router;
