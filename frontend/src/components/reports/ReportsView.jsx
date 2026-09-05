import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchWithAuth } from '../../utils/api';
import {
  BarChart3,
  Download,
  Filter,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Package,
  Layers,
  ShieldCheck,
  Building2,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function ReportsView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [error, setError] = useState(null);

  // Active Tab: 'sales' | 'approvals' | 'products' | 'financial'
  const [activeTab, setActiveTab] = useState('sales');

  // Filter States
  const [period, setPeriod] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salesRepId, setSalesRepId] = useState('ALL');
  const [approvalStatus, setApprovalStatus] = useState('ALL');
  const [category, setCategory] = useState('ALL');

  // Data
  const [reportData, setReportData] = useState({
    summary: {},
    salesPerformance: [],
    approvals: [],
    products: [],
  });
  const [financialData, setFinancialData] = useState({
    invoices: [],
    payments: [],
    hybridBreakdown: {},
  });
  const [teamMembers, setTeamMembers] = useState([]);

  // Fetch Team members for Rep dropdown
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const res = await fetchWithAuth('/api/team');
        if (res.success && Array.isArray(res.data)) {
          setTeamMembers(res.data);
        }
      } catch {
        // Fallback: silently ignore if user lacks team view permission
      }
    };
    fetchTeam();
  }, []);

  // Build query string from active filters
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (period && period !== 'ALL') params.set('period', period);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (salesRepId && salesRepId !== 'ALL') params.set('salesRepId', salesRepId);
    if (approvalStatus && approvalStatus !== 'ALL') params.set('approvalStatus', approvalStatus);
    if (category && category !== 'ALL') params.set('category', category);
    return params.toString();
  }, [period, startDate, endDate, salesRepId, approvalStatus, category]);

  // Fetch Report Data
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString();
      const [salesRes, finRes] = await Promise.all([
        fetchWithAuth(`/api/reports/sales?${qs}`),
        fetchWithAuth(`/api/reports/financial?${qs}`),
      ]);

      if (salesRes.success) {
        setReportData(salesRes.data);
      } else {
        setError(salesRes.error?.message || 'Failed to load report data');
      }

      if (finRes.success) {
        setFinancialData(finRes.data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError(err.message || 'Error communicating with reporting service');
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Handle Preset Period Change
  const handlePeriodChange = (val) => {
    setPeriod(val);
    if (val !== 'CUSTOM') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleResetFilters = () => {
    setPeriod('ALL');
    setStartDate('');
    setEndDate('');
    setSalesRepId('ALL');
    setApprovalStatus('ALL');
    setCategory('ALL');
  };

  // Export PDF
  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      const token = localStorage.getItem('df360_token');
      const qs = buildQueryString();
      const response = await fetch(`/api/reports/export/pdf?${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to generate PDF export');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DealFlow360_Sales_Report_${new Date().toISOString().substring(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export PDF error:', err);
      alert(`Could not export PDF report: ${err.message}`);
    } finally {
      setExportingPdf(false);
    }
  };

  // Export XLSX
  const handleExportXlsx = async () => {
    try {
      setExportingXlsx(true);
      const token = localStorage.getItem('df360_token');
      const qs = buildQueryString();
      const response = await fetch(`/api/reports/export/xlsx?${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to generate XLSX spreadsheet export');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DealFlow360_Sales_Report_${new Date().toISOString().substring(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export XLSX error:', err);
      alert(`Could not export Excel spreadsheet: ${err.message}`);
    } finally {
      setExportingXlsx(false);
    }
  };

  const currency = user?.currency || 'INR';
  const formatCur = (val) => {
    const n = Number(val) || 0;
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const kpi = reportData.summary || {};

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header & Export Actions ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-bold">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Reports & Performance Analytics
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Server-side PostgreSQL analytics, sales performance breakdowns, and executive exports
              </p>
            </div>
          </div>
        </div>

        {/* Real Export Buttons (PDF / XLS required by hackathon spec) */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
          >
            {exportingPdf ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileText size={15} className="text-rose-400" />
            )}
            <span>Export PDF</span>
          </button>

          <button
            onClick={handleExportXlsx}
            disabled={exportingXlsx}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-700 text-white text-xs font-bold hover:bg-green-800 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
          >
            {exportingXlsx ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet size={15} className="text-green-200" />
            )}
            <span>Export XLS</span>
          </button>
        </div>
      </div>

      {/* ── Required Filters Bar ────────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter size={14} className="text-green-700" />
            <span>Reporting Filter Engine</span>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filter 1: Period Preset */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" />
              <span>Time Period</span>
            </label>
            <select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2.5 focus:ring-2 focus:ring-green-600 focus:bg-white outline-hidden cursor-pointer"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This Week (Last 7 Days)</option>
              <option value="THIS_MONTH">This Month (Current Month)</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
          </div>

          {/* Filter 2: Sales Team / Rep */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
              <User size={13} className="text-slate-400" />
              <span>Sales Team / Rep</span>
            </label>
            <select
              value={salesRepId}
              onChange={(e) => setSalesRepId(e.target.value)}
              disabled={user?.role === 'SALES_REP'}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2.5 focus:ring-2 focus:ring-green-600 focus:bg-white outline-hidden cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="ALL">All Sales Representatives</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Approval Status */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
              <CheckCircle2 size={13} className="text-slate-400" />
              <span>Approval Status</span>
            </label>
            <select
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2.5 focus:ring-2 focus:ring-green-600 focus:bg-white outline-hidden cursor-pointer"
            >
              <option value="ALL">All Approval States</option>
              <option value="APPROVED">Approved Deals</option>
              <option value="PENDING">Pending Approval</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Filter 4: Product / Category */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
              <Package size={13} className="text-slate-400" />
              <span>Product Category</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2.5 focus:ring-2 focus:ring-green-600 focus:bg-white outline-hidden cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="HARDWARE">Hardware Capex</option>
              <option value="SERVICE">Professional Services</option>
              <option value="SUBSCRIPTION">Recurring SLA Support</option>
              <option value="BUNDLE">Datacenter Bundles</option>
            </select>
          </div>
        </div>

        {/* Optional Custom Date Pickers */}
        {period === 'CUSTOM' && (
          <div className="pt-2 flex flex-wrap items-center gap-4 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2"
              />
            </div>
            <div className="self-end pb-1">
              <button
                onClick={fetchReports}
                className="px-4 py-2 bg-green-700 text-white rounded-lg text-xs font-bold hover:bg-green-800 cursor-pointer"
              >
                Apply Date Range
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Quotations</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-slate-900">{kpi.totalQuotes || 0}</span>
            <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
              {kpi.winRate || 0}% Won
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Confirmed Orders</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-emerald-600">{kpi.wonOrdersCount || 0}</span>
            <span className="text-xs font-bold text-slate-500">Won Deals</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quoted Pipeline</p>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-slate-900">{formatCur(kpi.totalQuotedValue)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Won Revenue</p>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-green-700">{formatCur(kpi.totalWonValue)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Approved Discounts</p>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-amber-600">{formatCur(kpi.totalDiscount)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Invoiced Total</p>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-slate-900">{formatCur(kpi.invoicedAmount)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Settled Cash (Paid)</p>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-emerald-700">{formatCur(kpi.paidAmount)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Due</p>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-rose-600">{formatCur(kpi.outstandingAmount)}</span>
          </div>
        </div>
      </div>

      {/* ── Report Tab Navigation ───────────────────────────────────────────── */}
      <div className="border-b border-slate-200 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'sales'
              ? 'border-green-700 text-green-800 bg-green-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Sales Performance
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'approvals'
              ? 'border-green-700 text-green-800 bg-green-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Approvals & Risk
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'products'
              ? 'border-green-700 text-green-800 bg-green-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Products & Categories
        </button>

        <button
          onClick={() => setActiveTab('financial')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'financial'
              ? 'border-green-700 text-green-800 bg-green-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Financials & Billing
        </button>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <div className="w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Querying PostgreSQL Aggregations...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-medium">
          {error}
        </div>
      ) : (
        <>
          {/* TAB 1: Sales Performance Table */}
          {activeTab === 'sales' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Sales Representative Performance Matrix
                </span>
                <span className="text-xs text-slate-500">
                  {reportData.salesPerformance?.length || 0} active representatives
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Representative</th>
                      <th className="p-3.5 text-right">Quotes</th>
                      <th className="p-3.5 text-right">Approved</th>
                      <th className="p-3.5 text-right">Won</th>
                      <th className="p-3.5 text-right">Win Rate</th>
                      <th className="p-3.5 text-right">Quoted Value</th>
                      <th className="p-3.5 text-right">Won Revenue</th>
                      <th className="p-3.5 text-right">Discounts</th>
                      <th className="p-3.5 text-right">Avg Discount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {reportData.salesPerformance?.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                          No sales performance data matches active filters.
                        </td>
                      </tr>
                    ) : (
                      reportData.salesPerformance?.map((rep) => (
                        <tr key={rep.repId} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5">
                            <p className="font-bold text-slate-900">{rep.repName}</p>
                            <p className="text-[11px] text-slate-400">{rep.repEmail}</p>
                          </td>
                          <td className="p-3.5 text-right font-bold text-slate-800">{rep.quotesCount}</td>
                          <td className="p-3.5 text-right text-emerald-700 font-bold">{rep.approvedCount}</td>
                          <td className="p-3.5 text-right text-green-700 font-bold">{rep.wonCount}</td>
                          <td className="p-3.5 text-right">
                            <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-slate-100 text-slate-800">
                              {rep.winRate}%
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-bold text-slate-800">
                            {formatCur(rep.totalQuotedValue)}
                          </td>
                          <td className="p-3.5 text-right font-bold text-emerald-700">
                            {formatCur(rep.totalWonValue)}
                          </td>
                          <td className="p-3.5 text-right text-amber-700">{formatCur(rep.totalDiscount)}</td>
                          <td className="p-3.5 text-right text-slate-600">{rep.avgDiscountPct}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Approvals & Risk Telemetry */}
          {activeTab === 'approvals' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Recent Quotation Approvals & Risk Stream
                </span>
                <span className="text-xs text-slate-500">
                  Showing top {reportData.approvals?.length || 0} quotes
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Quote #</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Sales Rep</th>
                      <th className="p-3.5">Risk Score</th>
                      <th className="p-3.5">Approval Status</th>
                      <th className="p-3.5">Approver</th>
                      <th className="p-3.5 text-right">Deal Value</th>
                      <th className="p-3.5 text-right">Discount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {reportData.approvals?.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                          No approval records match active filters.
                        </td>
                      </tr>
                    ) : (
                      reportData.approvals?.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900">{app.quoteNumber}</td>
                          <td className="p-3.5">
                            <span className="font-bold text-slate-800">{app.customerName}</span>
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {app.customerTier}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600">{app.salesRepName}</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                app.riskScore > 60
                                  ? 'bg-rose-100 text-rose-800'
                                  : app.riskScore > 30
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {app.riskScore}/100 ({app.riskLevel})
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                app.approvalStatus === 'APPROVED'
                                  ? 'bg-green-100 text-green-800'
                                  : app.approvalStatus === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {app.approvalStatus}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600">{app.approverName}</td>
                          <td className="p-3.5 text-right font-bold text-slate-900">{formatCur(app.totalAmount)}</td>
                          <td className="p-3.5 text-right text-amber-700">{formatCur(app.discountAmount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Products & Categories */}
          {activeTab === 'products' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Product Sales Volume & Discount Impact
                </span>
                <span className="text-xs text-slate-500">
                  {reportData.products?.length || 0} products analyzed
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Product Name</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5 text-right">Quoted Volume</th>
                      <th className="p-3.5 text-right">Sold Units</th>
                      <th className="p-3.5 text-right">Gross Quoted Value</th>
                      <th className="p-3.5 text-right">Discount Given</th>
                      <th className="p-3.5 text-right">Net Revenue</th>
                      <th className="p-3.5 text-right">Discount %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {reportData.products?.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                          No product sales records match active filters.
                        </td>
                      </tr>
                    ) : (
                      reportData.products?.map((prod) => (
                        <tr key={prod.productId} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900">{prod.productName}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-teal-800">
                              {prod.category}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-bold text-slate-800">{prod.quantityQuoted}</td>
                          <td className="p-3.5 text-right font-bold text-green-700">{prod.quantitySold}</td>
                          <td className="p-3.5 text-right font-medium text-slate-600">
                            {formatCur(prod.grossValue)}
                          </td>
                          <td className="p-3.5 text-right text-amber-700">{formatCur(prod.discountAmount)}</td>
                          <td className="p-3.5 text-right font-bold text-emerald-700">
                            {formatCur(prod.netValue)}
                          </td>
                          <td className="p-3.5 text-right text-slate-600">{prod.discountPct}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Financials & Billing */}
          {activeTab === 'financial' && (
            <div className="space-y-6">
              {/* Hybrid Billing Breakdown Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">One-Time Capex Revenue</p>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {formatCur(financialData.hybridBreakdown?.totalOneTime)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Hardware & Professional Services</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <p className="text-[11px] font-bold text-purple-700 uppercase">Recurring MRR</p>
                  <p className="text-xl font-black text-purple-900 mt-1">
                    {formatCur(financialData.hybridBreakdown?.totalRecurringMRR)}
                  </p>
                  <p className="text-[11px] text-purple-400 mt-0.5">Active Monthly Subscriptions</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <p className="text-[11px] font-bold text-purple-700 uppercase">Contracted ARR</p>
                  <p className="text-xl font-black text-purple-900 mt-1">
                    {formatCur(financialData.hybridBreakdown?.totalRecurringARR)}
                  </p>
                  <p className="text-[11px] text-purple-400 mt-0.5">Annualized Recurring Run-Rate</p>
                </div>
              </div>

              {/* Invoices List */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Issued Invoices & Settlement Ledger
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">Invoice #</th>
                        <th className="p-3.5">Customer</th>
                        <th className="p-3.5">Issue Date</th>
                        <th className="p-3.5">Due Date</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Total</th>
                        <th className="p-3.5 text-right">Amount Paid</th>
                        <th className="p-3.5 text-right">Amount Due</th>
                        <th className="p-3.5 text-center">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {financialData.invoices?.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400">
                            No invoices generated yet.
                          </td>
                        </tr>
                      ) : (
                        financialData.invoices?.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 font-bold text-slate-900">{inv.invoiceNumber}</td>
                            <td className="p-3.5 font-semibold text-slate-800">{inv.customerName}</td>
                            <td className="p-3.5 text-slate-500">{inv.issueDate.substring(0, 10)}</td>
                            <td className="p-3.5 text-slate-500">{inv.dueDate.substring(0, 10)}</td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  inv.status === 'PAID'
                                    ? 'bg-green-100 text-green-800'
                                    : inv.status === 'PARTIALLY_PAID'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-right font-bold text-slate-900">{formatCur(inv.totalAmount)}</td>
                            <td className="p-3.5 text-right font-bold text-green-700">{formatCur(inv.amountPaid)}</td>
                            <td className="p-3.5 text-right font-bold text-rose-600">{formatCur(inv.amountDue)}</td>
                            <td className="p-3.5 text-center">
                              <a
                                href={`/api/invoices/${inv.id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded cursor-pointer"
                              >
                                <FileText size={12} className="text-rose-500" />
                                <span>PDF</span>
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
