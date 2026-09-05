import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Briefcase,
  Search,
  Filter,
  Eye,
  RefreshCw,
  TrendingUp,
  Building2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export default function TeamDealsView({ onSelectQuote }) {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState('');

  const loadDeals = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (statusFilter !== 'ALL') query.set('status', statusFilter);

      const res = await fetchWithAuth(`/api/manager/deals?${query.toString()}`);
      if (res.success) {
        setDeals(res.data || []);
      } else {
        setError(res.error?.message || 'Failed to load team deals.');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeals();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadDeals();
  };

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Organization Team Deals</h1>
          <p className="text-xs text-slate-500 mt-1">
            Global pipeline visibility across all sales representatives and ongoing negotiations
          </p>
        </div>

        <button
          onClick={loadDeals}
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Deals</span>
        </button>
      </div>

      {/* ── Filter & Search Toolbar ────────────────────────────── */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-80 relative">
          <input
            type="text"
            placeholder="Search deals by quote # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-green-600 bg-slate-50"
          />
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </form>

        <div className="flex items-center gap-2 text-xs text-slate-600 w-full sm:w-auto">
          <span className="font-medium">Filter by Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-green-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved Deals</option>
            <option value="RETURNED_FOR_REVISION">In Revision</option>
            <option value="REJECTED">Rejected Deals</option>
            <option value="DRAFT">Drafts</option>
          </select>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <RefreshCw className="w-8 h-8 text-green-700 animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading team deals...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-700 bg-red-50">
            <p className="font-bold">{error}</p>
          </div>
        ) : deals.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400">
            <Briefcase size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-slate-700 text-sm">No deals found</p>
            <p className="mt-1">No quotations found matching your current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Quote #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Sales Rep</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-center">Margin %</th>
                  <th className="px-4 py-3 text-center">Risk Level</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Updated</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {deals.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{d.quoteNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{d.customer?.name}</div>
                      <div className="text-[11px] text-slate-400">{d.customer?.companyName}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{d.salesRep?.name}</td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-slate-900">
                      {currency === 'INR' ? '₹' : '$'}
                      {Number(d.totalAmount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700">
                      {d.marginPercentage}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          d.riskLevel === 'HIGH'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : d.riskLevel === 'MODERATE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {d.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-400 text-[11px]">
                      {new Date(d.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onSelectQuote(d.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
