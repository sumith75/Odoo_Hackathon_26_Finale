import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Inbox,
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Building2,
  RefreshCw,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

export default function ApprovalInbox({ onSelectQuote, apiBase = '/api/manager', title = 'Manager Approval Inbox' }) {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [statusTab, setStatusTab] = useState('PENDING'); // PENDING, APPROVED, REJECTED, RETURNED, ALL
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('priority');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [error, setError] = useState('');

  const loadApprovals = async (pageToLoad = currentPage) => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams({
        status: statusTab,
        sortBy,
        page: String(pageToLoad),
        limit: '25',
      });
      if (search.trim()) queryParams.set('search', search.trim());
      if (riskFilter !== 'ALL') queryParams.set('riskLevel', riskFilter);
      if (startDate) queryParams.set('startDate', startDate);
      if (endDate) queryParams.set('endDate', endDate);

      const res = await fetchWithAuth(`${apiBase}/approvals?${queryParams.toString()}`);
      if (res.success) {
        setQuotations(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
          setCurrentPage(res.pagination.page);
        }
      } else {
        setError(res.error?.message || 'Failed to retrieve approval inbox.');
      }
    } catch (err) {
      setError(err.message || 'Failed to communicate with approval service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals(1);
  }, [statusTab, riskFilter, sortBy, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadApprovals();
  };

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Evaluate quotations requiring commercial approval, discount ceiling overrides, and margin sign-offs
          </p>
        </div>

        <button
          onClick={loadApprovals}
          className="self-start sm:self-auto p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Status Tabs ───────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'PENDING', label: 'Pending Approvals', badgeColor: 'bg-amber-100 text-amber-900' },
          { id: 'APPROVED', label: 'Approved Deals', badgeColor: 'bg-emerald-100 text-emerald-900' },
          { id: 'RETURNED', label: 'In Revision', badgeColor: 'bg-blue-100 text-blue-900' },
          { id: 'REJECTED', label: 'Rejected', badgeColor: 'bg-rose-100 text-rose-900' },
          { id: 'ALL', label: 'All Quotations' },
        ].map((tab) => {
          const isActive = statusTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'border-green-700 text-green-800 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {tab.label}
              {isActive && quotations.length > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-black ${tab.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                  {quotations.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filter & Search Toolbar ────────────────────────────── */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
          <input
            type="text"
            placeholder="Search by quote # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 bg-slate-50"
          />
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </form>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <SlidersHorizontal size={13} className="text-slate-400" />
            <span>Risk Level:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-green-600"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="HIGH">High Risk (71–100)</option>
              <option value="MODERATE">Moderate Risk</option>
              <option value="LOW">Low Risk</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-green-600"
            />
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-green-600"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <ArrowUpDown size={13} className="text-slate-400" />
            <span>Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-green-600"
            >
              <option value="priority">Priority (High Risk + Oldest)</option>
              <option value="risk">Highest Risk First</option>
              <option value="value">Highest Quote Value</option>
              <option value="oldest">Oldest Pending First</option>
              <option value="newest">Newest Submitted</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Table / Content ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <RefreshCw className="w-8 h-8 text-green-700 animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading quotations...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-700 bg-red-50">
            <p className="font-bold">{error}</p>
          </div>
        ) : quotations.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400">
            <ShieldCheck size={36} className="mx-auto mb-2 text-green-600" />
            <p className="font-bold text-slate-700 text-sm">No quotations found</p>
            <p className="mt-1">There are no deals matching your current status and filter criteria.</p>
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
                  <th className="px-4 py-3 text-center">Discount</th>
                  <th className="px-4 py-3 text-center">Margin %</th>
                  <th className="px-4 py-3 text-center">Margin Delta</th>
                  <th className="px-4 py-3 text-center">Risk Score</th>
                  <th className="px-4 py-3">Violations</th>
                  <th className="px-4 py-3 text-center">Waiting</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((q) => {
                  const isHigh = q.riskLevel === 'HIGH';
                  const isModerate = q.riskLevel === 'MODERATE';
                  const marginDeltaNeg = (q.marginDeltaPercentage || 0) < 0;

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Quote # */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{q.quoteNumber}</span>
                          {q.isReapproval && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                              RE-APPROVAL
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{q.customer?.name}</div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          {q.customer?.companyName || q.customer?.name}
                          {q.customer?.tier && (
                            <span className="ml-1 px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-50 text-amber-800 border border-amber-200">
                              {q.customer.tier}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Sales Rep */}
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {q.salesRep?.name || 'Rahul'}
                      </td>

                      {/* Value */}
                      <td className="px-4 py-3 font-mono font-bold text-right text-slate-900 whitespace-nowrap">
                        {currency === 'INR' ? '₹' : '$'}
                        {Number(q.totalAmount).toLocaleString()}
                      </td>

                      {/* Total Discount */}
                      <td className="px-4 py-3 text-center font-mono text-slate-700 whitespace-nowrap">
                        {currency === 'INR' ? '₹' : '$'}
                        {Number(q.discountAmount).toLocaleString()}
                      </td>

                      {/* Margin % */}
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                        {q.marginPercentage}%
                      </td>

                      {/* Margin Delta */}
                      <td className="px-4 py-3 text-center font-mono font-bold whitespace-nowrap">
                        <span className={marginDeltaNeg ? 'text-red-600' : 'text-emerald-600'}>
                          {q.marginDeltaPercentage ? `${q.marginDeltaPercentage}%` : '0%'}
                        </span>
                      </td>

                      {/* Risk Score */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isHigh
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : isModerate
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {q.riskLevel} ({q.riskScore})
                        </span>
                      </td>

                      {/* Violations */}
                      <td className="px-4 py-3 max-w-xs">
                        {q.violationsCount > 0 ? (
                          <div className="text-[11px] text-red-700 font-medium truncate" title={q.violations?.map(v => `${v.productName}: applied ${v.appliedDiscount}% > ceiling ${v.maxAllowed}%`).join('; ')}>
                            <span className="font-bold text-red-800">{q.violationsCount} ceiling violation: </span>
                            {q.violations[0]?.productName} ({q.violations[0]?.appliedDiscount}% &gt; {q.violations[0]?.maxAllowed}%)
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Within ceilings</span>
                        )}
                      </td>

                      {/* Waiting Time */}
                      <td className="px-4 py-3 text-center font-mono text-slate-500 whitespace-nowrap">
                        {q.waitingTime || 'Just now'}
                      </td>

                      {/* Approval Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            q.approvalStatus === 'PENDING_MANAGER'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : q.approvalStatus === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : q.approvalStatus === 'REJECTED'
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : q.approvalStatus === 'RETURNED_FOR_REVISION'
                              ? 'bg-blue-100 text-blue-900 border border-blue-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {q.approvalStatus === 'PENDING_MANAGER' ? 'Pending Review' : q.approvalStatus}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onSelectQuote(q.id)}
                          className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                        >
                          Review Deal
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Footer ─────────────────────────────────── */}
        {!loading && quotations.length > 0 && pagination.totalPages > 1 && (
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing <span className="font-bold">{quotations.length}</span> of <span className="font-bold">{pagination.total}</span> quotations
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadApprovals(pagination.page - 1)}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <span className="font-bold text-slate-800">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadApprovals(pagination.page + 1)}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
