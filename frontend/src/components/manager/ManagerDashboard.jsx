import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Inbox,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  Clock,
  Building2,
  ShieldCheck,
  RefreshCw,
  Eye,
  Percent,
} from 'lucide-react';

export default function ManagerDashboard({ onNavigateToApprovals, onNavigateToQuote, onNavigateToDeals }) {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth('/api/manager/dashboard');
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error?.message || 'Failed to load manager dashboard.');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-green-700 animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-500">Loading Manager Governance Telemetry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-xs text-red-700">
        <p className="font-bold mb-2">Error Loading Dashboard</p>
        <p className="mb-4">{error}</p>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-red-700 text-white rounded-lg font-bold hover:bg-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const urgentQuotes = data?.urgentPendingQuotes || [];
  const recentApprovals = data?.recentApprovals || [];
  const riskDist = data?.riskDistribution || { low: 0, moderate: 0, elevated: 0, high: 0 };

  const totalPending = kpis.pendingApprovals || 0;

  return (
    <div className="space-y-6">
      {/* ── Page Header ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manager Approval Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time pipeline governance, discount risk mitigations, and commercial sign-offs
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDashboard}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors cursor-pointer"
            title="Refresh Metrics"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={onNavigateToApprovals}
            className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Inbox size={14} /> View Approval Inbox
          </button>
        </div>
      </div>

      {/* ── Top 6 KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Pending Approvals */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Approvals</span>
            <Inbox size={16} />
          </div>
          <div className="text-2xl font-black text-slate-900">{kpis.pendingApprovals ?? 0}</div>
          <p className="text-[10px] text-amber-700 font-semibold mt-1">Awaiting Manager Decision</p>
        </div>

        {/* High Risk Deals */}
        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-xs">
          <div className="flex items-center justify-between text-red-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">High Risk Deals</span>
            <AlertTriangle size={16} />
          </div>
          <div className="text-2xl font-black text-red-700">{kpis.highRiskDeals ?? 0}</div>
          <p className="text-[10px] text-red-600 font-semibold mt-1">Discount Limit Exceeded</p>
        </div>

        {/* Total Pending Value */}
        <div className="bg-white p-4 rounded-xl border border-green-200 shadow-xs">
          <div className="flex items-center justify-between text-green-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Value</span>
            <TrendingUp size={16} />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {currency === 'INR' ? '₹' : '$'}
            {kpis.totalPendingValue ? Number(kpis.totalPendingValue).toLocaleString() : '0'}
          </div>
          <p className="text-[10px] text-green-700 font-semibold mt-1">Total Quoted Volume</p>
        </div>

        {/* Approved Today */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Approved Today</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-2xl font-black text-emerald-800">{kpis.approvedToday ?? 0}</div>
          <p className="text-[10px] text-emerald-600 font-semibold mt-1">Sent to Customer</p>
        </div>

        {/* Rejected Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Rejected Today</span>
            <XCircle size={16} />
          </div>
          <div className="text-2xl font-black text-rose-700">{kpis.rejectedToday ?? 0}</div>
          <p className="text-[10px] text-slate-500 font-semibold mt-1">Declined Commercials</p>
        </div>

        {/* Returned for Revision */}
        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Revision</span>
            <RotateCcw size={16} />
          </div>
          <div className="text-2xl font-black text-blue-900">{kpis.returnedCount ?? 0}</div>
          <p className="text-[10px] text-blue-700 font-semibold mt-1">With Sales Rep</p>
        </div>
      </div>

      {/* ── Main Middle Section: Urgent Approvals + Risk Telemetry ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Urgent Quotations Requiring Immediate Action */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <h2 className="text-sm font-bold text-slate-800">Deals Requiring Immediate Attention</h2>
            </div>
            <button
              onClick={onNavigateToApprovals}
              className="text-xs font-bold text-green-700 hover:text-green-800 flex items-center gap-1 cursor-pointer"
            >
              View all ({kpis.pendingApprovals || 0}) <ArrowRight size={13} />
            </button>
          </div>

          {urgentQuotes.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <ShieldCheck size={32} className="mx-auto mb-2 text-green-600" />
              <p className="font-bold text-slate-700">Approval Inbox Clean</p>
              <p className="mt-0.5">No pending quotations requiring manager intervention.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Quotation #</th>
                    <th className="px-4 py-2.5">Customer</th>
                    <th className="px-4 py-2.5">Sales Rep</th>
                    <th className="px-4 py-2.5 text-right">Value</th>
                    <th className="px-4 py-2.5 text-center">Margin %</th>
                    <th className="px-4 py-2.5 text-center">Risk Level</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {urgentQuotes.map((q) => {
                    const isHigh = q.riskLevel === 'HIGH';
                    return (
                      <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {q.quoteNumber}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800">{q.customer?.name}</span>
                          {q.customer?.tier && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {q.customer.tier}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{q.salesRep?.name || 'Rahul'}</td>
                        <td className="px-4 py-3 font-mono font-bold text-right text-slate-900">
                          {currency === 'INR' ? '₹' : '$'}
                          {Number(q.totalAmount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700">
                          {q.marginPercentage}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isHigh
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {q.riskLevel} ({q.riskScore})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onNavigateToQuote(q.id)}
                            className="px-2.5 py-1 bg-green-700 hover:bg-green-800 text-white rounded text-xs font-bold transition-colors cursor-pointer"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Col: Risk Distribution & Governance Rules */}
        <div className="space-y-6">
          {/* Risk Distribution Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Pending Risk Distribution
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span className="text-red-700">High Risk (71–100)</span>
                  <span>{riskDist.high} deal{riskDist.high !== 1 ? 's' : ''}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full transition-all"
                    style={{
                      width: totalPending > 0 ? `${(riskDist.high / totalPending) * 100}%` : '0%',
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span className="text-amber-700">Moderate / Elevated</span>
                  <span>{riskDist.moderate + riskDist.elevated} deals</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{
                      width:
                        totalPending > 0
                          ? `${((riskDist.moderate + riskDist.elevated) / totalPending) * 100}%`
                          : '0%',
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span className="text-emerald-700">Low Risk (0–20)</span>
                  <span>{riskDist.low} deal{riskDist.low !== 1 ? 's' : ''}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all"
                    style={{
                      width: totalPending > 0 ? `${(riskDist.low / totalPending) * 100}%` : '0%',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700">Authoritative Rule:</span> Quotes with applied discounts exceeding category ceilings require mandatory Manager sign-off.
            </div>
          </div>

          {/* Recent Decisions Feed */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Recent Approval Activity
            </h3>
            {recentApprovals.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No recent actions logged today.</p>
            ) : (
              <div className="space-y-3">
                {recentApprovals.map((act) => {
                  const isApprove = act.status === 'APPROVED';
                  const isReject = act.status === 'REJECTED';
                  return (
                    <div key={act.id} className="flex items-start gap-2.5 text-xs">
                      <div className="mt-0.5">
                        {isApprove && <CheckCircle2 size={15} className="text-emerald-600" />}
                        {isReject && <XCircle size={15} className="text-rose-600" />}
                        {!isApprove && !isReject && <RotateCcw size={15} className="text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 truncate">
                          {act.quotation?.quoteNumber || 'Quotation'} — {act.status}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          by {act.approver?.name || 'Manager'} • {act.reason || act.comment || 'Action recorded'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
