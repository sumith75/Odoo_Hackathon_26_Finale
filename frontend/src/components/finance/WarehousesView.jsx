import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  Warehouse,
  Boxes,
  RefreshCw,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  Package,
} from 'lucide-react';

export default function WarehousesView() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/finance/warehouses');
      if (res.success) {
        setWarehouses(res.data || []);
      } else {
        setError(res.error?.message || 'Failed to fetch warehouses');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to warehouse service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Multi-Warehouse Inventory Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time stock reservation, priority-based deterministic allocation, and stock shortage management.
          </p>
        </div>
        <button
          onClick={fetchWarehouses}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Stock
        </button>
      </div>

      {/* ── Warehouses Grid ────────────────────────────────────── */}
      {loading && warehouses.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-green-700" />
          <p className="text-xs font-medium">Loading warehouse telemetry...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-600 text-xs">
          <AlertTriangle size={20} className="mx-auto mb-1" />
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-black bg-slate-900 text-white">
                      {wh.code}
                    </span>
                    <h2 className="text-base font-bold text-slate-900">{wh.name}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin size={13} className="text-slate-400 shrink-0" />
                    <span>{wh.location}</span>
                  </p>
                  {wh.address && (
                    <p className="text-[11px] text-slate-400 pl-4">{wh.address}</p>
                  )}
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Priority {wh.priority}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-1 uppercase font-bold">
                    {wh.status}
                  </span>
                </div>
              </div>

              {/* Inventory Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                  <span>Tracked Product</span>
                  <div className="flex items-center gap-6">
                    <span>Available</span>
                    <span>Allocated</span>
                    <span>Fulfilled</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {wh.inventories && wh.inventories.length > 0 ? (
                    wh.inventories.map((inv) => (
                      <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                        <div>
                          <div className="font-bold text-slate-900">{inv.product?.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{inv.product?.sku}</div>
                        </div>

                        <div className="flex items-center gap-8 text-right font-mono">
                          <span className="font-black text-emerald-700 text-sm">
                            {inv.availableQuantity}
                          </span>
                          <span className="font-black text-blue-700 text-sm">
                            {inv.allocatedQuantity}
                          </span>
                          <span className="font-black text-slate-600 text-sm">
                            {inv.fulfilledQuantity}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-400 italic text-xs">
                      No inventory records in this facility.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
