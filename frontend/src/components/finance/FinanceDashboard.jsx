import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  PackageCheck,
  Receipt,
  Repeat,
  Warehouse,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Boxes,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react';

export default function FinanceDashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/finance/dashboard');
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error?.message || 'Failed to load dashboard metrics');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to finance service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw size={28} className="animate-spin text-green-700 mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Finance & Operations Telemetry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center max-w-lg mx-auto mt-10">
        <AlertTriangle size={32} className="text-red-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-red-900">Dashboard Unavailable</h3>
        <p className="text-xs text-red-700 mt-1 mb-4">{error}</p>
        <button
          onClick={fetchDashboard}
          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const recentFulfillments = data?.recentFulfillments || [];
  const recentInvoices = data?.recentInvoices || [];
  const warehouses = data?.warehouses || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Finance & Operations Command Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time warehouse stock allocation, deterministic fulfillment dispatch, and hybrid billing ledger.
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Data
        </button>
      </div>

      {/* ── Top Executive KPI Grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Allocations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Awaiting Allocation</span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <Boxes size={18} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">{kpis.pendingAllocationCount || 0}</div>
            <p className="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1">
              <Clock size={12} /> Confirmed deals needing inventory
            </p>
          </div>
        </div>

        {/* Card 2: In Fulfillment */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Fulfillment</span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <PackageCheck size={18} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">
              {(kpis.partiallyFulfilledCount || 0) + (kpis.fulfilledCount || 0)}
            </div>
            <p className="text-[11px] text-blue-700 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> {kpis.fulfilledCount || 0} fully fulfilled
            </p>
          </div>
        </div>

        {/* Card 3: Total Paid Revenue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Settled Cash Revenue</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <TrendingUp size={18} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-emerald-700">
              ₹{(kpis.totalPaidRevenue || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Due: ₹{(kpis.totalOutstandingDue || 0).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Card 4: Active Subscriptions & MRR */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recurring MRR</span>
            <span className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
              <Repeat size={18} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-purple-700">
              ₹{(kpis.monthlyRecurringRevenue || 0).toLocaleString('en-IN')}
              <span className="text-xs font-normal text-slate-500">/mo</span>
            </div>
            <p className="text-[11px] text-purple-600 font-medium mt-1">
              {kpis.activeSubscriptionsCount || 0} active subscriptions
            </p>
          </div>
        </div>
      </div>

      {/* ── Multi-Warehouse Inventory Status ────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Warehouse size={18} className="text-green-700" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Multi-Warehouse Stock Telemetry
            </h2>
          </div>
          <button
            onClick={() => onNavigate('warehouses')}
            className="text-xs font-semibold text-green-700 hover:text-green-800 flex items-center gap-1 cursor-pointer"
          >
            Manage Warehouses <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-200 text-slate-800">
                      {wh.code}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800">{wh.name}</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{wh.location}</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Priority {wh.priority}
                </span>
              </div>

              {/* Product Quantities */}
              <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                {wh.inventories && wh.inventories.length > 0 ? (
                  wh.inventories.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{inv.product?.name || 'Product'}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-emerald-700 font-bold">
                          {inv.availableQuantity} Avail
                        </span>
                        <span className="text-[11px] text-amber-700 font-bold">
                          {inv.allocatedQuantity} Alloc
                        </span>
                        <span className="text-[11px] text-blue-700 font-bold">
                          {inv.fulfilledQuantity} Fulfilled
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No inventory tracked</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-Column Queues (Fulfillment & Invoices) ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Queue: Confirmed Deals Needing Fulfillment */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageCheck size={18} className="text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Fulfillment Dispatch Queue
              </h2>
            </div>
            <button
              onClick={() => onNavigate('fulfillment')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              View All ({recentFulfillments.length}) <ArrowRight size={13} />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {recentFulfillments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No active confirmed deals in queue.
              </div>
            ) : (
              recentFulfillments.map((q) => (
                <div key={q.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{q.quoteNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          q.fulfillmentStatus === 'FULFILLED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : q.fulfillmentStatus === 'ALLOCATED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {q.fulfillmentStatus || 'PENDING'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{q.customer?.name || 'Customer'}</p>
                    <p className="text-[11px] text-slate-400">
                      {q.items?.length || 0} line items • Total: ₹{Number(q.totalAmount).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <button
                    onClick={() => onNavigate('fulfillment-detail', q.id)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-green-700 hover:text-white text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs"
                  >
                    Inspect Dossier
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Queue: Recent Invoices & Receivables */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Billing & Receivables
              </h2>
            </div>
            <button
              onClick={() => onNavigate('invoices')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
            >
              View All ({recentInvoices.length}) <ArrowRight size={13} />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {recentInvoices.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No invoices generated yet.
              </div>
            ) : (
              recentInvoices.map((inv) => (
                <div key={inv.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{inv.invoiceNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {inv.status}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">
                        {inv.invoiceType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{inv.customer?.name || 'Customer'}</p>
                    <p className="text-[11px] text-slate-500">
                      Total: ₹{Number(inv.totalAmount).toLocaleString('en-IN')} • Due: ₹{Number(inv.amountDue).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <button
                    onClick={() => onNavigate('invoice-detail', inv.id)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs"
                  >
                    View Invoice
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
