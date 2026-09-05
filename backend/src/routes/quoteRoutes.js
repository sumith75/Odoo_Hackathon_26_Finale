import express from 'express';
import { memStore } from '../config/db.js';
import { calculateQuotePricing } from '../services/pricingEngine.js';
import { evaluateQuoteRisk } from '../services/riskEngine.js';
import { generateUpsellRecommendations } from '../services/upsellEngine.js';
import { allocateInventorySplits } from '../services/inventoryEngine.js';

const router = express.Router();

// Helper to format Quotation according to canonical schema (supporting both camelCase & snake_case)
export function formatCanonicalQuotation(q, items = [], approvals = [], negotiations = [], allocations = [], invoice = null, auditLogs = []) {
  const formattedItems = items.map(item => ({
    id: item.id,
    quotationId: item.quote_id || q.id,
    quote_id: item.quote_id || q.id,
    productId: item.product_id,
    product_id: item.product_id,
    productName: item.product_name,
    product_name: item.product_name,
    product: {
      id: item.product_id,
      name: item.product_name,
      category: item.category,
      sku: item.sku || ''
    },
    category: item.category,
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unit_price) || 0,
    unit_price: Number(item.unit_price) || 0,
    unitCost: Number(item.unit_cost) || 0,
    unit_cost: Number(item.unit_cost) || 0,
    discount: Number(item.discount ?? item.discount_pct ?? 0),
    discount_pct: Number(item.discount ?? item.discount_pct ?? 0),
    margin: Number(item.margin ?? item.line_margin_pct ?? 0),
    line_margin_pct: Number(item.margin ?? item.line_margin_pct ?? 0),
    lineTotal: Number(item.line_total) || 0,
    line_total: Number(item.line_total) || 0,
    is_subscription: Boolean(item.is_subscription),
    billing_frequency: item.billing_frequency || 'one_time'
  }));

  const tax = Number(q.tax || Math.round((q.capex_one_time || 0) * 0.06 * 100) / 100);

  return {
    // Canonical schema fields
    id: q.id,
    customerId: q.customer_id || q.customerId || 'cust-acme-1',
    customer_id: q.customer_id || q.customerId || 'cust-acme-1',
    customerName: q.customer_name,
    customer_name: q.customer_name,
    customerCompany: q.customer_company,
    customer_company: q.customer_company,
    customerEmail: q.customer_email,
    customer_email: q.customer_email,
    salesRepId: q.sales_rep_id || q.salesRepId || 'rep-alex-1',
    sales_rep_id: q.sales_rep_id || q.salesRepId || 'rep-alex-1',
    salesRepName: q.sales_rep_name,
    sales_rep_name: q.sales_rep_name,
    status: q.status || q.approval_status || 'DRAFT',
    subtotal: Number(q.subtotal) || 0,
    discount: Number(q.discount ?? q.discount_amount ?? 0),
    discount_amount: Number(q.discount ?? q.discount_amount ?? 0),
    discountPct: Number(q.discount_pct ?? q.rep_discount_pct ?? 0),
    discount_pct: Number(q.discount_pct ?? q.rep_discount_pct ?? 0),
    rep_discount_pct: Number(q.discount_pct ?? q.rep_discount_pct ?? 0),
    tax: tax,
    total: Number(q.total ?? q.final_total ?? 0),
    final_total: Number(q.total ?? q.final_total ?? 0),
    totalCost: Number(q.total_cost) || 0,
    total_cost: Number(q.total_cost) || 0,
    margin: Number(q.margin ?? q.margin_pct ?? 0),
    margin_pct: Number(q.margin ?? q.margin_pct ?? 0),
    profit: Number(q.profit ?? q.profit_amount ?? 0),
    profit_amount: Number(q.profit ?? q.profit_amount ?? 0),
    riskScore: Number(q.risk_score ?? q.riskScore ?? 0),
    risk_score: Number(q.risk_score ?? q.riskScore ?? 0),
    riskLevel: q.risk_level || q.riskLevel || 'SAFE',
    risk_level: q.risk_level || q.riskLevel || 'SAFE',
    riskFactors: q.risk_factors || q.riskFactors || [],
    risk_factors: q.risk_factors || q.riskFactors || [],
    approvalStatus: q.approval_status || q.approvalStatus || 'DRAFT',
    approval_status: q.approval_status || q.approvalStatus || 'DRAFT',
    customerResponse: q.customer_response || q.customerResponse || null,
    customer_response: q.customer_response || q.customerResponse || null,
    quoteNumber: q.quote_number,
    quote_number: q.quote_number,
    capex_one_time: Number(q.capex_one_time) || 0,
    opex_recurring_mrr: Number(q.opex_recurring_mrr) || 0,
    opex_recurring_arr: Number(q.opex_recurring_arr) || 0,
    manager_note: q.manager_note || null,
    finance_note: q.finance_note || null,
    warehouse_status: q.warehouse_status || 'UNASSIGNED',
    payment_status: q.payment_status || 'UNPAID',
    current_step: q.current_step || 3,
    createdAt: q.created_at || q.createdAt,
    created_at: q.created_at || q.createdAt,
    updatedAt: q.updated_at || q.updatedAt,
    updated_at: q.updated_at || q.updatedAt,

    // Children entities
    items: formattedItems,
    quotationItems: formattedItems,
    approvals,
    negotiations,
    warehouse_allocations: allocations,
    invoice,
    audit_logs: auditLogs
  };
}

