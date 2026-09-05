import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  FileText,
  Clock,
  Handshake,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Building2,
  ExternalLink,
  DollarSign,
  Calendar,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

export default function CustomerDashboard({ onOpenQuote, onViewAllQuotes }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/api/customer/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error?.message || 'Failed to load dashboard.');
      }
    } catch (err) {
      setError(err.message || 'Network error loading dashboard.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading your deal room workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
        <button
          onClick={loadDashboard}
          className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded font-bold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats || {
    activeQuotes: 0,
    awaitingResponse: 0,
    underNegotiation: 0,
    confirmedQuotes: 0,
  };

  const currencySymbol = data?.customer?.currency === 'USD' ? '$' : '₹';

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Customer Deal Room
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">
              Partnering with {data?.customer?.organizationName || 'DealFlow360'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Welcome, {data?.customer?.name || 'Valued Customer'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review shared quotations, request delivery schedules, submit counter-offer discounts, and complete deal confirmations.
          </p>
        </div>

        <button
          onClick={onViewAllQuotes}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <FileText size={15} />
          <span>View All Quotes ({stats.totalShared || 0})</span>
        </button>
      </div>

      {/* ── 4 Top KPI Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Quotes */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Quotes</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <FileText size={16} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{stats.activeQuotes}</p>
          <span className="text-[11px] text-slate-400 font-medium">Valid open deals</span>
        </div>

        {/* Quotes Awaiting Response */}
        <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-xs bg-gradient-to-b from-amber-50/40 to-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Awaiting Your Response</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <p className="text-3xl font-black text-amber-900 mt-2">{stats.awaitingResponse}</p>
          <span className="text-[11px] text-amber-700 font-medium">Action requested</span>
        </div>

        {/* Under Negotiation */}
        <div className="bg-white border border-purple-200 rounded-xl p-5 shadow-xs bg-gradient-to-b from-purple-50/40 to-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Under Negotiation</span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
              <Handshake size={16} />
            </div>
          </div>
          <p className="text-3xl font-black text-purple-900 mt-2">{stats.underNegotiation}</p>
          <span className="text-[11px] text-purple-700 font-medium">Proposals under review</span>
        </div>

        {/* Confirmed Quotes */}
        <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-xs bg-gradient-to-b from-emerald-50/40 to-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Confirmed Deals</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-900 mt-2">{stats.confirmedQuotes}</p>
          <span className="text-[11px] text-emerald-700 font-medium">Signed & locked in</span>
        </div>
      </div>

      {/* ── Action Required: Quotes Awaiting Your Response ────────── */}
      {data?.actionRequired && data.actionRequired.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Quotations Awaiting Your Review
              </h2>
            </div>
            <span className="text-xs text-amber-800 bg-amber-100 font-bold px-2 py-0.5 rounded">
              {data.actionRequired.length} Pending
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.actionRequired.map((q) => (
              <div
                key={q.id}
                className="border border-slate-200 rounded-xl p-4 hover:border-green-600 hover:shadow-md transition-all flex flex-col justify-between bg-white"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-slate-800">{q.quoteNumber}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      {q.displayStatus}
                    </span>
                  </div>

                  <p className="text-lg font-black text-slate-900">
                    {currencySymbol}{q.financials?.totalAmount?.toLocaleString()}
                  </p>

                  <div className="text-[11px] text-slate-500 space-y-1 mt-2">
                    <p>
                      <span className="font-semibold text-slate-700">Representative:</span>{' '}
                      {q.seller?.salesRepName || 'Sales Rep'}
                    </p>
                    {q.validUntil && (
                      <p className="flex items-center gap-1 text-slate-500">
                        <Calendar size={12} className="text-slate-400" />
                        <span>Valid until {new Date(q.validUntil).toLocaleDateString()}</span>
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onOpenQuote(q.id)}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 bg-green-700 hover:bg-green-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <span>Review & Negotiate</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Quotations Table ───────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Recent Quotations
            </h2>
            <p className="text-xs text-slate-400">All proposals shared with your organization</p>
          </div>
          <button
            onClick={onViewAllQuotes}
            className="text-xs font-bold text-green-700 hover:text-green-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="px-5 py-3">Quote Number</th>
                <th className="px-5 py-3">Seller</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Valid Until</th>
                <th className="px-5 py-3 text-right">Total Amount</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!data?.recentQuotes || data.recentQuotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No quotations found.
                  </td>
                </tr>
              ) : (
                data.recentQuotes.map((q) => {
                  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (q.displayStatus === 'CONFIRMED') badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  if (q.displayStatus === 'AWAITING YOUR RESPONSE') badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
                  if (q.displayStatus === 'UNDER NEGOTIATION' || q.displayStatus === 'SELLER REVIEWING') badgeClass = 'bg-purple-100 text-purple-800 border-purple-200';
                  if (q.displayStatus === 'EXPIRED') badgeClass = 'bg-red-100 text-red-800 border-red-200';

                  return (
                    <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">{q.quoteNumber}</td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">
                        {q.seller?.organizationName || q.tenant?.name || '\u2014'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                        {currencySymbol}{q.financials?.totalAmount?.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badgeClass}`}>
                          {q.displayStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => onOpenQuote(q.id)}
                          className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
                        >
                          Review Quote
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
