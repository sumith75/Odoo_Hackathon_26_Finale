import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  PackageCheck,
  Boxes,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Split,
  ChevronRight,
} from 'lucide-react';

export default function FulfillmentView({ onNavigate }) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterTab, setFilterTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFulfillments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/finance/fulfillment');
      if (res.success) {
        setQuotations(res.data || []);
      } else {
        setError(res.error?.message || 'Failed to load fulfillment queue');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to fulfillment service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFulfillments();
  }, []);

  const filteredQuotes = quotations.filter((q) => {
    // Search query filter
    const matchesSearch =
      q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    // Tab filter
    if (filterTab === 'PENDING') {
      return matchesSearch && (q.fulfillmentStatus === 'PENDING' || !q.fulfillmentStatus);
    }
    if (filterTab === 'ALLOCATED') {
      return matchesSearch && (q.fulfillmentStatus === 'ALLOCATED' || q.fulfillmentStatus === 'PARTIALLY_FULFILLED');
    }
    if (filterTab === 'FULFILLED') {
      return matchesSearch && q.fulfillmentStatus === 'FULFILLED';
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Fulfillment & Inventory Dispatch
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Confirmed deal queue requiring multi-warehouse stock reservation and service delivery.
          </p>
        </div>
        <button
          onClick={fetchFulfillments}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Filters Bar ────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {[
            { id: 'ALL', label: 'All Deals', count: quotations.length },
            {
              id: 'PENDING',
              label: 'Pending Allocation',
              count: quotations.filter((q) => q.fulfillmentStatus === 'PENDING' || !q.fulfillmentStatus).length,
            },
            {
              id: 'ALLOCATED',
              label: 'In Fulfillment',
              count: quotations.filter((q) => q.fulfillmentStatus === 'ALLOCATED' || q.fulfillmentStatus === 'PARTIALLY_FULFILLED').length,
            },
            {
              id: 'FULFILLED',
              label: 'Fulfilled',
              count: quotations.filter((q) => q.fulfillmentStatus === 'FULFILLED').length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                filterTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search quote or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-green-600 focus:bg-white"
          />
        </div>
      </div>

      {/* ── Quotations Table ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && quotations.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-green-700" />
            <p className="text-xs font-medium">Fetching fulfillment queue...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 text-xs">
            <AlertTriangle size={20} className="mx-auto mb-1" />
            {error}
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <PackageCheck size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-semibold text-slate-700">No deals match criteria</p>
            <p className="text-[11px] text-slate-400 mt-1">Confirmed deals will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Quote #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Deal Value</th>
                  <th className="py-3 px-4">Line Items</th>
                  <th className="py-3 px-4">Allocation Status</th>
                  <th className="py-3 px-4">Fulfillment Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredQuotes.map((q) => {
                  const hasAllocations = q.warehouseAllocations && q.warehouseAllocations.length > 0;
                  const isSplit = hasAllocations && q.warehouseAllocations.length > 1;

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{q.quoteNumber}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{q.customer?.name}</div>
                        <div className="text-[11px] text-slate-400">{q.customer?.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">
                        ₹{Number(q.totalAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {q.items?.length || 0} product(s)
                      </td>
                      <td className="py-3.5 px-4">
                        {hasAllocations ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            {isSplit && <Split size={10} />}
                            {isSplit ? 'Split Allocated' : 'Allocated'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock size={10} /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            q.fulfillmentStatus === 'FULFILLED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : q.fulfillmentStatus === 'PARTIALLY_FULFILLED'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {q.fulfillmentStatus === 'FULFILLED' && <CheckCircle2 size={11} />}
                          {q.fulfillmentStatus || 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onNavigate('fulfillment-detail', q.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                        >
                          <span>Open Dossier</span>
                          <ChevronRight size={14} />
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
    </div>
  );
}
