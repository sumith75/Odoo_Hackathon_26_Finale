import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Sliders, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, 
  Plus, Trash2, ArrowRight, DollarSign, TrendingUp, Layers, Laptop, Wrench, Shield
} from 'lucide-react';

export default function SalesRepCPQView({ onQuoteCreated, prefillExcessiveDiscount = false }) {
  const [products, setProducts] = useState([]);
  const [customerName, setCustomerName] = useState('Acme Corporation');
  const [customerCompany, setCustomerCompany] = useState('Acme Corporation');
  const [customerEmail, setCustomerEmail] = useState('customer@acme.com');
  const [salesRepName, setSalesRepName] = useState('Alex Morgan (Enterprise AE)');
  
  // Exactly as specified in Section 46 & 47:
  // 10 × Laptop X (12% discount)
  // 1 × Installation Service (18% discount - VIOLATION!)
  // 10 × Premium Support (5% discount)
  const [items, setItems] = useState([
    {
      id: 'prod-laptop-x',
      product_id: 'prod-laptop-x',
      name: 'Laptop X',
      category: 'HARDWARE',
      base_price: 80000,
      unit_price: 80000,
      unit_cost: 55000,
      quantity: 10,
      discount_pct: prefillExcessiveDiscount ? 12 : 10,
      is_subscription: false,
      billing_frequency: 'one_time'
    },
    {
      id: 'prod-install',
      product_id: 'prod-install',
      name: 'Installation Service',
      category: 'SERVICE',
      base_price: 20000,
      unit_price: 20000,
      unit_cost: 8000,
      quantity: 1,
      discount_pct: prefillExcessiveDiscount ? 18 : 5,
      is_subscription: false,
      billing_frequency: 'one_time'
    },
    {
      id: 'prod-support',
      product_id: 'prod-support',
      name: 'Premium Support',
      category: 'SUBSCRIPTION',
      base_price: 3000,
      unit_price: 3000,
      unit_cost: 500,
      quantity: 10,
      discount_pct: 5,
      is_subscription: true,
      billing_frequency: 'monthly'
    }
  ]);

  const [pricing, setPricing] = useState(null);
  const [risk, setRisk] = useState(null);
  const [upsells, setUpsells] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedQuote, setSubmittedQuote] = useState(null);

  useEffect(() => {
    fetch('/api/admin/products')
      .then(r => r.json())
      .then(d => { if (d.success) setProducts(d.products); });
  }, []);

  // Recalculate live whenever items change
  useEffect(() => {
    fetch('/api/quotes/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPricing(d.pricing);
          setRisk(d.risk);
          setUpsells(d.upsells);
        }
      })
      .catch(err => console.error('Calculation error:', err));
  }, [items]);

  const handleUpdateQty = (index, qty) => {
    const updated = [...items];
    updated[index].quantity = Math.max(1, Number(qty) || 1);
    setItems(updated);
  };

  const handleUpdateDiscount = (index, disc) => {
    const updated = [...items];
    updated[index].discount_pct = Math.min(50, Math.max(0, Number(disc) || 0));
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleApplyDemoViolation = () => {
    const updated = [...items];
    const srvIdx = updated.findIndex(i => i.category === 'SERVICE');
    if (srvIdx !== -1) {
      updated[srvIdx].discount_pct = 18; // 18% exceeds 10% limit!
    }
    const lapIdx = updated.findIndex(i => i.category === 'HARDWARE');
    if (lapIdx !== -1) {
      updated[lapIdx].discount_pct = 12; // 12% within 15% limit
    }
    setItems(updated);
  };

  const handleAddUpsell = (upsellItem) => {
    const existing = items.find(i => i.product_id === upsellItem.product.id);
    if (existing) {
      existing.quantity += 1;
      setItems([...items]);
    } else {
      setItems([
        ...items,
        {
          id: upsellItem.product.id,
          product_id: upsellItem.product.id,
          name: upsellItem.product.name,
          category: upsellItem.product.category,
          base_price: upsellItem.product.base_price,
          unit_price: upsellItem.product.base_price,
          unit_cost: upsellItem.product.unit_cost,
          quantity: upsellItem.recommended_quantity || 1,
          discount_pct: 0,
          is_subscription: upsellItem.product.is_subscription,
          billing_frequency: upsellItem.product.billing_frequency
        }
      ]);
    }
  };

  const handleSubmitQuote = async () => {
    try {
      setSubmitting(true);
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          customer_company: customerCompany,
          customer_email: customerEmail,
          sales_rep_name: salesRepName,
          items
        })
      });
      const data = await res.json();
      if (data.success) {
        setSubmittedQuote(data.quote);
        if (onQuoteCreated) onQuoteCreated(data.quote);
      }
    } catch (err) {
      console.error('Failed to submit quote:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const isHighRisk = risk?.risk_level === 'HIGH' || risk?.risk_score >= 80;
  const marginColor = !pricing ? '#10b981' : pricing.margin_pct >= 25 ? '#10b981' : pricing.margin_pct >= 18 ? '#f59e0b' : '#f43f5e';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="badge badge-indigo">Sales Representative Role</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShoppingCart style={{ color: '#6366f1' }} /> DealFlow360 Quotation Builder
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Account: <strong>Acme Corporation (GOLD Tier)</strong> • Limits: Hardware max 15%, Service max 10%, Subscription max 5%.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={handleApplyDemoViolation}
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', borderColor: '#f43f5e', color: '#fda4af' }}
          >
            ⚡ Apply Scenario: 18% Service Discount (Triggers Risk 🚨)
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
        {/* Left Column: Quote Builder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Customer & Account Details */}
          <div className="glass-card" style={{ padding: '1.2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Customer Account</label>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#f8fafc', marginTop: '0.25rem' }}>
                  {customerName} <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>GOLD</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Contact Email</label>
                <div style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  {customerEmail}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Sales Representative</label>
                <div style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  {salesRepName}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers style={{ color: '#6366f1' }} size={18} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>Quotation Line Items</h3>
                <span className="badge badge-indigo">{items.length} Products</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Governance Guardrails: Hardware ≤ 15%, Service ≤ 10%, Sub ≤ 5%
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Product Name</th>
                  <th style={{ padding: '0.5rem' }}>Type</th>
                  <th style={{ padding: '0.5rem', width: '70px' }}>Qty</th>
                  <th style={{ padding: '0.5rem' }}>Unit Price</th>
                  <th style={{ padding: '0.5rem', width: '110px' }}>Discount %</th>
                  <th style={{ padding: '0.5rem' }}>Line Total</th>
                  <th style={{ padding: '0.5rem', width: '30px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const maxAllowed = item.category === 'HARDWARE' ? 15 : item.category === 'SERVICE' ? 10 : 5;
                  const isExceeded = item.discount_pct > maxAllowed;

                  return (
                    <tr key={idx} style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isExceeded ? 'rgba(244, 63, 94, 0.05)' : 'transparent'
                    }}>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: '600' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {item.category === 'HARDWARE' && <Laptop size={15} style={{ color: '#60a5fa' }} />}
                          {item.category === 'SERVICE' && <Wrench size={15} style={{ color: '#f59e0b' }} />}
                          {item.category === 'SUBSCRIPTION' && <Shield size={15} style={{ color: '#a855f7' }} />}
                          {item.name}
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>
                        <span className={`badge ${item.category === 'SUBSCRIPTION' ? 'badge-indigo' : item.category === 'SERVICE' ? 'badge-amber' : 'badge-emerald'}`} style={{ fontSize: '0.65rem' }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>
                        <input 
                          type="number" 
                          min="1" 
                          value={item.quantity} 
                          onChange={e => handleUpdateQty(idx, e.target.value)} 
                          className="form-input"
                          style={{ padding: '0.3rem 0.4rem', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', color: '#cbd5e1' }}>
                        ₹{item.unit_price.toLocaleString()}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input 
                            type="number" 
                            min="0" 
                            max="50" 
                            value={item.discount_pct} 
                            onChange={e => handleUpdateDiscount(idx, e.target.value)} 
                            className="form-input"
                            style={{ 
                              padding: '0.3rem 0.4rem', 
                              textAlign: 'center',
                              borderColor: isExceeded ? '#f43f5e' : 'rgba(255,255,255,0.08)',
                              color: isExceeded ? '#fb7185' : '#f8fafc',
                              fontWeight: isExceeded ? '800' : '500'
                            }}
                          />
                          <span style={{ fontSize: '0.7rem', color: isExceeded ? '#f43f5e' : '#64748b' }}>%</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: isExceeded ? '#f43f5e' : '#64748b', marginTop: '0.1rem' }}>
                          Allowed: ≤ {maxAllowed}%
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: '700', color: '#f8fafc' }}>
                        ₹{item.line_total ? item.line_total.toLocaleString() : (item.unit_price * item.quantity * (1 - item.discount_pct / 100)).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>
                        <button 
                          onClick={() => handleRemoveItem(idx)}
                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Upsell Recommendations Engine (Section 10) */}
          {upsells.length > 0 && (
            <div className="glass-card" style={{ border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Sparkles style={{ color: '#a855f7' }} size={18} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#e0e7ff' }}>
                  DealFlow360 Recommendation Engine 💡
                </h4>
                <span className="badge badge-indigo">Recommended for this deal</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {upsells.map(rec => (
                  <div key={rec.id} style={{ 
                    background: 'rgba(99, 102, 241, 0.08)', 
                    border: '1px solid rgba(99, 102, 241, 0.2)', 
                    borderRadius: '8px', 
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{rec.headline}</span>
                        <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>{rec.badge}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.35rem 0' }}>
                        {rec.description}
                      </p>
                      <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: '600' }}>
                        {rec.financial_impact}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleAddUpsell(rec)}
                      className="btn btn-primary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', marginTop: '0.6rem' }}
                    >
                      <Plus size={13} /> Add to Quotation ({rec.margin_impact})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Pricing Engine & Automated Risk Detection (Section 7) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Automated Risk Detection Box (Section 7) */}
          {risk && (
            <div className={`glass-card ${isHighRisk ? 'pulse-risk' : ''}`} style={{ 
              borderColor: isHighRisk ? 'rgba(244, 63, 94, 0.5)' : 'rgba(16, 185, 129, 0.4)',
              background: isHighRisk ? 'rgba(38, 16, 26, 0.9)' : 'rgba(12, 28, 22, 0.8)',
              borderLeft: isHighRisk ? '4px solid #f43f5e' : '4px solid #10b981'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                {isHighRisk ? (
                  <ShieldAlert size={24} style={{ color: '#f43f5e' }} />
                ) : (
                  <CheckCircle2 size={24} style={{ color: '#10b981' }} />
                )}
                <div>
                  <div style={{ fontWeight: '800', fontSize: '1rem', color: isHighRisk ? '#fda4af' : '#6ee7b7' }}>
                    {isHighRisk ? '🚨 DISCOUNT RISK ENGINE: HIGH' : '✅ DISCOUNT RISK: LOW'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Risk Score: <strong>{risk.risk_score}/100</strong> • {risk.requires_approval ? 'Approval Required (Cannot bypass)' : 'Directly Approved'}
                  </div>
                </div>
              </div>

              {/* Exact reasons breakdown */}
              {risk.risk_factors.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {risk.risk_factors.map((factor, i) => (
                    <div key={i} style={{ 
                      fontSize: '0.78rem', 
                      background: 'rgba(0,0,0,0.3)', 
                      padding: '0.45rem 0.65rem', 
                      borderRadius: '6px',
                      borderLeft: '3px solid #f43f5e',
                      color: '#fecdd3'
                    }}>
                      • {factor.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Margin Meter */}
          {pricing && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8' }}>Gross Deal Margin:</span>
                <span className="metric-number" style={{ fontSize: '1.5rem', color: marginColor }}>
                  {pricing.margin_pct}%
                </span>
              </div>
              <div className="margin-meter">
                <div 
                  className="margin-fill" 
                  style={{ 
                    width: `${Math.min(100, Math.max(0, pricing.margin_pct * 2))}%`,
                    backgroundColor: marginColor
                  }} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>
                <span>0%</span>
                <span style={{ color: '#10b981' }}>25% (Min Safe Floor)</span>
                <span>50%</span>
              </div>
            </div>
          )}

          {/* Deal Financial Summary in INR ₹ */}
          {pricing && (
            <div className="glass-card" style={{ padding: '1.2rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.75rem', color: '#cbd5e1' }}>
                Commercial Quotation Summary
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Gross Subtotal:</span>
                  <span>₹{pricing.subtotal.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f43f5e' }}>
                  <span>Total Discount:</span>
                  <span>-₹{pricing.discount_amount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6ee7b7' }}>
                  <span>One-Time Capex (Hardware & Service):</span>
                  <span>₹{pricing.capex_one_time.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a5b4fc' }}>
                  <span>Monthly Recurring Subscription (MRR):</span>
                  <span>₹{pricing.opex_recurring_mrr.toLocaleString()} / mo</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: '1.15rem', 
                  fontWeight: '800', 
                  color: '#ffffff',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  paddingTop: '0.5rem',
                  marginTop: '0.25rem'
                }}>
                  <span>Final Total:</span>
                  <span>₹{pricing.final_total.toLocaleString()}</span>
                </div>
              </div>

              <button 
                onClick={handleSubmitQuote}
                disabled={submitting}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1.25rem', padding: '0.75rem' }}
              >
                {submitting ? 'Submitting Quotation...' : 'Submit Quotation & Execute Governance'}
                <ArrowRight size={16} />
              </button>

              {submittedQuote && (
                <div style={{ 
                  marginTop: '0.75rem', 
                  padding: '0.6rem', 
                  background: 'rgba(16, 185, 129, 0.15)', 
                  borderRadius: '6px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '0.78rem',
                  color: '#a7f3d0'
                }}>
                  ✅ Quotation <strong>{submittedQuote.quote_number}</strong> submitted! Status: <strong>{submittedQuote.status}</strong>.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
