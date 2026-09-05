import React, { useState, useEffect } from 'react';
import { CreditCard, Receipt, CheckCircle2, ShieldCheck, DollarSign, Calendar, ArrowRight, RefreshCw, Repeat } from 'lucide-react';

export default function BillingCheckoutView({ quoteId, onPaymentCompleted }) {
  const [invoice, setInvoice] = useState(null);
  const [quote, setQuote] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Corporate Net-Banking / UPI (HDFC Verified)');
  const [processing, setProcessing] = useState(false);
  const [paidResult, setPaidResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      let qId = quoteId;
      if (!qId) {
        const qRes = await fetch('/api/quotes');
        const qData = await qRes.json();
        if (qData.success && qData.quotes.length > 0) {
          qId = qData.quotes[0].id;
        }
      }

      if (qId) {
        const [invRes, qRes] = await Promise.all([
          fetch(`/api/execution/quote/${qId}/invoice`).then(r => r.json()),
          fetch(`/api/quotes/${qId}`).then(r => r.json())
        ]);

        if (invRes.success) setInvoice(invRes.invoice);
        if (qRes.success) {
          setQuote(qRes.quote);
          if (qRes.quote.status === 'PAID' || qRes.quote.payment_status === 'PAID') {
            setPaidResult(invRes.invoice);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [quoteId]);

  const handlePay = async () => {
    if (!quote) return;
    try {
      setProcessing(true);
      const res = await fetch(`/api/execution/quote/${quote.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: paymentMethod })
      });
      const data = await res.json();
      if (data.success) {
        setPaidResult(data.invoice);
        setInvoice(data.invoice);
        if (onPaymentCompleted) onPaymentCompleted(data.quote, data.invoice);
      }
    } catch (err) {
      console.error('Payment error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const isPaid = paidResult || invoice?.payment_status === 'PAID' || quote?.status === 'PAID';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="badge badge-indigo">Finance & Operations Role</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Receipt style={{ color: '#10b981' }} /> DealFlow360 Hybrid Billing & Invoicing (Section 17 & 18)
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Unified billing structure cleanly separating One-Time Capex (Laptops + Services) from Recurring Opex (Subscriptions).
          </p>
        </div>
        <button onClick={fetchInvoice} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
          <RefreshCw size={14} /> Refresh Invoice
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
        {/* Left Column: Official Hybrid Tax Invoice */}
        <div className="glass-card" style={{ padding: '2rem', position: 'relative' }}>
          {isPaid && (
            <div style={{ 
              position: 'absolute', 
              top: '2rem', 
              right: '2rem', 
              transform: 'rotate(-10deg)',
              border: '3px solid #10b981',
              color: '#10b981',
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              fontWeight: '900',
              fontSize: '1.5rem',
              letterSpacing: '0.1em',
              background: 'rgba(16, 185, 129, 0.1)',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
            }}>
              PAID IN FULL
            </div>
          )}

          {/* Invoice Top Meta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <span className="badge badge-emerald" style={{ marginBottom: '0.5rem' }}>
                HYBRID TAX INVOICE
              </span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '800' }}>
                Invoice #{invoice?.invoice_number || 'INV-2026-DF360-1'}
              </h3>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Customer: <strong>{quote?.customer_company || 'Acme Corporation (GOLD Tier)'}</strong>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#94a3b8' }}>
              <div>Issue Date: <strong>{new Date().toLocaleDateString()}</strong></div>
              <div>Due Date: <strong>Immediate / Net-0</strong></div>
              <div>Quotation ID: <strong>{quote?.quote_number}</strong></div>
            </div>
          </div>

          {/* Section 17: Hybrid Billing Separation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* One-Time Charges */}
            <div style={{ 
              background: 'rgba(16, 185, 129, 0.06)', 
              border: '1px solid rgba(16, 185, 129, 0.2)', 
              borderRadius: '10px', 
              padding: '1.25rem' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a7f3d0', fontSize: '0.75rem', fontWeight: '800' }}>
                <DollarSign size={16} /> ONE-TIME CHARGES (CAPEX)
              </div>
              <div className="metric-number" style={{ fontSize: '1.8rem', color: '#34d399', margin: '0.4rem 0' }}>
                ₹{Number(quote?.capex_one_time || 720400).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                • 10 × Laptop X (Hardware)<br />
                • 1 × Installation Service
              </div>
            </div>

            {/* Recurring Charges */}
            <div style={{ 
              background: 'rgba(99, 102, 241, 0.06)', 
              border: '1px solid rgba(99, 102, 241, 0.2)', 
              borderRadius: '10px', 
              padding: '1.25rem' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#c7d2fe', fontSize: '0.75rem', fontWeight: '800' }}>
                <Repeat size={16} /> RECURRING CHARGES (SUBSCRIPTION)
              </div>
              <div className="metric-number" style={{ fontSize: '1.8rem', color: '#818cf8', margin: '0.4rem 0' }}>
                ₹{Number(quote?.opex_recurring_mrr || 28500).toLocaleString()}<span style={{ fontSize: '0.9rem' }}>/mo</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                • 10 × Premium Support (₹3,000/mo each)<br />
                • Annualized ARR: <strong>₹{(Number(quote?.opex_recurring_mrr || 28500) * 12).toLocaleString()} / yr</strong>
              </div>
            </div>
          </div>

          {/* Detailed Financial Summary Table */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '0.35rem 0', color: '#94a3b8' }}>
              <span>Gross Deal Subtotal:</span>
              <span>₹{Number(quote?.subtotal || 850000).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '0.35rem 0', color: '#f43f5e' }}>
              <span>Applied Total Discounts:</span>
              <span>-₹{Number(quote?.discount_amount || quote?.discount || 101100).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '0.35rem 0', color: '#94a3b8' }}>
              <span>GST / Taxes (18% on Services):</span>
              <span>₹{Number(invoice?.tax_amount || 2600).toLocaleString()}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '1.3rem', 
              fontWeight: '800', 
              color: '#ffffff',
              borderTop: '2px solid rgba(255,255,255,0.1)',
              paddingTop: '0.75rem',
              marginTop: '0.5rem'
            }}>
              <span>Initial Amount Due:</span>
              <span style={{ color: '#10b981' }}>
                ₹{Number(invoice?.amount_due_today || quote?.final_total || 748900).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Section 20: Active Subscription Card */}
          <div style={{ marginTop: '1.5rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '8px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#a5b4fc', fontWeight: '700', textTransform: 'uppercase' }}>
                  ACTIVE SUBSCRIPTION RECORD (SECTION 20)
                </span>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#f8fafc', marginTop: '0.2rem' }}>
                  10 × Premium Support (Monthly Managed Services)
                </div>
              </div>
              <span className={`badge ${isPaid ? 'badge-emerald' : 'badge-indigo'}`}>
                {isPaid ? 'Status: ACTIVE' : 'Status: PENDING_ACTIVATION'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
              Billing Cycle: <strong>MONTHLY</strong> • Recurring: <strong>₹28,500 / month</strong> • Next Billing Date: 1st of next month
            </div>
          </div>
        </div>

        {/* Right Column: Demo Payment Action (Section 19) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <CreditCard style={{ color: '#10b981' }} size={20} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800' }}>
                Process Payment (Section 19)
              </h3>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
              Demo payment simulation to settle quotation and activate ongoing subscriptions.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#cbd5e1' }}>
                Payment Method:
              </label>
              <select 
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="form-input"
                style={{ marginTop: '0.3rem' }}
                disabled={isPaid}
              >
                <option value="Corporate Net-Banking / UPI (HDFC Verified)">Corporate Net-Banking / UPI</option>
                <option value="Corporate Amex Card (Stripe Verified)">Corporate Amex Card</option>
                <option value="NEFT / RTGS Wire Settlement">NEFT / RTGS Direct Settlement</option>
              </select>
            </div>

            <button 
              onClick={handlePay}
              disabled={processing || isPaid}
              className="btn btn-success"
              style={{ width: '100%', padding: '0.8rem' }}
            >
              <CheckCircle2 size={18} />
              {isPaid 
                ? '✅ Payment Processed (PAID)' 
                : processing 
                ? 'Processing Settlement...' 
                : `Mark as Paid (Pay ₹${Number(invoice?.amount_due_today || quote?.final_total || 748900).toLocaleString()})`}
            </button>

            {isPaid && (
              <div style={{ 
                marginTop: '1rem', 
                background: 'rgba(16, 185, 129, 0.1)', 
                border: '1px solid rgba(16, 185, 129, 0.3)', 
                borderRadius: '8px', 
                padding: '0.75rem',
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem'
              }}>
                <div style={{ color: '#34d399', fontWeight: '800' }}>
                  RECEIPT #{paidResult?.receipt_number || 'RCP-DF360-9421'}
                </div>
                <div style={{ color: '#cbd5e1' }}>
                  Transaction Ref: <span style={{ fontFamily: 'var(--font-mono)' }}>{paidResult?.transaction_id || 'TXN-DF360-PAID-1'}</span>
                </div>
                <div style={{ color: '#94a3b8' }}>
                  Timestamp: {new Date().toLocaleTimeString()} • Status: <strong>PAID</strong>
                </div>
                <div style={{ color: '#a7f3d0', marginTop: '0.3rem', fontWeight: '700' }}>
                  📦 Automated warehouse dispatch slips released & Subscription activated!
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
