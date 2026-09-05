import React, { useState, useEffect } from 'react';
import { Settings, Shield, Sliders, Warehouse, Package, RefreshCw, Save, CheckCircle2 } from 'lucide-react';

export default function AdminView({ onRulesUpdated }) {
  const [rules, setRules] = useState({
    hardware_max_discount: 15,
    service_max_discount: 10,
    subscription_max_discount: 5,
    min_margin_pct: 25,
    customerTier: 'GOLD',
    name: 'Gold Tier CPQ Governance Policy'
  });
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [rulesRes, prodsRes, whRes] = await Promise.all([
        fetch('/api/admin/rules').then(r => r.json()),
        fetch('/api/admin/products').then(r => r.json()),
        fetch('/api/admin/warehouses').then(r => r.json())
      ]);

      if (rulesRes.success) setRules(rulesRes.rules);
      if (prodsRes.success) setProducts(prodsRes.products);
      if (whRes.success) setWarehouses(whRes.warehouses);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleSaveRules = async () => {
    try {
      const res = await fetch('/api/admin/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules)
      });
      const data = await res.json();
      if (data.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        if (onRulesUpdated) onRulesUpdated(data.rules);
      }
    } catch (err) {
      console.error('Failed to save rules:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="badge badge-indigo">Admin Role</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Settings style={{ color: '#6366f1' }} /> DealFlow360 System & Rule Configuration (Section 5 & 6)
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Configure the "rules of the world": define product pricing, tiered category discount limits, and multi-warehouse logistics.
          </p>
        </div>
        <button onClick={fetchAdminData} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
          <RefreshCw size={14} /> Refresh Catalog
        </button>
      </div>

      {/* Section 6: Category Discount Rule Engine */}
      <div className="glass-card" style={{ borderLeft: '5px solid #6366f1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield style={{ color: '#6366f1' }} size={20} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                Customer Tier Discount Rules (Section 6)
              </h3>
              <span className="badge badge-amber">Acme Corp: GOLD Tier</span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.825rem', marginTop: '0.2rem' }}>
              Rules enforce maximum allowed discretionary discounts per product category. Breaches automatically escalate to Manager approval.
            </p>
          </div>
          <button onClick={handleSaveRules} className="btn btn-primary" style={{ padding: '0.4rem 1rem' }}>
            {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {savedSuccess ? 'Saved Policy!' : 'Save Rule Policy'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {/* Hardware limit */}
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.825rem', fontWeight: '600', color: '#cbd5e1' }}>
                Hardware Max Discount:
              </label>
              <span className="metric-number" style={{ fontSize: '1.3rem', color: '#60a5fa' }}>
                {rules.hardware_max_discount}%
              </span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="30" 
              value={rules.hardware_max_discount}
              onChange={e => setRules({ ...rules, hardware_max_discount: Number(e.target.value) })}
            />
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem' }}>
              Applicable on Laptop X (Default: 15%)
            </div>
          </div>

          {/* Service limit */}
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.825rem', fontWeight: '600', color: '#cbd5e1' }}>
                Services Max Discount:
              </label>
              <span className="metric-number" style={{ fontSize: '1.3rem', color: '#f59e0b' }}>
                {rules.service_max_discount}%
              </span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="30" 
              value={rules.service_max_discount}
              onChange={e => setRules({ ...rules, service_max_discount: Number(e.target.value) })}
            />
            <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.3rem' }}>
              18% discount triggers HIGH RISK 🚨 (Limit: 10%)
            </div>
          </div>

          {/* Subscription limit */}
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.825rem', fontWeight: '600', color: '#cbd5e1' }}>
                Subscription Max Discount:
              </label>
              <span className="metric-number" style={{ fontSize: '1.3rem', color: '#a855f7' }}>
                {rules.subscription_max_discount}%
              </span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="20" 
              value={rules.subscription_max_discount}
              onChange={e => setRules({ ...rules, subscription_max_discount: Number(e.target.value) })}
            />
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem' }}>
              Applicable on Premium Support (Default: 5%)
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Warehouse Hub Stock */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Warehouse style={{ color: '#06b6d4' }} size={20} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Warehouses & Live Inventory (Section 11)</h3>
          <span className="badge badge-emerald">Real-Time Hub Stock</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {warehouses.map(wh => (
            <div key={wh.id} style={{ 
              background: 'rgba(14, 20, 34, 0.7)', 
              border: '1px solid rgba(255,255,255,0.07)', 
              borderRadius: '10px', 
              padding: '1rem' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{wh.name}</span>
                <span className="badge badge-indigo">{wh.location}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                Standard Transit SLA: <strong>{wh.transit_days} Business Days</strong>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                {wh.inventory?.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.2rem 0' }}>
                    <span style={{ color: '#cbd5e1' }}>{item.product_name}</span>
                    <strong style={{ color: item.available_stock > 0 ? '#34d399' : '#f43f5e' }}>
                      {item.available_stock} in stock
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Catalog in INR ₹ */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Package style={{ color: '#a855f7' }} size={20} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Master Products & Pricing Catalog (Section 5)</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '0.6rem 0.8rem' }}>SKU</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Product Name</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Type</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Unit Cost</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Base List Price</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Billing Model</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>{p.sku}</td>
                  <td style={{ padding: '0.6rem 0.8rem', fontWeight: '600' }}>{p.name}</td>
                  <td style={{ padding: '0.6rem 0.8rem' }}>
                    <span className={`badge ${p.is_subscription ? 'badge-indigo' : p.category === 'SERVICE' ? 'badge-amber' : 'badge-emerald'}`}>
                      {p.category}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.8rem', color: '#94a3b8' }}>₹{p.unit_cost.toLocaleString()}</td>
                  <td style={{ padding: '0.6rem 0.8rem', fontWeight: '700' }}>₹{p.base_price.toLocaleString()}</td>
                  <td style={{ padding: '0.6rem 0.8rem', color: '#cbd5e1' }}>
                    {p.is_subscription ? `Recurring (${p.billing_frequency})` : 'One-Time Capex'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
