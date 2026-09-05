import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  PlusCircle,
  ArrowRight,
  RefreshCw,
  Tag,
  Building2,
} from 'lucide-react';

const STATUS_BADGE = {
  DRAFT: { label: 'Draft', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  PENDING_APPROVAL: { label: 'Pending Approval', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-50 text-red-800 border-red-200' },
  SENT_TO_CUSTOMER: { label: 'Sent to Customer', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  NEGOTIATION: { label: 'Negotiation', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function SalesDashboard({ onNavigateToCPQ, onNavigateToDeals, onViewQuote }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth('/api/sales/dashboard');
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.message || 'Failed to load sales metrics');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const currency = user?.currency || 'INR';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-green-700 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading your sales pipeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
        <p className="font-bold">Error loading dashboard</p>
        <p className="mt-1">{error}</p>
        <button
          onClick={loadDashboard}
          className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { summary, recentDeals } = data || {};

  return (
    <div className="space-y-6">
      {/* ── Welcome Header ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
              Sales Workspace
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Representative: {user?.name}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            Quotations & Pipeline Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure multi-item commercial proposals, evaluate live margins, and manage deals from quote to cash.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDashboard}
            title="Refresh metrics"
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={onNavigateToCPQ}
            className="px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <PlusCircle size={16} /> + Create New Quote
          </button>
        </div>
      </div>

      {/* ── Metric Cards Grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Quoted Value */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Quoted Value</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-green-700 flex items-center justify-center">
              <DollarSign size={17} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">
              {currency}{' '}
              {Number(summary?.totalQuotedValue || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Pipeline potential: {currency} {Number(summary?.potentialRevenue || 0).toLocaleString()}
          </div>
        </div>

        {/* Active Deals */}
        <div
          onClick={onNavigateToDeals}
          className="bg-white border border-slate-200 hover:border-green-600 p-5 rounded-xl shadow-xs cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Deals</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <FileText size={17} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{summary?.totalQuotes || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">quotes</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-600 flex items-center gap-2">
            <span>{summary?.draftCount || 0} Drafts</span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold">{summary?.approvedCount || 0} Approved</span>
          </div>
        </div>

        {/* Pending Approval */}
        <div
          onClick={onNavigateToDeals}
          className="bg-white border border-slate-200 hover:border-amber-600 p-5 rounded-xl shadow-xs cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Approval</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Clock size={17} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-700">{summary?.pendingApprovalCount || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">in review</span>
          </div>
          <div className="mt-1.5 text-xs text-amber-700 font-medium">
            Waiting on Sales Manager sign-off
          </div>
        </div>

        {/* At-Risk Deals */}
        <div
          onClick={onNavigateToDeals}
          className="bg-white border border-slate-200 hover:border-red-600 p-5 rounded-xl shadow-xs cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">At-Risk Deals</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-700 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors">
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-red-700">{summary?.atRiskCount || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">high risk</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Discounts exceeding corporate ceilings
          </div>
        </div>
      </div>

      {/* ── Quotation Pipeline Stages Breakdown ───────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quotation Pipeline Stages</h3>
          <span className="text-[11px] text-slate-400">Total Lifecycle Distribution</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500 block">Drafts</span>
            <span className="text-base font-bold text-slate-900">{summary?.draftCount || 0}</span>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
            <span className="text-xs text-amber-700 block">In Review</span>
            <span className="text-base font-bold text-amber-800">{summary?.pendingApprovalCount || 0}</span>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
            <span className="text-xs text-emerald-700 block">Approved</span>
            <span className="text-base font-bold text-emerald-800">{summary?.approvedCount || 0}</span>
          </div>
          <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-xs text-blue-700 block">Sent to Customer</span>
            <span className="text-base font-bold text-blue-800">{summary?.sentToCustomerCount || 0}</span>
          </div>
          <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
            <span className="text-xs text-purple-700 block">Negotiation</span>
            <span className="text-base font-bold text-purple-800">{summary?.negotiationCount || 0}</span>
          </div>
          <div className="p-2.5 bg-teal-50 rounded-lg border border-teal-200">
            <span className="text-xs text-teal-700 block">Confirmed</span>
            <span className="text-base font-bold text-teal-800">{summary?.customerConfirmedCount || 0}</span>
          </div>
          <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-200">
            <span className="text-xs text-indigo-700 block">Fulfillment</span>
            <span className="text-base font-bold text-indigo-800">{summary?.fulfillmentCount || 0}</span>
          </div>
        </div>
      </div>

      {/* ── Recent Deals Table ─────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Quotations & Deals</h2>
            <p className="text-xs text-slate-500">Latest proposals built in CPQ Studio</p>
          </div>
          <button
            onClick={onNavigateToDeals}
            className="text-xs font-bold text-green-700 hover:text-green-800 flex items-center gap-1"
          >
            View All Deals <ArrowRight size={13} />
          </button>
        </div>

        {recentDeals && recentDeals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">Quote #</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Items</th>
                  <th className="py-3 px-3">Total Value</th>
                  <th className="py-3 px-3">Margin</th>
                  <th className="py-3 px-3">Risk</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {recentDeals.map((quote) => {
                  const statusBadge = STATUS_BADGE[quote.status] || {
                    label: quote.status,
                    cls: 'bg-slate-100 text-slate-700',
                  };
                  return (
                    <tr key={quote.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {quote.quoteNumber}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">
                          {quote.customer?.companyName || quote.customer?.name || 'Customer'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Tier: {quote.customer?.tier || 'BRONZE'}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-600">
                        {quote._count?.items || 0} line items
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 font-mono">
                        {currency} {Number(quote.totalAmount).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-semibold ${
                            parseFloat(quote.marginPercentage) < 15
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {quote.marginPercentage}%
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                            quote.riskLevel === 'HIGH'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : quote.riskLevel === 'MEDIUM'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {quote.riskLevel} ({quote.riskScore}/100)
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.cls}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => onViewQuote(quote.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 text-xs">
            <p className="mb-2">No quotations created yet.</p>
            <button
              onClick={onNavigateToCPQ}
              className="px-3.5 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800"
            >
              Build Your First Quote in CPQ Studio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
