import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  PackageCheck,
  Boxes,
  Warehouse,
  Receipt,
  Repeat,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  RefreshCw,
  Split,
  Truck,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Wrench,
} from 'lucide-react';

export default function FulfillmentDetail({ quotationId, onNavigate, onBack }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const [backorderStatus, setBackorderStatus] = useState(null);
  const [overrideMode, setOverrideMode] = useState(false);
  const [warehousesList, setWarehousesList] = useState([]);
  const [overridePlan, setOverridePlan] = useState({}); // { [quotationItemId]: { [warehouseId]: qty } }

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/finance/fulfillment/${quotationId}`);
      if (res.success) {
        setQuote(res.data);
      } else {
        setError(res.error?.message || 'Failed to load quotation dossier');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to service');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackorderStatus = async () => {
    try {
      const res = await fetchWithAuth(`/api/finance/fulfillment/${quotationId}/backorder-status`);
      if (res.success) {
        setBackorderStatus(res.data);
      }
    } catch (err) {
      // Non-fatal — backorder banner just won't show
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchBackorderStatus();
  }, [quotationId]);

  // Action: Consolidate Remaining Backorder (stock has newly arrived)
  const handleConsolidateBackorder = async () => {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetchWithAuth(`/api/finance/fulfillment/${quotationId}/consolidate-backorder`, {
        method: 'POST',
      });
      if (res.success) {
        setActionSuccess(res.message || 'Backorder consolidated.');
        await fetchDetail();
        await fetchBackorderStatus();
      } else {
        setActionError(res.error?.message || 'Consolidation failed');
      }
    } catch (err) {
      setActionError(err.message || 'Error consolidating backorder');
    } finally {
      setActionLoading(false);
    }
  };

  // Load the full warehouse list (with current stock) when entering override mode
  const enterOverrideMode = async () => {
    setOverrideMode(true);
    setOverridePlan({});
    try {
      const res = await fetchWithAuth('/api/finance/warehouses');
      if (res.success) {
        setWarehousesList(res.data || []);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to load warehouse list for override');
    }
  };

  const setOverrideQty = (itemId, warehouseId, qty) => {
    setOverridePlan((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [warehouseId]: qty },
    }));
  };

  // Action: Apply a manually-specified warehouse split, overriding auto-allocation
  const handleApplyOverride = async () => {
    const manualAllocations = [];
    for (const [quotationItemId, byWarehouse] of Object.entries(overridePlan)) {
      for (const [warehouseId, qty] of Object.entries(byWarehouse)) {
        const quantity = parseInt(qty, 10);
        if (quantity > 0) {
          manualAllocations.push({ quotationItemId, warehouseId, quantity });
        }
      }
    }
    if (manualAllocations.length === 0) {
      setActionError('Enter at least one warehouse quantity before applying the override.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetchWithAuth(`/api/finance/fulfillment/${quotationId}/allocate-override`, {
        method: 'POST',
        body: JSON.stringify({ allocations: manualAllocations }),
      });
      if (res.success) {
        setActionSuccess(res.message || 'Allocation manually overridden.');
        setOverrideMode(false);
        setOverridePlan({});
        await fetchDetail();
        await fetchBackorderStatus();
      } else {
        setActionError(res.error?.message || 'Override failed');
      }
    } catch (err) {
      setActionError(err.message || 'Error applying manual override');
    } finally {
      setActionLoading(false);
    }
  };

  // Action 1: Auto-Allocate Inventory
  const handleAutoAllocate = async () => {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetchWithAuth(`/api/finance/fulfillment/${quotationId}/allocate`, {
        method: 'POST',
        body: JSON.stringify({ allowPartial: true }),
      });
      if (res.success) {
        setActionSuccess(res.message || 'Inventory allocated successfully.');
        await fetchDetail();
        await fetchBackorderStatus();
      } else {
        setActionError(res.error?.message || 'Allocation failed');
      }
    } catch (err) {
      setActionError(err.message || 'Error triggering allocation');
    } finally {
      setActionLoading(false);
    }
  };

  // Action 2: Complete Fulfillment (Physical + Services + Subscriptions)
  const handleCompleteFulfillment = async () => {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetchWithAuth(`/api/finance/fulfillment/${quotationId}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.success) {
        setActionSuccess(res.message || 'Fulfillment completed successfully.');
        await fetchDetail();
      } else {
        setActionError(res.error?.message || 'Fulfillment completion failed');
      }
    } catch (err) {
      setActionError(err.message || 'Error completing fulfillment');
    } finally {
      setActionLoading(false);
    }
  };

  // Action 3: Generate One-Time Capex Invoice
  const handleGenerateInvoice = async () => {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetchWithAuth(`/api/finance/invoices/${quotationId}/generate`, {
        method: 'POST',
      });
      if (res.success) {
        setActionSuccess(res.message || 'Invoice generated.');
        if (res.data?.invoice?.id) {
          onNavigate('invoice-detail', res.data.invoice.id);
        } else {
          await fetchDetail();
        }
      } else {
        setActionError(res.error?.message || 'Invoice generation failed');
      }
    } catch (err) {
      setActionError(err.message || 'Error generating invoice');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !quote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw size={28} className="animate-spin text-green-700 mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Deal Dossier...</p>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center max-w-lg mx-auto mt-10">
        <AlertTriangle size={32} className="text-red-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-red-900">Error Loading Dossier</h3>
        <p className="text-xs text-red-700 mt-1 mb-4">{error || 'Deal not found'}</p>
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 cursor-pointer"
        >
          Back to Queue
        </button>
      </div>
    );
  }

  const items = quote.items || [];
  const allocations = quote.warehouseAllocations || [];
  const hybrid = quote.hybridBilling || {};
  const hasAllocations = allocations.length > 0;
  const isFulfilled = quote.fulfillmentStatus === 'FULFILLED';
  const existingInvoice = quote.invoices?.find((inv) => inv.invoiceType === 'ONE_TIME');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer shadow-xs transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {quote.quoteNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                  isFulfilled
                    ? 'bg-emerald-100 text-emerald-800'
                    : hasAllocations
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {quote.fulfillmentStatus || 'PENDING ALLOCATION'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer: <span className="font-semibold text-slate-800">{quote.customer?.name}</span> • Rep: {quote.salesRep?.name}
            </p>
          </div>
        </div>

        {/* Global Action Feedback Alert */}
        {actionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2 font-medium">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2 font-medium">
            <ShieldAlert size={15} className="text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {/* ── Deal Overview Banner ───────────────────────────────── */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400">Total Value</span>
          <div className="text-lg font-black text-slate-900 mt-0.5">
            ₹{Number(quote.totalAmount).toLocaleString('en-IN')}
          </div>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400">One-Time Capex</span>
          <div className="text-lg font-black text-emerald-700 mt-0.5">
            ₹{Number(hybrid.oneTime?.totalAmount || 0).toLocaleString('en-IN')}
          </div>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400">Recurring Opex</span>
          <div className="text-lg font-black text-purple-700 mt-0.5">
            ₹{Number(hybrid.recurring?.mrr || 0).toLocaleString('en-IN')}/mo
          </div>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400">Billing Status</span>
          <div className="mt-1">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                quote.billingStatus === 'PAID'
                  ? 'bg-emerald-100 text-emerald-800'
                  : quote.billingStatus === 'INVOICED'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {quote.billingStatus || 'UNBILLED'}
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: Multi-Warehouse Auto-Allocation ────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-green-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                1. Multi-Warehouse Inventory Allocation
              </h2>
              <p className="text-[11px] text-slate-500">
                Deterministic stock allocation with automatic multi-warehouse split.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!hasAllocations ? (
              <button
                onClick={handleAutoAllocate}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Boxes size={14} />
                {actionLoading ? 'Allocating...' : 'Trigger Auto-Allocation'}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 size={13} />
                Allocated Across {allocations.length} Warehouse(s)
              </span>
            )}
            {!isFulfilled && (
              <button
                onClick={() => (overrideMode ? setOverrideMode(false) : enterOverrideMode())}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <Split size={14} />
                {overrideMode ? 'Cancel Override' : 'Override Split'}
              </button>
            )}
          </div>
        </div>

        {/* Consolidate Remaining Backorder Prompt */}
        {backorderStatus?.hasBackorder && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-orange-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-orange-900">
                  {backorderStatus.canConsolidateAny
                    ? 'Backordered Stock Has Arrived'
                    : 'Backorder Pending Restock'}
                </h4>
                <ul className="text-xs text-orange-700 mt-1 space-y-0.5">
                  {backorderStatus.items.map((it) => (
                    <li key={it.quotationItemId}>
                      {it.productName}: {it.backorderedQuantity} unit(s) backordered
                      {it.canConsolidate
                        ? ` — ${it.currentlyAvailableStock} now in stock, ready to consolidate`
                        : ' — awaiting restock'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {backorderStatus.canConsolidateAny && (
              <button
                onClick={handleConsolidateBackorder}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {actionLoading ? 'Consolidating...' : 'Consolidate Remaining Backorder'}
              </button>
            )}
          </div>
        )}

        {/* Manual Override Panel */}
        {overrideMode && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <p className="text-xs text-slate-600">
              Specify how many units of each hardware line should be pulled from each warehouse. This replaces the current allocation for that line.
            </p>
            {items
              .filter((item) => item.productTypeSnapshot === 'HARDWARE')
              .map((item) => (
                <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="text-xs font-bold text-slate-800 mb-2">
                    {item.productNameSnapshot} <span className="text-slate-400 font-normal">(needs {item.quantity})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {warehousesList.map((wh) => {
                      const stockForProduct = (wh.inventories || []).find((inv) => inv.productId === item.productId);
                      return (
                        <label key={wh.id} className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-slate-600 font-medium truncate">
                            {wh.name} <span className="text-slate-400">({stockForProduct?.availableQuantity ?? 0} avail.)</span>
                          </span>
                          <input
                            type="number"
                            min="0"
                            className="w-16 px-1.5 py-1 border border-slate-200 rounded text-xs"
                            value={overridePlan[item.id]?.[wh.id] || ''}
                            onChange={(e) => setOverrideQty(item.id, wh.id, e.target.value)}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            <button
              onClick={handleApplyOverride}
              disabled={actionLoading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? 'Applying...' : 'Apply Manual Override'}
            </button>
          </div>
        )}

        {/* Shortage Error Banner if occurred */}
        {actionError && actionError.includes('Insufficient') && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900">Stock Shortage Detected</h4>
              <p className="text-xs text-amber-700 mt-0.5">{actionError}</p>
            </div>
          </div>
        )}

        {/* Allocations Table */}
        {hasAllocations ? (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-2.5 px-3">Warehouse</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Allocated Qty</th>
                  <th className="py-2.5 px-3">Fulfilled Qty</th>
                  <th className="py-2.5 px-3">Tracking / Dispatch #</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allocations.map((alloc) => (
                  <tr key={alloc.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {alloc.warehouse?.name || 'Warehouse'}
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-extrabold">
                        {alloc.warehouse?.code}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{alloc.warehouse?.location}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{alloc.product?.name}</td>
                    <td className="py-2.5 px-3 font-black text-blue-700">{alloc.allocatedQuantity} units</td>
                    <td className="py-2.5 px-3 font-bold text-slate-600">{alloc.fulfilledQuantity} units</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{alloc.trackingNumber}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          alloc.status === 'FULFILLED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {alloc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-500">
            Click <strong>"Trigger Auto-Allocation"</strong> above to query Bangalore (Priority 1) and Hyderabad (Priority 2) warehouses and reserve inventory.
          </div>
        )}
      </div>

      {/* ── SECTION 2: Fulfillment Execution (Physical + Service) ─ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                2. Fulfillment Execution & Dispatch
              </h2>
              <p className="text-[11px] text-slate-500">
                Consumes warehouse inventory, completes service lines, and initializes subscriptions.
              </p>
            </div>
          </div>

          {!isFulfilled ? (
            <button
              onClick={handleCompleteFulfillment}
              disabled={actionLoading || !hasAllocations}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <PackageCheck size={14} />
              {actionLoading ? 'Processing...' : 'Complete Fulfillment'}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 size={13} />
              All Items Fulfilled
            </span>
          )}
        </div>

        {/* Line Items Execution Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Qty</th>
                <th className="py-2.5 px-3">Fulfillment Model</th>
                <th className="py-2.5 px-3">Execution Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const isPhysical = item.productTypeSnapshot === 'HARDWARE';
                const isService = item.productTypeSnapshot === 'SERVICE';
                const isSub = item.productTypeSnapshot === 'SUBSCRIPTION';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.productNameSnapshot}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isPhysical
                            ? 'bg-blue-50 text-blue-700'
                            : isService
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        {item.productTypeSnapshot}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-700">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {isPhysical
                        ? 'Warehouse Stock Decrement'
                        : isService
                        ? 'Service Completion Checklist'
                        : 'Subscription Activation'}
                    </td>
                    <td className="py-2.5 px-3">
                      {isFulfilled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} /> Fulfilled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          <Clock size={11} /> Pending Complete
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 3: Hybrid Billing & Invoicing ──────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-emerald-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                3. Hybrid Billing Separation & Invoicing
              </h2>
              <p className="text-[11px] text-slate-500">
                Separates One-Time Capex (Hardware + Services) from Recurring Opex (Subscriptions).
              </p>
            </div>
          </div>

          {existingInvoice ? (
            <button
              onClick={() => onNavigate('invoice-detail', existingInvoice.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <span>View Invoice {existingInvoice.invoiceNumber}</span>
              <ExternalLink size={13} />
            </button>
          ) : (
            <button
              onClick={handleGenerateInvoice}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Receipt size={14} />
              {actionLoading ? 'Generating...' : 'Generate Capex Invoice'}
            </button>
          )}
        </div>

        {/* Hybrid Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Capex Card */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-900 uppercase tracking-wider text-[11px]">
                One-Time Capex (To Invoiced)
              </span>
              <span className="text-sm font-black text-emerald-800">
                ₹{Number(hybrid.oneTime?.totalAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <ul className="divide-y divide-emerald-100 text-slate-700 text-[11px]">
              {hybrid.oneTime?.items?.map((it) => (
                <li key={it.id} className="py-1.5 flex justify-between">
                  <span>
                    {it.productName} (x{it.quantity})
                  </span>
                  <span className="font-semibold">₹{Number(it.lineTotal).toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Opex Card */}
          <div className="p-4 bg-purple-50/50 border border-purple-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-900 uppercase tracking-wider text-[11px]">
                Recurring Opex (Subscriptions)
              </span>
              <span className="text-sm font-black text-purple-800">
                ₹{Number(hybrid.recurring?.mrr || 0).toLocaleString('en-IN')}/mo
              </span>
            </div>
            <ul className="divide-y divide-purple-100 text-slate-700 text-[11px]">
              {hybrid.recurring?.items?.map((it) => (
                <li key={it.id} className="py-1.5 flex justify-between">
                  <span>
                    {it.productName} (x{it.quantity})
                  </span>
                  <span className="font-semibold">₹{Number(it.lineTotal).toLocaleString('en-IN')}/mo</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