// Live reactive calculation endpoint
router.post('/calculate', (req, res) => {
  const { items = [], rep_discount_pct = 0 } = req.body;
  const pricing = calculateQuotePricing(items, rep_discount_pct);
  const rules = memStore.discount_rules[0];
  const risk = evaluateQuoteRisk(pricing, rules, memStore.inventory);
  const upsells = generateUpsellRecommendations(pricing.items, memStore.products);

  res.json({
    success: true,
    pricing,
    risk,
    upsells
  });
});

// List all quotations
router.get('/', (req, res) => {
  const formattedQuotes = memStore.quotes.map(q => {
    const items = memStore.quote_items.filter(i => i.quote_id === q.id);
    return formatCanonicalQuotation(q, items);
  });
  res.json({ success: true, quotes: formattedQuotes });
});

// Create a new quotation (Single Source of Truth)
router.post('/', (req, res) => {
  const {
    customer_id = 'cust-acme-1',
    customer_name = 'Acme Global Enterprises',
    customer_company = 'Acme Corp',
    customer_email = 'procurement@acme.com',
    customer_tier = 'A',
    sales_rep_id = 'rep-alex-1',
    sales_rep_name = 'Alex Morgan (Enterprise AE)',
    items = [],
    rep_discount_pct = 0
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Quotation must contain at least one line item.' });
  }

  // Hydrate items with catalog details
  const hydratedItems = items.map(item => {
    const product = memStore.products.find(p => p.id === (item.product_id || item.id));
    return {
      product_id: product ? product.id : item.id,
      product_name: product ? product.name : (item.name || 'Custom Item'),
      category: product ? product.category : (item.category || 'hardware'),
      unit_price: Number(item.unit_price ?? product?.base_price ?? 0),
      unit_cost: Number(item.unit_cost ?? product?.unit_cost ?? 0),
      quantity: Number(item.quantity) || 1,
      discount_pct: Number(item.discount_pct || item.discount || 0),
      is_subscription: product ? product.is_subscription : Boolean(item.is_subscription),
      billing_frequency: product ? product.billing_frequency : (item.billing_frequency || 'one_time')
    };
  });

  // Calculate pricing & margins
  const pricing = calculateQuotePricing(hydratedItems, rep_discount_pct);
  const rules = memStore.discount_rules[0];

  // AUTOMATED RISK ENGINE EVALUATION
  const risk = evaluateQuoteRisk(pricing, rules, memStore.inventory);

  const quoteId = `quote-${Math.random().toString(36).substr(2, 9)}`;
  const quoteNumber = `QT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  const currentStep = pricing.rep_discount_pct > (rules.max_rep_discount_pct || 15) ? 5 : 3;

  const newQuote = {
    id: quoteId,
    quote_number: quoteNumber,
    customer_id,
    customer_name,
    customer_company,
    customer_email,
    customer_tier,
    sales_rep_id,
    sales_rep_name,
    status: risk.initial_approval_status === 'APPROVED' ? 'APPROVED' : 'PENDING_APPROVAL',
    subtotal: pricing.subtotal,
    discount: pricing.discount_amount,
    discount_amount: pricing.discount_amount,
    discount_pct: pricing.rep_discount_pct,
    rep_discount_pct: pricing.rep_discount_pct,
    tax: Math.round(pricing.capex_one_time * 0.06 * 100) / 100,
    total: pricing.final_total,
    final_total: pricing.final_total,
    total_cost: pricing.total_cost,
    margin: pricing.margin_pct,
    margin_pct: pricing.margin_pct,
    profit: pricing.profit_amount,
    profit_amount: pricing.profit_amount,
    risk_score: risk.risk_score,
    risk_level: risk.risk_level,
    risk_factors: risk.risk_factors,
    approval_status: risk.initial_approval_status,
    customer_response: null,
    capex_one_time: pricing.capex_one_time,
    opex_recurring_mrr: pricing.opex_recurring_mrr,
    opex_recurring_arr: pricing.opex_recurring_arr,
    manager_note: null,
    finance_note: null,
    warehouse_status: 'UNASSIGNED',
    payment_status: 'UNPAID',
    current_step: currentStep,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  memStore.quotes.unshift(newQuote);

  // Save line items
  const createdItems = [];
  for (const item of pricing.items) {
    const itemRecord = {
      id: `item-${Math.random().toString(36).substr(2, 9)}`,
      quote_id: quoteId,
      product_id: item.product_id,
      product_name: item.product_name,
      category: item.category,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      unit_price: item.unit_price,
      discount: item.discount_pct,
      discount_pct: item.discount_pct,
      margin: item.line_margin_pct,
      line_margin_pct: item.line_margin_pct,
      line_total: item.line_total,
      is_subscription: item.is_subscription,
      billing_frequency: item.billing_frequency
    };
    memStore.quote_items.push(itemRecord);
    createdItems.push(itemRecord);
  }

  // If requires manager approval, create approval record
  if (risk.requires_manager) {
    memStore.quote_approvals.push({
      id: `appr-${Math.random().toString(36).substr(2, 9)}`,
      quote_id: quoteId,
      step_role: 'MANAGER',
      status: 'PENDING',
      reviewer_name: 'Sarah Jenkins (VP Sales)',
      notes: null,
      created_at: new Date().toISOString(),
      resolved_at: null
    });
  }

  // Pre-calculate warehouse split for inventory
  const splitResult = allocateInventorySplits(pricing.items, memStore.warehouses, memStore.inventory);
  for (const alloc of splitResult.allocations) {
    memStore.warehouse_allocations.push({
      ...alloc,
      quote_id: quoteId
    });
  }

  // Audit trail entry
  memStore.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    quote_id: quoteId,
    actor: sales_rep_name,
    step_number: currentStep,
    action: risk.requires_manager ? 'SYSTEM_RISK_DETECTED' : 'QUOTE_CREATED_SAFE',
    details: risk.requires_manager
      ? `Quote created with ${pricing.rep_discount_pct}% discount. Risk Engine flagged ${risk.risk_level} (${risk.risk_score} pts). Routing to Manager.`
      : `Quote created within safe thresholds. Directly approved.`,
    created_at: new Date().toISOString()
  });

  const canonicalQuotation = formatCanonicalQuotation(newQuote, createdItems);

  res.json({
    success: true,
    quote: canonicalQuotation,
    quotation: canonicalQuotation,
    items: canonicalQuotation.items,
    risk,
    split_inventory: splitResult
  });
});

// Get single quotation details (Canonical single source of truth)
router.get('/:id', (req, res) => {
  const quote = memStore.quotes.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'Quotation not found' });

  const items = memStore.quote_items.filter(i => i.quote_id === quote.id);
  const approvals = memStore.quote_approvals.filter(a => a.quote_id === quote.id);
  const negotiations = memStore.negotiation_history.filter(n => n.quote_id === quote.id);
  const warehouseAllocations = memStore.warehouse_allocations.filter(w => w.quote_id === quote.id);
  const invoice = memStore.invoices.find(inv => inv.quote_id === quote.id) || null;
  const auditLogs = memStore.audit_logs.filter(log => log.quote_id === quote.id);

  const canonicalQuotation = formatCanonicalQuotation(quote, items, approvals, negotiations, warehouseAllocations, invoice, auditLogs);

  res.json({
    success: true,
    quote: canonicalQuotation,
    quotation: canonicalQuotation
  });
});

// Get upsell recommendations for a quotation
router.get('/:id/upsell', (req, res) => {
  const quote = memStore.quotes.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'Quotation not found' });

  const items = memStore.quote_items.filter(i => i.quote_id === quote.id);
  const recommendations = generateUpsellRecommendations(items, memStore.products);

  res.json({ success: true, recommendations });
});

// Add an upsell item directly to quotation
router.post('/:id/upsell/add', (req, res) => {
  const quote = memStore.quotes.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, message: 'Quotation not found' });

  const { product_id, quantity = 1 } = req.body;
  const product = memStore.products.find(p => p.id === product_id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  // Add line item
  memStore.quote_items.push({
    id: `item-${Math.random().toString(36).substr(2, 9)}`,
    quote_id: quote.id,
    product_id: product.id,
    product_name: product.name,
    category: product.category,
    quantity: Number(quantity) || 1,
    unit_cost: product.unit_cost,
    unit_price: product.base_price,
    discount: 0,
    discount_pct: 0,
    line_total: product.base_price * (Number(quantity) || 1),
    margin: Math.round(((product.base_price - product.unit_cost) / product.base_price) * 1000) / 10,
    line_margin_pct: Math.round(((product.base_price - product.unit_cost) / product.base_price) * 1000) / 10,
    is_subscription: product.is_subscription,
    billing_frequency: product.billing_frequency
  });

  // Re-calculate all items
  const allItems = memStore.quote_items.filter(i => i.quote_id === quote.id);
  const pricing = calculateQuotePricing(allItems, quote.rep_discount_pct);
  const rules = memStore.discount_rules[0];
  const risk = evaluateQuoteRisk(pricing, rules, memStore.inventory);

  quote.total_cost = pricing.total_cost;
  quote.subtotal = pricing.subtotal;
  quote.discount = pricing.discount_amount;
  quote.discount_amount = pricing.discount_amount;
  quote.capex_one_time = pricing.capex_one_time;
  quote.opex_recurring_mrr = pricing.opex_recurring_mrr;
  quote.opex_recurring_arr = pricing.opex_recurring_arr;
  quote.total = pricing.final_total;
  quote.final_total = pricing.final_total;
  quote.margin = pricing.margin_pct;
  quote.margin_pct = pricing.margin_pct;
  quote.profit = pricing.profit_amount;
  quote.profit_amount = pricing.profit_amount;
  quote.risk_score = risk.risk_score;
  quote.risk_level = risk.risk_level;
  quote.risk_factors = risk.risk_factors;
  quote.current_step = 7;
  quote.updated_at = new Date().toISOString();

  // Audit log
  memStore.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    quote_id: quote.id,
    actor: quote.sales_rep_name,
    step_number: 7,
    action: 'UPSELL_ITEM_ADDED',
    details: `Added recommended upsell: "${product.name}". New deal total: $${pricing.final_total.toLocaleString()} (Margin uplift to ${pricing.margin_pct}%).`,
    created_at: new Date().toISOString()
  });

  const canonical = formatCanonicalQuotation(quote, allItems);

  res.json({
    success: true,
    message: `Added ${product.name} to quotation.`,
    quote: canonical,
    quotation: canonical,
    pricing,
    risk
  });
});

export default router;
