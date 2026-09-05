import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Edit,
  Eye,
  Tag,
  AlertTriangle,
  Building2,
  Calendar,
} from 'lucide-react';

const STATUS_CONFIG = {
  ALL: { label: 'All Statuses' },
  DRAFT: { label: 'Draft', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  PENDING_APPROVAL: { label: 'Pending Approval', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-50 text-red-800 border-red-200' },
  SENT_TO_CUSTOMER: { label: 'Sent to Customer', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function MyDealsView({ onOpenCPQForEdit, onNavigateToNewQuote, onViewQuote }) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');

  const currency = user?.currency || 'INR';

  const loadQuotes = async () => {
    setLoading(true);
    try {
      let query = '';
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (riskFilter !== 'ALL') params.append('riskLevel', riskFilter);
      if (searchTerm) params.append('search', searchTerm);

      const qs = params.toString();
      const res = await fetchWithAuth(`/api/quotations/my${qs ? `?${qs}` : ''}`);
      if (res.success) {
        setQuotes(res.data);
      }
    } catch (err) {
      console.error('Failed to load deals', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, [statusFilter, riskFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadQuotes();
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ──────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileText className="text-green-700" size={24} /> My Deals & Quotations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track quotation lifecycle, manager approval chains, and customer proposals.
          </p>
        </div>

        <button
          onClick={onNavigateToNewQuote}
          className="px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-xs"
        >
          <Plus size={16} /> + New Quotation
        </button>
      </div>

      {/* ── Search & Filters Bar ────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full lg:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by quote # or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
          />
        </form>

        <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'].map((sf) => (
              <button
                key={sf}
                onClick={() => setStatusFilter(sf)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === sf
                    ? 'bg-green-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {STATUS_CONFIG[sf]?.label || sf}
              </button>
            ))}
          </div>

          {/* Risk Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="LOW">Low Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="HIGH">High Risk</option>
          </select>

          <button
            onClick={loadQuotes}
            title="Reload list"
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Quotations Table ────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-green-700 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading quotations...</p>
          </div>
        ) : quotes.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <p className="mb-2">No quotations found matching criteria.</p>
            <button
              onClick={onNavigateToNewQuote}
              className="px-3.5 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800"
            >
              Create New Quote in CPQ Studio
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Quote Number</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Discount</th>
                  <th className="py-3.5 px-4">Margin</th>
                  <th className="py-3.5 px-4">Risk Level</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Last Updated</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {quotes.map((q) => {
                  const statusCfg = STATUS_CONFIG[q.status] || {
                    label: q.status,
                    cls: 'bg-slate-100 text-slate-700',
                  };
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {q.quoteNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {q.customer?.companyName || q.customer?.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Tier: <span className="font-semibold text-slate-600">{q.customer?.tier}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        {currency} {Number(q.totalAmount).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {currency} {Number(q.discountAmount).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold ${
                            parseFloat(q.marginPercentage) < 15
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {q.marginPercentage}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                            q.riskLevel === 'HIGH'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : q.riskLevel === 'MEDIUM'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {q.riskLevel} ({q.riskScore})
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.cls}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {new Date(q.updatedAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {q.status === 'DRAFT' && (
                            <button
                              onClick={() => onOpenCPQForEdit(q.id)}
                              className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded text-[11px] font-bold flex items-center gap-1 border border-green-200 transition-colors"
                              title="Resume editing in CPQ Studio"
                            >
                              <Edit size={12} /> Edit Draft
                            </button>
                          )}
                          <button
                            onClick={() => onViewQuote(q.id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            title="View quote details"
                          >
                            <Eye size={12} /> Details
                          </button>
                        </div>
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
