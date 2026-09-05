import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  Receipt,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  CreditCard,
} from 'lucide-react';

export default function InvoicesView({ onNavigate }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterTab, setFilterTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/finance/invoices');
      if (res.success) {
        setInvoices(res.data || []);
      } else {
        setError(res.error?.message || 'Failed to fetch invoices');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to billing service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.quotation?.quoteNumber?.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterTab === 'UNPAID') {
      return matchesSearch && (inv.status === 'ISSUED' || inv.status === 'PARTIALLY_PAID');
    }
    if (filterTab === 'PAID') {
      return matchesSearch && inv.status === 'PAID';
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Invoices & Accounts Receivable
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Hybrid Capex and recurring subscription invoices with payment simulation and ledger reconciliation.
          </p>
        </div>
        <button
          onClick={fetchInvoices}
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
            { id: 'ALL', label: 'All Invoices', count: invoices.length },
            {
              id: 'UNPAID',
              label: 'Outstanding Due',
              count: invoices.filter((inv) => inv.status === 'ISSUED' || inv.status === 'PARTIALLY_PAID').length,
            },
            {
              id: 'PAID',
              label: 'Paid / Settled',
              count: invoices.filter((inv) => inv.status === 'PAID').length,
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
            placeholder="Search invoice, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-green-600 focus:bg-white"
          />
        </div>
      </div>

      {/* ── Invoices Table ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-green-700" />
            <p className="text-xs font-medium">Fetching invoices...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 text-xs">
            <AlertTriangle size={20} className="mx-auto mb-1" />
            {error}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Receipt size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-semibold text-slate-700">No invoices found</p>
            <p className="text-[11px] text-slate-400 mt-1">Generated invoices will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Deal Ref</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Due</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          inv.invoiceType === 'RECURRING'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {inv.invoiceType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{inv.customer?.name}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {inv.quotation?.quoteNumber || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900">
                      ₹{Number(inv.totalAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700">
                      ₹{Number(inv.amountPaid).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-amber-700">
                      ₹{Number(inv.amountDue).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {inv.status === 'PAID' ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onNavigate('invoice-detail', inv.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                      >
                        <span>View / Pay</span>
                        <ChevronRight size={14} />
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
