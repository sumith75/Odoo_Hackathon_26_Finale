import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, DollarSign, ShieldAlert, CheckCircle2, 
  Warehouse, Calendar, Clock, RefreshCw, Activity, ArrowUpRight, HeartPulse
} from 'lucide-react';

export default function DashboardView() {
  const [metrics, setMetrics] = useState(null);
  const [auditTimeline, setAuditTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard/metrics');
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
        setAuditTimeline(data.audit_timeline || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !metrics) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#94a3b8' }}>Loading deal health telemetry...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="badge badge-emerald">Executive & Management Intelligence</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <HeartPulse style={{ color: '#10b981' }} /> DealFlow360 Deal Health Dashboard (Section 21)
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Continuous lifecycle telemetry: monitors risk, governance approvals, fulfillment velocity, and recurring ARR realization.
          </p>
        </div>
        <button onClick={fetchDashboard} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
          <RefreshCw size={14} /> Refresh Telemetry
        </button>
      </div>

      {/* Section 21: Deal Health Status Card */}
      <div className="glass-card" style={{ 
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(99, 102, 241, 0.08) 100%)',
        borderLeft: '5px solid #10b981' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 style={{ color: '#10b981' }} size={22} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800' }}>
                Primary Deal: Acme Corporation (#DF360-1042)
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.6rem', fontSize: '0.85rem' }}>
              <span>Quote: <strong style={{ color: '#a7f3d0' }}>Completed</strong></span>
              <span>Approval: <strong style={{ color: '#a7f3d0' }}>Completed</strong></span>
              <span>Negotiation: <strong style={{ color: '#a7f3d0' }}>Completed</strong></span>
              <span>Fulfillment: <strong style={{ color: '#a7f3d0' }}>100% Split Fulfilled</strong></span>
              <span>Payment: <strong style={{ color: '#a7f3d0' }}>Paid in Full</strong></span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
              OVERALL DEAL HEALTH
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
              <span className="badge badge-emerald" style={{ fontSize: '1rem', padding: '0.4rem 1rem' }}>
                ● HEALTHY
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards in INR ₹ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700' }}>
            <span>CLOSED WON REVENUE</span>
            <ArrowUpRight size={16} style={{ color: '#10b981' }} />
          </div>
          <div className="metric-number" style={{ fontSize: '1.8rem', color: '#34d399', margin: '0.4rem 0' }}>
            ₹{Number(metrics?.total_closed_won_value || 748900).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            {metrics?.deals_won || 1} Settled Corporate Accounts
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700' }}>
            <span>CONTRACTED ANNUAL ARR</span>
            <TrendingUp size={16} style={{ color: '#6366f1' }} />
          </div>
          <div className="metric-number" style={{ fontSize: '1.8rem', color: '#818cf8', margin: '0.4rem 0' }}>
            ₹{Number(metrics?.total_arr_contracted || 342000).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            MRR: ₹{Number(metrics?.total_mrr_contracted || 28500).toLocaleString()}/mo
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700' }}>
            <span>AVERAGE DEAL MARGIN</span>
            <Activity size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div className="metric-number" style={{ fontSize: '1.8rem', color: '#fbbf24', margin: '0.4rem 0' }}>
            {metrics?.average_deal_margin_pct || 27.8}%
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Governance Floor Policy: 25.0%
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700' }}>
            <span>FULFILLMENT COMPLETION</span>
            <Warehouse size={16} style={{ color: '#06b6d4' }} />
          </div>
          <div className="metric-number" style={{ fontSize: '1.8rem', color: '#38bdf8', margin: '0.4rem 0' }}>
            100%
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Bangalore (8) + Hyderabad (2)
          </span>
        </div>
      </div>

      {/* Middle Grid: Risk Health Distribution & Multi-Warehouse Stock */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Risk Distribution Card */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert style={{ color: '#f43f5e' }} size={18} />
            Governance & Risk Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span style={{ color: '#34d399', fontWeight: '600' }}>Safe Deals (&gt; 25% Margin)</span>
                <strong>{metrics?.risk_distribution?.safe || 1} Deals</strong>
              </div>
              <div className="margin-meter">
                <div className="margin-fill" style={{ width: '50%', backgroundColor: '#10b981' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span style={{ color: '#fb7185', fontWeight: '600' }}>High Risk (Excess Discount / Re-Checked)</span>
                <strong>{metrics?.risk_distribution?.high || 1} Deals</strong>
              </div>
              <div className="margin-meter">
                <div className="margin-fill" style={{ width: '82%', backgroundColor: '#f43f5e' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Warehouse Network Status */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Warehouse style={{ color: '#06b6d4' }} size={18} />
            Regional Hub Network Capacities
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.8rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>Bangalore Central Warehouse</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Bangalore, Karnataka • Transit: 2 Days</div>
              </div>
              <span className="badge badge-emerald">8 Units Dispatched</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.8rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>Hyderabad Logistics Hub</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Hyderabad, Telangana • Transit: 3 Days</div>
              </div>
              <span className="badge badge-emerald">2 Units Dispatched</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Audit Trail (Section 22) */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock style={{ color: '#6366f1' }} size={20} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>
              DealFlow360 Traceable Audit Trail (Section 22)
            </h3>
          </div>
          <span className="badge badge-indigo">Tamper-Evident Chronological Ledger</span>
        </div>

        {auditTimeline.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No audit events logged yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {auditTimeline.map((log, idx) => (
              <div key={idx} style={{ 
                background: 'rgba(0,0,0,0.25)', 
                borderLeft: '4px solid #6366f1', 
                padding: '0.75rem 1rem', 
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-indigo" style={{ fontSize: '0.68rem' }}>
                      Step {log.step_number || '•'}
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{log.action}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>by {log.actor}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                    {log.details}
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                  {new Date(log.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
