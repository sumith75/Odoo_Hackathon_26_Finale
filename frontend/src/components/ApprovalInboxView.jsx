import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, RotateCcw, 
  MessageSquare, UserCheck, RefreshCw, Scale, Clock, ArrowRight
} from 'lucide-react';

export default function ApprovalInboxView({ onApproved }) {
  const [pendingQuotes, setPendingQuotes] = useState([]);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [managerNote, setManagerNote] = useState('Approved for strategic fleet acquisition concession.');
  const [approving, setApproving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/approvals/pending');
      const data = await res.json();
      if (data.success) {
        setPendingQuotes(data.pending_approvals);
        if (data.pending_approvals.length > 0 && !selectedQuote) {
          setSelectedQuote(data.pending_approvals[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleApprove = async () => {
    if (!selectedQuote) return;
    try {
      setApproving(true);
      const res = await fetch(`/api/approvals/${selectedQuote.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_role: 'SALES_MANAGER',
          reviewer_name: 'Vikram Mehta (VP Sales / Approver)',
          notes: managerNote
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchApprovals();
        setSelectedQuote(null);
        if (onApproved) onApproved(data.quote);
      }
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="badge badge-indigo">Sales Manager Role</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldCheck style={{ color: '#10b981' }} /> Manager Governance & Approval Queue
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Protect company margins and evaluate risky deals. Explains why a quotation requires approval before moving to Customer.
          </p>
        </div>
        <button onClick={fetchApprovals} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
          <RefreshCw size={14} /> Refresh Queue
        </button>
      </div>

      {pendingQuotes.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <CheckCircle2 size={48} style={{ color: '#10b981', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Approval Queue Clear!</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.35rem' }}>
            No quotes currently require manager sign-off. Switch to Sales Rep role to create a quote with &gt; 10% service discount.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
          {/* Pending Queue Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
              Requires Manager Approval ({pendingQuotes.length})
            </h4>
            {pendingQuotes.map(q => {
              const isSelected = selectedQuote?.id === q.id;
              const isNegotiation = q.status === 'NEGOTIATION' || q.current_step >= 10;

              return (
                <div 
                  key={q.id}
                  onClick={() => setSelectedQuote(q)}
                  className={`glass-card ${isSelected ? 'active' : ''}`}
                  style={{ 
                    cursor: 'pointer',
                    padding: '1rem',
                    borderLeft: isNegotiation ? '4px solid #f59e0b' : '4px solid #f43f5e',
                    background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>{q.quote_number}</span>
                    <span className="badge badge-rose">Risk: {q.risk_score || 82}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', marginTop: '0.25rem' }}>
                    {q.customer_name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                    <span>Deal Value:</span>
                    <strong style={{ color: '#f8fafc' }}>₹{Number(q.final_total || q.total).toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
                    <span>Status:</span>
                    <strong style={{ color: '#f43f5e' }}>{q.status}</strong>
                  </div>
                  {isNegotiation && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#fbbf24', fontWeight: '700' }}>
                      💬 Customer Counter-Offer Negotiation
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected Quote Risk Scorecard & Reason Breakdown (Section 2 & 9) */}
          {selectedQuote && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
                      Quotation Review: {selectedQuote.quote_number}
                    </h3>
                    <span className="badge badge-rose">{selectedQuote.status}</span>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    Customer: <strong>{selectedQuote.customer_name}</strong> • Account Tier: <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>GOLD</span> • Representative: <strong>{selectedQuote.sales_rep_name}</strong>
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Deal Value</div>
                  <div className="metric-number" style={{ fontSize: '1.6rem', color: '#6366f1' }}>
                    ₹{Number(selectedQuote.final_total || selectedQuote.total).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Exact Section 2 Risk Scorecard & Reason Box */}
              <div style={{ 
                background: 'rgba(244, 63, 94, 0.08)', 
                border: '1px solid rgba(244, 63, 94, 0.3)', 
                borderRadius: '10px', 
                padding: '1.25rem',
                borderLeft: '5px solid #f43f5e'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={20} style={{ color: '#f43f5e' }} />
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: '#fda4af' }}>
                      WHY APPROVAL IS REQUIRED (Risk Score: {selectedQuote.risk_score || 82}/100 • Level: HIGH)
                    </h4>
                  </div>
                  <span className="badge badge-rose">Manager Approval Required</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Service Discount Requested:</div>
                    <strong style={{ fontSize: '1.1rem', color: '#f43f5e' }}>18%</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Allowed Service Discount:</div>
                    <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>10%</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Excess Discount:</div>
                    <strong style={{ fontSize: '1.1rem', color: '#f59e0b' }}>+8% Excess</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Action Mandate:</div>
                    <strong style={{ fontSize: '0.9rem', color: '#fda4af' }}>Manager Sign-Off</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: '#ffe4e6' }}>
                  <div>• <strong>Rule Breach:</strong> Installation Service discount of 18% exceeds allowed Gold tier limit of 10% by 8%.</div>
                  <div>• <strong>Margin Impact:</strong> Profitability impact calculated across total contract value.</div>
                  <div>• <strong>Governance Policy:</strong> Sales Representative cannot bypass this approval.</div>
                </div>
              </div>

              {/* Approval Timeline Visualization (Section 9) */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={14} /> APPROVAL AUDIT TIMELINE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                  <span style={{ color: '#a5b4fc', fontWeight: '600' }}>1. Quote Created</span>
                  <ArrowRight size={12} style={{ color: '#64748b' }} />
                  <span style={{ color: '#f43f5e', fontWeight: '600' }}>2. Risk Detected (82/100)</span>
                  <ArrowRight size={12} style={{ color: '#64748b' }} />
                  <span style={{ color: '#f59e0b', fontWeight: '600' }}>3. Manager Sign-Off Requested</span>
                  <ArrowRight size={12} style={{ color: '#64748b' }} />
                  <span style={{ color: '#94a3b8' }}>4. Sent to Customer</span>
                </div>
              </div>

              {/* Action Buttons: Approve, Reject, Return (Section 2 & 8) */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <MessageSquare size={15} /> Manager Approval Note:
                </label>
                <textarea 
                  rows={2}
                  value={managerNote}
                  onChange={e => setManagerNote(e.target.value)}
                  className="form-input"
                  style={{ resize: 'none' }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button className="btn btn-outline" style={{ borderColor: '#f59e0b', color: '#fbbf24' }}>
                    <RotateCcw size={15} /> Return for Modification
                  </button>
                  <button className="btn btn-outline" style={{ borderColor: '#f43f5e', color: '#fda4af' }}>
                    <XCircle size={15} /> Reject
                  </button>
                  <button 
                    onClick={handleApprove} 
                    disabled={approving}
                    className="btn btn-success"
                    style={{ padding: '0.65rem 1.5rem' }}
                  >
                    <CheckCircle2 size={18} />
                    {approving ? 'Recording Decision...' : selectedQuote.status === 'NEGOTIATION' ? 'Approve Customer Counter-Offer' : 'Approve Concession (Manager Approved)'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
