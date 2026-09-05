// Hybrid Billing & Payment Simulation Engine (One-Time Capex + Recurring Opex)

export function generateHybridInvoice(quote) {
  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  const capex = Number(quote.capex_one_time) || 0;
  const mrr = Number(quote.opex_recurring_mrr) || 0;
  const arr = Number(quote.opex_recurring_arr) || mrr * 12;
  const tax = Math.round(capex * 0.06 * 100) / 100; // 6% capex tax
  const initialDue = Math.round((capex + mrr + tax) * 100) / 100;

  return {
    id: `inv-${Math.random().toString(36).substr(2, 9)}`,
    quote_id: quote.id,
    invoice_number: invoiceNumber,
    customer_name: quote.customer_name,
    customer_company: quote.customer_company,
    capex_total: capex,
    opex_recurring_mrr: mrr,
    opex_recurring_arr: arr,
    tax_amount: tax,
    grand_total: Math.round(quote.final_total * 100) / 100,
    amount_due_today: initialDue,
    payment_status: 'UNPAID',
    payment_method: null,
    billing_schedule: {
      today: `₹${initialDue.toLocaleString('en-IN')} (Capex + 1st Month Subscription + Tax)`,
      subsequent_months: `₹${mrr.toLocaleString('en-IN')} / month (Billed on 1st of each month)`
    },
    created_at: new Date().toISOString()
  };
}

export function processSimulatedPayment(invoice, paymentMethod = 'Corporate Credit Card') {
  const transactionId = `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}-${Date.now()}`;
  return {
    ...invoice,
    payment_status: 'PAID',
    payment_method: paymentMethod,
    transaction_id: transactionId,
    paid_at: new Date().toISOString(),
    receipt_number: `RCP-${Math.floor(100000 + Math.random() * 900000)}`,
    gateway_response: 'SUCCESS_AUTHORIZED_AND_CAPTURED'
  };
}
