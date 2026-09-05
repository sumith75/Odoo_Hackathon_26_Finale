import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  RefreshCw,
  X,
  Layers,
  Repeat,
  Wrench,
  Cpu,
  Archive,
  Tag,
} from 'lucide-react';

const TYPE_CONFIG = {
  HARDWARE: {
    label: 'Hardware',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Cpu,
  },
  SERVICE: {
    label: 'Service',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: Wrench,
  },
  SUBSCRIPTION: {
    label: 'Subscription',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: Repeat,
  },
  BUNDLE: {
    label: 'Bundle',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Layers,
  },
};

export default function ProductCatalog() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Add Product Form
  const defaultOrgCurrency = user?.organization?.currency || 'INR';
  const initialForm = {
    name: '',
    sku: '',
    description: '',
    type: 'HARDWARE',
    category: 'HARDWARE',
    unitPrice: '',
    currency: defaultOrgCurrency,
    billingType: 'ONE_TIME',
    billingInterval: null,
    taxRate: 18,
    maxDiscountPercentage: 20,
    isInventoryTracked: true,
  };

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/products');
      if (res.success) {
        setProducts(res.data);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to load products' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleTypeChange = (newType) => {
    if (newType === 'SUBSCRIPTION') {
      setForm((prev) => ({
        ...prev,
        type: newType,
        category: 'SUBSCRIPTION',
        billingType: 'RECURRING',
        billingInterval: 'MONTHLY',
        isInventoryTracked: false,
      }));
    } else if (newType === 'SERVICE') {
      setForm((prev) => ({
        ...prev,
        type: newType,
        category: 'SERVICE',
        billingType: 'ONE_TIME',
        billingInterval: null,
        isInventoryTracked: false,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        type: newType,
        category: newType,
        billingType: 'ONE_TIME',
        billingInterval: null,
        isInventoryTracked: newType === 'HARDWARE',
      }));
    }
  };

  const handleToggleStatus = async (product) => {
    const newStatus = !product.isActive;
    try {
      const res = await fetchWithAuth(`/api/products/${product.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      if (res.success) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, isActive: newStatus } : p))
        );
        setFeedback({
          type: 'success',
          text: `Product ${product.name} is now ${newStatus ? 'active' : 'inactive'}`,
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to toggle status' });
    } finally {
      setTimeout(() => setFeedback({ type: '', text: '' }), 3000);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ type: '', text: '' });

    try {
      const res = await fetchWithAuth('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          unitPrice: parseFloat(form.unitPrice),
          taxRate: parseFloat(form.taxRate) || 0,
          maxDiscountPercentage: parseFloat(form.maxDiscountPercentage) || 0,
        }),
      });

      if (res.success) {
        setFeedback({ type: 'success', text: `Product "${form.name}" added to catalog!` });
        setIsAddModalOpen(false);
        setForm(initialForm);
        await loadProducts();
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to create product' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingProduct.name,
          description: editingProduct.description,
          unitPrice: parseFloat(editingProduct.unitPrice),
          taxRate: parseFloat(editingProduct.taxRate) || 0,
          maxDiscountPercentage: parseFloat(editingProduct.maxDiscountPercentage) || 0,
          isInventoryTracked: editingProduct.isInventoryTracked,
          billingType: editingProduct.billingType,
          billingInterval: editingProduct.billingInterval,
        }),
      });

      if (res.success) {
        setFeedback({ type: 'success', text: `Updated "${editingProduct.name}" successfully.` });
        setIsEditModalOpen(false);
        setEditingProduct(null);
        await loadProducts();
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update product' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Header ──────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Package className="text-green-700" size={24} /> Product Catalog & Pricing
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain inventory products, professional services, subscriptions, and pricing policies.
          </p>
        </div>

        <button
          onClick={() => {
            setForm(initialForm);
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-xs"
        >
          <Plus size={16} /> + Add Product
        </button>
      </div>

      {/* ── Feedback ────────────────────────────────────────── */}
      {feedback.text && (
        <div
          className={`p-4 rounded-xl flex items-center gap-2 text-sm font-semibold border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-700" />
          ) : (
            <XCircle size={18} className="text-red-600" />
          )}
          {feedback.text}
        </div>
      )}

      {/* ── Search & Filter Tabs ────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search SKU or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'HARDWARE', 'SERVICE', 'SUBSCRIPTION', 'BUNDLE'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTypeFilter(tf)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                typeFilter === tf
                  ? 'bg-green-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tf === 'ALL' ? 'All Products' : TYPE_CONFIG[tf]?.label || tf}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product Table ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-green-700 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading catalog...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No products found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Product & SKU</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Unit Price</th>
                  <th className="py-3.5 px-4">Billing Model</th>
                  <th className="py-3.5 px-4">Tax / Max Disc</th>
                  <th className="py-3.5 px-4">Inventory</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredProducts.map((p) => {
                  const typeCfg = TYPE_CONFIG[p.type] || {
                    label: p.type,
                    badge: 'bg-gray-100 text-gray-700',
                  };
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <Tag size={11} /> {p.sku}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${typeCfg.badge}`}
                        >
                          {typeCfg.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {p.currency}{' '}
                        {Number(p.unitPrice).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-semibold text-slate-700">
                          {p.billingType === 'RECURRING'
                            ? `Recurring (${p.billingInterval || 'Monthly'})`
                            : 'One-Time'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-600 font-mono text-[11px]">
                          GST {p.taxRate}% / Max {p.maxDiscountPercentage}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {p.isInventoryTracked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Archive size={11} /> Tracked
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">— Non-stock</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleStatus(p)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                            p.isActive
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.isActive ? 'bg-emerald-600' : 'bg-slate-400'
                            }`}
                          />
                          {p.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditingProduct({
                              ...p,
                              unitPrice: p.unitPrice.toString(),
                            });
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-green-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit product"
                        >
                          <Edit2 size={14} />
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

      {/* ── ADD PRODUCT MODAL ───────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package size={18} className="text-green-700" /> Add Product to Catalog
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Enterprise Server Tower"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unique SKU Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HW-SRV-001"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 font-medium"
                  >
                    <option value="HARDWARE">Hardware (Physical Asset)</option>
                    <option value="SERVICE">Service (Implementation / Labor)</option>
                    <option value="SUBSCRIPTION">Subscription (Recurring SaaS/Support)</option>
                    <option value="BUNDLE">Bundle (Package Offer)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unit Price ({form.currency}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Billing Model
                  </label>
                  <select
                    value={form.billingType}
                    disabled={form.type === 'SUBSCRIPTION'}
                    onChange={(e) => setForm({ ...form, billingType: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 font-medium disabled:bg-slate-50"
                  >
                    <option value="ONE_TIME">One-Time Billing</option>
                    <option value="RECURRING">Recurring Billing</option>
                  </select>
                </div>

                {form.billingType === 'RECURRING' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Billing Interval <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.billingInterval || 'MONTHLY'}
                      onChange={(e) => setForm({ ...form, billingInterval: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 font-medium"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="YEARLY">Yearly / Annually</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tax Rate (% GST / VAT)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.taxRate}
                    onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Max Discount Limit (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    max="100"
                    min="0"
                    value={form.maxDiscountPercentage}
                    onChange={(e) => setForm({ ...form, maxDiscountPercentage: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div className="col-span-2 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isInventoryTracked}
                      onChange={(e) => setForm({ ...form, isInventoryTracked: e.target.checked })}
                      className="rounded text-green-700 focus:ring-green-600"
                    />
                    <span>Track Physical Inventory / Warehouse Stock for this item</span>
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description & Specifications
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of product features, SLA, or inclusions..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT PRODUCT MODAL ──────────────────────────────── */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 size={18} className="text-green-700" /> Edit Product: {editingProduct.sku}
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit Price</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingProduct.unitPrice}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, unitPrice: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingProduct.taxRate}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, taxRate: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Max Discount Limit (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingProduct.maxDiscountPercentage}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        maxDiscountPercentage: e.target.value,
                      })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div className="col-span-2 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.isInventoryTracked}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          isInventoryTracked: e.target.checked,
                        })
                      }
                      className="rounded text-green-700 focus:ring-green-600"
                    />
                    <span>Track Physical Inventory</span>
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={editingProduct.description || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, description: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
