import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  Building2,
  ArrowRight,
  AlertCircle,
  Clock,
  Handshake,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

const STATUS_TABS = [
  { id: 'ALL', label: 'All Quotes' },
  { id: 'AWAITING_RESPONSE', label: 'Awaiting Your Response' },
  { id: 'UNDER_NEGOTIATION', label: 'Under Negotiation' },
  { id: 'CONFIRMED', label: 'Confirmed Orders' },
  { id: 'EXPIRED', label: 'Expired' },
];

export default function CustomerQuotesList({ initialStatus = 'ALL', onOpenQuote }) {
  const [activeTab, setActiveTab] = useState(initialStatus);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    setActiveTab(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    loadQuotes();
  }, [activeTab, search]);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `?status=${activeTab}`;
      if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetchWithAuth(`/api/customer/quotes${query}`);
      if (res.success && Array.isArray(res.data)) {
        setQuotes(res.data);
      } else {
        setError(res.error?.message || 'Failed to fetch quotations.');
      }
    } catch (err) {
      setError(err.message || 'Error fetching quotes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            My Quotations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Access and inspect all commercial proposals and contracts issued to your company.
          </p>
        </div>

        <button
          onClick={loadQuotes}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-green-700' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Filter Tabs & Search Bar ────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-green-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by quote number..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-700 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── Quotes List ─────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-semibold">Filtering your quotations...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={loadQuotes} className="font-bold underline cursor-pointer">
            Try again
          </button>
        </div>
      ) : quotes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <FileText size={36} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Quotations Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search
              ? 'No quotation matches your search query. Try clearing the search bar.'
              : 'You do not have any quotations matching the selected status filter.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Quote Number</th>
                  <th className="px-5 py-3.5">Seller & Contact</th>
                  <th className="px-5 py-3.5">Created Date</th>
                  <th className="px-5 py-3.5">Valid Until</th>
                  <th className="px-5 py-3.5 text-right">Total Amount</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((q) => {
                  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (q.displayStatus === 'CONFIRMED') badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  if (q.displayStatus === 'AWAITING YOUR RESPONSE') badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
                  if (q.displayStatus === 'UNDER NEGOTIATION' || q.displayStatus === 'SELLER REVIEWING') badgeClass = 'bg-purple-100 text-purple-800 border-purple-200';
                  if (q.displayStatus === 'EXPIRED') badgeClass = 'bg-red-100 text-red-800 border-red-200';

                  const currency = q.currency === 'USD' ? '$' : '₹';

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-slate-900 block text-xs">{q.quoteNumber}</span>
                        <span className="text-[11px] text-slate-400">
                          {q.items?.length || 0} product line{q.items?.length === 1 ? '' : 's'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800">{q.seller?.organizationName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <span>Rep: {q.seller?.salesRepName || 'Sales Rep'}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-4">
                        {q.validUntil ? (
                          <div className={`text-xs ${q.isExpired ? 'text-red-700 font-bold' : 'text-slate-600'}`}>
                            {new Date(q.validUntil).toLocaleDateString()}
                            {q.isExpired && <span className="block text-[10px] text-red-600">Expired</span>}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="font-bold text-slate-900 text-sm">
                          {currency}{q.financials?.totalAmount?.toLocaleString()}
                        </span>
                        {q.financials?.discountAmount > 0 && (
                          <span className="block text-[10px] text-emerald-700 font-semibold">
                            Savings: {currency}{q.financials?.discountAmount?.toLocaleString()}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badgeClass}`}>
                          {q.displayStatus}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => onOpenQuote(q.id)}
                          className="px-3.5 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <span>{q.displayStatus === 'CONFIRMED' ? 'View Order' : 'Review & Act'}</span>
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
