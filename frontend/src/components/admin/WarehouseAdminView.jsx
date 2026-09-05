import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  Warehouse,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  X,
  Save,
  Boxes,
  ToggleLeft,
  ToggleRight,
  MapPin,
  ChevronDown,
  ChevronUp,
  ArrowUp,
} from 'lucide-react';

function Badge({ children, color = 'slate' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${colors[color] || colors.slate}`}>
      {children}
    </span>
  );
}

function CreateWarehouseModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', code: '', location: '', address: '', priority: 1 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetchWithAuth('/api/admin/warehouses', {
        method: 'POST',
        body: JSON.stringify({ ...form, priority: Number(form.priority) }),
      });
      if (res.success) {
        onCreated(res.data);
      } else {
        setError(res.error?.message || 'Failed to create warehouse');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Warehouse size={18} className="text-green-700" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">New Warehouse</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Warehouse Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Mumbai Central Hub"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Code *</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. MUM-01"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 bg-slate-50 focus:bg-white font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Priority *</label>
              <input
                type="number"
                required
                min={1}
                max={100}
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 bg-slate-50 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">1 = highest priority in allocation</p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Location (City, State) *</label>
            <input
              required
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              placeholder="e.g. Mumbai, Maharashtra"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 bg-slate-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Full Address (optional)</label>
            <input
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Street address..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold transition-all cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              {submitting ? 'Creating...' : 'Create Warehouse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WarehouseInventoryPanel({ warehouse, onRefresh }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingInvId, setEditingInvId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [savingInv, setSavingInv] = useState(false);
  const [addingProduct, setAddingProduct] = useState(null);
  const [addQty, setAddQty] = useState('');
  const [savingAdd, setSavingAdd] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/warehouses/${warehouse.id}/inventory`);
      if (res.success) setDetails(res.data);
    } finally {
      setLoading(false);
    }
  }, [warehouse.id]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  const handleUpdateQty = async (productId) => {
    setSavingInv(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await fetchWithAuth(`/api/admin/warehouses/${warehouse.id}/inventory`, {
        method: 'PUT',
        body: JSON.stringify({ productId, availableQuantity: Number(editQty) }),
      });
      if (res.success) {
        setFeedback({ type: 'success', text: 'Stock updated successfully.' });
        setEditingInvId(null);
        fetchDetails();
        onRefresh();
      } else {
        setFeedback({ type: 'error', text: res.error?.message || 'Update failed' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error' });
    } finally {
      setSavingInv(false);
    }
  };

  const handleAddProduct = async () => {
    if (!addingProduct) return;
    setSavingAdd(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await fetchWithAuth(`/api/admin/warehouses/${warehouse.id}/inventory`, {
        method: 'PUT',
        body: JSON.stringify({ productId: addingProduct.id, availableQuantity: Number(addQty) }),
      });
      if (res.success) {
        setFeedback({ type: 'success', text: `${addingProduct.name} added with ${addQty} units.` });
        setAddingProduct(null);
        setAddQty('');
        fetchDetails();
        onRefresh();
      } else {
        setFeedback({ type: 'error', text: res.error?.message || 'Failed to add product' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error' });
    } finally {
      setSavingAdd(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-xs text-slate-400 border-t border-slate-100 bg-slate-50/60">
        <RefreshCw size={14} className="animate-spin inline mr-2" />
        Loading inventory...
      </div>
    );
  }

  const inventories = details?.warehouse?.inventories || [];
  const unlinkedProducts = details?.unlinkedProducts || [];

  return (
    <div className="p-4 space-y-4 border-t border-slate-100 bg-slate-50/60">
      {feedback.text && (
        <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {feedback.text}
        </div>
      )}

      <div>
        <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Current Stock Levels</h4>
        {inventories.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">No inventory tracked yet. Use the panel below to add products.</p>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                  <th className="py-2 px-3 text-left">Product</th>
                  <th className="py-2 px-3 text-center">Available</th>
                  <th className="py-2 px-3 text-center">Allocated</th>
                  <th className="py-2 px-3 text-center">Fulfilled</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {inventories.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800">{inv.product?.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{inv.product?.sku}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {editingInvId === inv.id ? (
                        <input
                          type="number"
                          min={0}
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="w-20 px-2 py-1 border-2 border-green-500 rounded text-xs text-center font-bold focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="font-black text-emerald-700 text-sm">{inv.availableQuantity}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-blue-700">{inv.allocatedQuantity}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500">{inv.fulfilledQuantity}</td>
                    <td className="py-2.5 px-3 text-right">
                      {editingInvId === inv.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleUpdateQty(inv.productId)}
                            disabled={savingInv}
                            className="px-2 py-1 bg-green-700 text-white rounded text-[10px] font-bold hover:bg-green-800 disabled:opacity-50 cursor-pointer"
                          >
                            {savingInv ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingInvId(null)}
                            className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingInvId(inv.id); setEditQty(String(inv.availableQuantity)); }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold cursor-pointer"
                        >
                          <Edit2 size={10} /> Edit Stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {unlinkedProducts.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Add Tracked Product to This Warehouse</h4>
          {addingProduct ? (
            <div className="flex items-center gap-2 p-3 bg-white border border-green-200 rounded-lg">
              <span className="text-xs font-semibold text-slate-700 flex-1">{addingProduct.name}</span>
              <input
                type="number"
                min={0}
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                placeholder="Qty"
                className="w-20 px-2 py-1.5 border border-slate-300 rounded text-xs text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
              <span className="text-[10px] text-slate-500">units</span>
              <button
                onClick={handleAddProduct}
                disabled={savingAdd || !addQty}
                className="px-3 py-1.5 bg-green-700 text-white rounded text-[10px] font-bold hover:bg-green-800 disabled:opacity-50 cursor-pointer"
              >
                {savingAdd ? '...' : 'Add'}
              </button>
              <button
                onClick={() => { setAddingProduct(null); setAddQty(''); }}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unlinkedProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setAddingProduct(p); setAddQty('0'); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-dashed border-slate-300 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-green-50 hover:border-green-400 hover:text-green-800 cursor-pointer transition-all"
                >
                  <Plus size={11} />
                  {p.name}
                  <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WarehouseAdminView() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [actionFeedback, setActionFeedback] = useState({ type: '', text: '' });

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth('/api/admin/warehouses');
      if (res.success) {
        setWarehouses(res.data || []);
      } else {
        setError(res.error?.message || 'Failed to load warehouses');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

  const handleToggleStatus = async (wh) => {
    const newStatus = wh.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setTogglingId(wh.id);
    setActionFeedback({ type: '', text: '' });
    try {
      const res = await fetchWithAuth(`/api/admin/warehouses/${wh.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success) {
        setActionFeedback({ type: 'success', text: `${wh.name} is now ${newStatus}.` });
        fetchWarehouses();
      } else {
        setActionFeedback({ type: 'error', text: res.error?.message || 'Toggle failed' });
      }
    } catch {
      setActionFeedback({ type: 'error', text: 'Network error' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreated = (newWarehouse) => {
    setShowCreateModal(false);
    setActionFeedback({ type: 'success', text: `Warehouse "${newWarehouse.name}" (${newWarehouse.code}) created successfully.` });
    fetchWarehouses();
    setExpandedId(newWarehouse.id);
  };

  const activeCount = warehouses.filter((w) => w.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Warehouses & Inventory Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure warehouse locations, set allocation priorities, and manage per-product stock levels.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchWarehouses}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-all"
          >
            <Plus size={15} />
            Add Warehouse
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Warehouses', value: warehouses.length, color: 'text-slate-800' },
          { label: 'Active', value: activeCount, color: 'text-emerald-700' },
          { label: 'Inactive', value: warehouses.length - activeCount, color: 'text-amber-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-xs">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {actionFeedback.text && (
        <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${actionFeedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {actionFeedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {actionFeedback.text}
        </div>
      )}

      {loading && warehouses.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-green-700" />
          <p className="text-xs font-medium">Loading warehouse telemetry...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-xs text-red-700">
          <AlertTriangle size={20} className="mx-auto mb-2" />
          {error}
        </div>
      ) : warehouses.length === 0 ? (
        <div className="p-12 bg-white rounded-xl border border-dashed border-slate-300 text-center">
          <Warehouse size={40} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No Warehouses Configured</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Create your first warehouse to enable multi-warehouse inventory allocation for order fulfillment.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-xs font-bold hover:bg-green-800 cursor-pointer"
          >
            <Plus size={14} /> Add First Warehouse
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {warehouses.map((wh) => {
            const isExpanded = expandedId === wh.id;
            const isActive = wh.status === 'ACTIVE';
            const totalStock = wh.inventories?.reduce((s, i) => s + i.availableQuantity, 0) || 0;

            return (
              <div
                key={wh.id}
                className={`bg-white rounded-xl border shadow-xs overflow-hidden transition-all ${isActive ? 'border-slate-200' : 'border-slate-200 opacity-70'}`}
              >
                <div className="p-4 sm:p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${isActive ? 'bg-green-700 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {wh.code.slice(0, 4)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">{wh.name}</h3>
                        <Badge color={isActive ? 'green' : 'slate'}>{wh.status}</Badge>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">{wh.code}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <MapPin size={11} className="shrink-0" />
                        {wh.location}
                        {wh.address && <span className="text-slate-400"> • {wh.address}</span>}
                      </p>
                      <div className="flex items-center gap-4 mt-1.5 text-[11px]">
                        <span className="font-semibold text-slate-600">
                          Priority: <span className="text-slate-900 font-black">{wh.priority}</span>
                        </span>
                        <span className="font-semibold text-slate-600">
                          Products: <span className="text-slate-900 font-black">{wh.inventories?.length || 0}</span>
                        </span>
                        <span className="font-semibold text-slate-600">
                          Total Stock: <span className="text-emerald-700 font-black">{totalStock}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleStatus(wh)}
                      disabled={togglingId === wh.id}
                      title={isActive ? 'Deactivate warehouse' : 'Activate warehouse'}
                      className={`p-2 rounded-lg cursor-pointer disabled:opacity-50 transition-all border ${isActive ? 'text-emerald-700 bg-emerald-50 hover:bg-red-50 hover:text-red-700 border-emerald-200' : 'text-slate-500 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border-slate-200'}`}
                    >
                      {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : wh.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-all"
                    >
                      <Boxes size={13} />
                      Manage Stock
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <WarehouseInventoryPanel
                    warehouse={wh}
                    onRefresh={fetchWarehouses}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {warehouses.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-3">
          <ArrowUp size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Allocation Priority:</span> When fulfilling orders, inventory is allocated from the warehouse with the lowest priority number first (1 = highest priority). Split-allocation automatically occurs when a single warehouse has insufficient stock.
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateWarehouseModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
