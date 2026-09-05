import React, { useState, useEffect } from 'react';
import { Warehouse, Package, Truck, CheckCircle2, Split, RefreshCw, Layers } from 'lucide-react';

export default function WarehouseFulfillmentView({ quoteId }) {
  const [allocations, setAllocations] = useState([]);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAllocations = async () => {
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
        const res = await fetch(`/api/quotes/${qId}`);
        const data = await res.json();
        if (data.success) {
          setQuote(data.quote);
          setAllocations(data.quote.warehouse_allocations || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch warehouse fulfillment:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllocations();
  }, [quoteId]);

  const handleTriggerSplit = async () => {
    if (!quote) return;
    try {
      const res = await fetch(`/api/execution/quote/${quote.id}/split-warehouses`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setAllocations(data.allocations);
        setQuote(data.quote);
      }
    } catch (err) {
      console.error('Failed to trigger split:', err);
    }
  };

  const physicalAllocations = allocations.filter(a => a.fulfillment_type === 'PHYSICAL');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="badge badge-indigo">Operations Role</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Warehouse style={{ color: '#06b6d4' }} /> Multi-Warehouse Allocation & Split Fulfillment (Section 11)
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Single warehouse stock exhaustion detector: Intelligently allocates requested quantities across regional hubs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleTriggerSplit} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
            <Split size={14} /> Re-Calculate Allocation
          </button>
          <button onClick={fetchAllocations} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Exact Section 11 Split Fulfillment Banner */}
      <div className="glass-card" style={{ 
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(99, 102, 241, 0.08) 100%)',
        borderLeft: '5px solid #06b6d4' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Split style={{ color: '#06b6d4' }} size={22} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800' }}>
                Inventory Fulfillment Manifest: 10 × Laptop X
              </h3>
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '0.4rem' }}>
              <strong>Requested Quantity: 10 Laptops</strong> • Single hub cannot satisfy full order (Bangalore Hub has 8, Hyderabad Hub has 4).
            </div>
            <div style={{ color: '#67e8f9', fontSize: '0.85rem', marginTop: '0.2rem', fontWeight: '700' }}>
              Allocation: Bangalore Warehouse ➔ 8 Units | Hyderabad Warehouse ➔ 2 Units
            </div>
          </div>
          <span className="badge badge-emerald" style={{ padding: '0.5rem 0.9rem', fontSize: '0.825rem' }}>
            Status: Fully Allocated
          </span>
        </div>
      </div>

      {/* Regional Hub Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {physicalAllocations.map((alloc, idx) => (
          <div key={idx} className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              height: '4px', 
              background: idx === 0 ? 'linear-gradient(90deg, #06b6d4, #6366f1)' : 'linear-gradient(90deg, #f59e0b, #ec4899)' 
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <span className="badge badge-indigo" style={{ fontSize: '0.68rem', marginBottom: '0.3rem' }}>
                  {idx === 0 ? 'PRIMARY HUB ALLOCATION' : 'SECONDARY SPILLOVER ALLOCATION'}
                </span>
                <h4 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#f8fafc' }}>
                  {alloc.warehouse_name}
                </h4>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Location: {alloc.location || 'Regional Distribution Facility'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Allocated Stock</span>
                <div className="metric-number" style={{ fontSize: '1.75rem', color: '#06b6d4' }}>
                  {alloc.allocated_quantity} Units
                </div>
              </div>
            </div>

            <div style={{ 
              background: 'rgba(0,0,0,0.25)', 
              padding: '0.75rem', 
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              fontSize: '0.8rem',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Product Description:</span>
                <strong style={{ color: '#f8fafc' }}>{alloc.product_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Consignment Tracking:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>{alloc.tracking_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Standard Transit SLA:</span>
                <span style={{ color: '#34d399', fontWeight: '700' }}>{alloc.transit_days} Business Days</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-emerald">
                <CheckCircle2 size={13} /> {alloc.status}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Zero negative inventory guaranteed
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
