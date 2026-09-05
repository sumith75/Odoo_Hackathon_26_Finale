import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Scale, CheckCircle2, AlertTriangle, ArrowRight, 
  MessageSquare, FileText, Send, ShieldAlert, Sparkles, RefreshCw, Clock
} from 'lucide-react';

export default function CustomerPortalView({ quoteId, onQuoteConfirmed, onCounterOfferSubmitted }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [counterDiscount, setCounterDiscount] = useState(20); // 20% requested as in Section 14 & 51
  const [customerNote, setCustomerNote] = useState('We would like a 20% discount on Laptop X to finalize our fleet purchase.');
  const [submittingCounter, setSubmittingCounter] = useState(false);
  const [reRiskAlert, setReRiskAlert] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      let url = quoteId ? `/api/customer/quote/${quoteId}` : '/api/quotes';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        if (quoteId) {
          setQuote(data.quote);
        } else if (data.quotes && data.quotes.length > 0) {
          const singleRes = await fetch(`/api/customer/quote/${data.quotes[0].id}`);
          const singleData = await singleRes.json();
          if (singleData.success) {
            setQuote(singleData.quote);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load customer quote:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  // Customer submits counter-offer (Section 14 & 51)
  const handleNegotiate = async () => {
    if (!quote) return;
    try {
      setSubmittingCounter(true);
      const res = await fetch(`/api/customer/quote/${quote.id}/negotiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_discount_pct: counterDiscount,
          customer_notes: customerNote
        })
      });
      const data = await res.json();
      if (data.success) {
        setQuote(data.quote);
        setReRiskAlert(data.risk);
        if (onCounterOfferSubmitted) onCounterOfferSubmitted(data.quote);
      }
    } catch (err) {
      console.error('Failed to submit counter-offer:', err);
    } finally {
      setSubmittingCounter(false);
    }
  };

  // Customer confirms quote (Section 16 & 53)
  const handleConfirm = async () => {
    if (!quote) return;
    try {
      setConfirming(true);
      const res = await fetch(`/api/customer/quote/${quote.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setQuote(data.quote);
        if (onQuoteConfirmed) onQuoteConfirmed(data.quote);
      }
    } catch (err) {
      console.error('Failed to confirm quote:', err);
    } finally {
      setConfirming(false);
    }
  };

  if (loading || !quote) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#94a3b8' }}>Loading customer quotation portal...</p>
      </div>
    );
  }

  const isApproved = quote.status === 'MANAGER_APPROVED' || quote.status === 'FINANCE_APPROVED' || quote.approval_status === 'MANAGER_APPROVED';
  const isConfirmed = quote.status === 'CUSTOMER_CONFIRMED' || quote.status === 'FULFILLED' || quote.status === 'PAID';
  const isPendingManager = quote.status === 'PENDING_APPROVAL' || quote.status === 'NEGOTIATION' || quote.approval_status === 'PENDING_APPROVAL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="badge badge-emerald">Customer Role: Acme Corporation</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>
              DealFlow360 Client Negotiation Deal Room
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Quotation #{quote.quote_number} • Issued to <strong>Acme Corporation</strong> by {quote.sales_rep_name}
          </p>
        </div>
        <button onClick={fetchQuote} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
          <RefreshCw size={14} /> Refresh Quotation
        </button>
      </div>

      {/* Closed-loop Re-Risk Recalculation Alert (Section 14 & 52) */}
      {(reRiskAlert || isPendingManager) && (
        <div className="glass-card pulse-risk" style={{ 
          background: 'rgba(38, 16, 26, 0.85)', 
          borderColor: 'rgba(244, 63, 94, 0.4)',
          borderLeft: '5px solid #f43f5e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldAlert size={26} style={{ color: '#f43f5e' }} />
            <div>
              <div style={{ fontWeight: '800', fontSize: '1rem', color: '#fda4af' }}>
                🤖 CLOSED-LOOP GOVERNANCE: RISK RECALCULATED ON COUNTER-OFFER
              </div>
              <div style={{ fontSize: '0.825rem', color: '#fecdd3', marginTop: '0.2rem' }}>
                Customer requested <strong>{counterDiscount}% discount on Laptop X</strong>. Allowed ceiling is 15%. 
                System detected <strong>HIGH RISK</strong>: your counter-offer has been automatically submitted to <strong>Vikram Mehta (Sales Manager)</strong> for approval.
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
        {/* Left Column: Commercial Quotation Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Quotation Status</span>
                <div style={{ marginTop: '0.2rem' }}>
                  <span className={`badge ${isConfirmed ? 'badge-emerald' : isApproved ? 'badge-indigo' : 'badge-amber'}`} style={{ fontSize: '0.85rem' }}>
                    {quote.status}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Proposed Investment</span>
                <div className="metric-number" style={{ fontSize: '1.75rem', color: '#f8fafc' }}>
                  ₹{Number(quote.final_total || quote.total).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Line Items List */}
            <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.6rem', color: '#cbd5e1' }}>
              Scope of Supply & Services
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {quote.items?.map((item, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#f1f5f9' }}>
                      {item.product_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Quantity: {item.quantity} • {item.is_subscription ? 'Monthly Subscription' : 'One-Time Delivery'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: '#6366f1' }}>
                      ₹{Number(item.line_total).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      ₹{Number(item.unit_price).toLocaleString()} each ({item.discount_pct}% disc)
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Hybrid Billing Breakdown (Section 17) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.25rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.72rem', color: '#a7f3d0', fontWeight: '700' }}>ONE-TIME CHARGES (HARDWARE + SETUP)</span>
                <div className="metric-number" style={{ fontSize: '1.3rem', color: '#34d399', marginTop: '0.2rem' }}>
                  ₹{Number(quote.capex_one_time).toLocaleString()}
                </div>
              </div>
              <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.72rem', color: '#c7d2fe', fontWeight: '700' }}>RECURRING SUBSCRIPTION (OPEX)</span>
                <div className="metric-number" style={{ fontSize: '1.3rem', color: '#818cf8', marginTop: '0.2rem' }}>
                  ₹{Number(quote.opex_recurring_mrr).toLocaleString()} / mo
                </div>
              </div>
            </div>
          </div>

          {/* Negotiation History Timeline (Section 15) */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Clock size={16} style={{ color: '#f59e0b' }} />
              <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#e0e7ff' }}>
                Negotiation History & Round Audit (Section 15)
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontWeight: '600' }}>
                  <span>Round 1: Sales Rep ➔ Acme Corp</span>
                  <span className="badge badge-indigo">Initial Quote</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                  Offered 12% discount on 10x Laptop X and 18% on Installation Service.
                </div>
              </div>

              {quote.negotiations?.map((neg, idx) => (
                <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24', fontWeight: '600' }}>
                    <span>Round {neg.round_number + 1}: Customer Counter-Offer</span>
                    <span className="badge badge-amber">{neg.status}</span>
                  </div>
                  <div style={{ color: '#f8fafc', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                    "{neg.customer_notes}"
                  </div>
                  <div style={{ color: '#f43f5e', fontSize: '0.72rem', marginTop: '0.15rem' }}>
                    {neg.auto_detected_variance}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Negotiation Slider & Confirmation Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Section 14 & 51: Customer Counter-Offer Negotiation */}
          <div className="glass-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Scale style={{ color: '#f59e0b' }} size={20} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800' }}>
                Negotiate / Counter-Offer (Section 14)
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Propose revised commercial terms. The Risk Engine will automatically re-evaluate governance rules.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#cbd5e1' }}>
                  Requested Discount on Laptops:
                </label>
                <span className="metric-number" style={{ fontSize: '1.3rem', color: '#f59e0b' }}>
                  {counterDiscount}%
                </span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="35" 
                step="1"
                value={counterDiscount} 
                onChange={e => setCounterDiscount(Number(e.target.value))} 
              />
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                Allowed Hardware limit: 15% • Your request: {counterDiscount}%
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#cbd5e1' }}>
                Procurement Justification / Notes:
              </label>
              <textarea 
                rows={3}
                value={customerNote}
                onChange={e => setCustomerNote(e.target.value)}
                className="form-input"
                style={{ resize: 'none', marginTop: '0.3rem', fontSize: '0.8rem' }}
              />
            </div>

            <button 
              onClick={handleNegotiate}
              disabled={submittingCounter || isConfirmed}
              className="btn btn-outline"
              style={{ width: '100%', borderColor: '#f59e0b', color: '#fbbf24', padding: '0.65rem' }}
            >
              <Send size={15} />
              {submittingCounter ? 'Triggering Risk Engine...' : 'Submit Counter-Offer (Auto Re-Evaluation)'}
            </button>
          </div>

          {/* Section 16 & 53: Customer Confirmation */}
          <div className="glass-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <CheckCircle2 style={{ color: '#10b981' }} size={20} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800' }}>
                Confirm Final Quotation (Section 16)
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Once approved by management, digitally confirm the order to advance to fulfillment and billing.
            </p>

            <button 
              onClick={handleConfirm}
              disabled={confirming || !isApproved || isConfirmed}
              className="btn btn-success"
              style={{ width: '100%', padding: '0.8rem' }}
            >
              <CheckCircle2 size={18} />
              {isConfirmed 
                ? '✅ Quotation Digitally Signed & Confirmed' 
                : isPendingManager 
                ? '⏳ Awaiting Manager Approval' 
                : 'Confirm & Sign Quotation (Section 16)'}
            </button>

            {isConfirmed && (
              <div style={{ 
                marginTop: '0.75rem', 
                fontSize: '0.78rem', 
                color: '#a7f3d0',
                background: 'rgba(16, 185, 129, 0.15)',
                padding: '0.6rem',
                borderRadius: '6px'
              }}>
                Order confirmed! Status: <strong>CUSTOMER_CONFIRMED</strong>. Ready for multi-warehouse allocation & invoicing.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
