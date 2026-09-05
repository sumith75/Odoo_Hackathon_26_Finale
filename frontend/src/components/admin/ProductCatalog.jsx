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
  Trash2,
  Sliders,
  Check,
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

  // Feature & Variants Modal State
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState(false);
  const [activeProductForVariants, setActiveProductForVariants] = useState(null);
  const [variantsList, setVariantsList] = useState([]);
  const [featuresList, setFeaturesList] = useState([]);
  const [featuresDirty, setFeaturesDirty] = useState(false);
  const [newFeatureName, setNewFeatureName] = useState('');
  const [newFeatureValues, setNewFeatureValues] = useState('');
  const [variantForm, setVariantForm] = useState({
    name: '',
    sku: '',
    unitPrice: '',
    costPrice: '',
    stockQuantity: 0,
    attributes: {},
  });
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsSaving, setVariantsSaving] = useState(false);
  const [variantsFeedback, setVariantsFeedback] = useState({ type: '', text: '' });

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
          type: editingProduct.type,
          category: editingProduct.category || editingProduct.type,
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

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete or deactivate "${product.name}" (${product.sku})?`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`/api/products/${product.id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        setFeedback({
          type: 'success',
          text: res.message || `Product "${product.name}" deleted successfully.`,
        });
        await loadProducts();
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to delete product.' });
    } finally {
      setTimeout(() => setFeedback({ type: '', text: '' }), 4000);
    }
  };

  const handleOpenVariantsModal = async (product) => {
    setActiveProductForVariants(product);
    setIsVariantsModalOpen(true);
    setFeaturesList(Array.isArray(product.attributes) ? product.attributes : []);
    setFeaturesDirty(false);
    setVariantsFeedback({ type: '', text: '' });
    setNewFeatureName('');
    setNewFeatureValues('');
    setVariantForm({
      name: '',
      sku: '',
      unitPrice: product.unitPrice ? product.unitPrice.toString() : '',
      costPrice: product.costPrice ? product.costPrice.toString() : '',
      stockQuantity: 0,
      attributes: {},
    });

    setVariantsLoading(true);
    try {
      const res = await fetchWithAuth(`/api/products/${product.id}/variants`);
      if (res.success) {
        setVariantsList(res.data);
      }
    } catch (err) {
      setVariantsFeedback({ type: 'error', text: err.message || 'Failed to load variants.' });
    } finally {
      setVariantsLoading(false);
    }
  };

  const handleAddFeature = async (presetName = null, presetValues = null) => {
    const nameToUse = (typeof presetName === 'string' ? presetName : newFeatureName).trim();
    const rawVals = (presetValues !== null && presetValues !== undefined) ? presetValues : newFeatureValues;

    if (!nameToUse) {
      setVariantsFeedback({
        type: 'error',
        text: 'Please enter a Feature Name (e.g., Color, RAM, or Storage) before adding.',
      });
      return;
    }

    const vals = (Array.isArray(rawVals) ? rawVals : (rawVals || '').split(','))
      .map((v) => v.trim())
      .filter(Boolean);

    if (vals.length === 0) {
      setVariantsFeedback({
        type: 'error',
        text: `Please enter at least one option value for "${nameToUse}" (e.g. Space Black, Silver or 128GB, 256GB).`,
      });
      return;
    }

    // Check if feature already exists (case-insensitive)
    const existingIndex = featuresList.findIndex(
      (f) => f.name.toLowerCase() === nameToUse.toLowerCase()
    );
    let updatedList;
    if (existingIndex >= 0) {
      updatedList = [...featuresList];
      const mergedVals = Array.from(new Set([...updatedList[existingIndex].values, ...vals]));
      updatedList[existingIndex] = { ...updatedList[existingIndex], values: mergedVals };
    } else {
      updatedList = [...featuresList, { name: nameToUse, values: vals }];
    }

    setFeaturesList(updatedList);
    setNewFeatureName('');
    setNewFeatureValues('');
    setVariantsFeedback({ type: '', text: '' });

    // Immediately persist feature schema directly to PostgreSQL database
    if (activeProductForVariants) {
      setVariantsSaving(true);
      try {
        const res = await fetchWithAuth(`/api/products/${activeProductForVariants.id}/features`, {
          method: 'POST',
          body: JSON.stringify({ attributes: updatedList }),
        });
        if (res.success) {
          setVariantsFeedback({
            type: 'success',
            text: `Feature "${nameToUse}" (${vals.join(', ')}) saved to database!`,
          });
          setFeaturesDirty(false);
          setActiveProductForVariants(res.data);
          await loadProducts();
        }
      } catch (err) {
        setVariantsFeedback({ type: 'error', text: err.message || 'Failed to save feature schema.' });
      } finally {
        setVariantsSaving(false);
      }
    }
  };

  const handleRemoveFeature = async (idx) => {
    const removedName = featuresList[idx]?.name;
    const updatedList = featuresList.filter((_, i) => i !== idx);
    setFeaturesList(updatedList);

    if (activeProductForVariants) {
      setVariantsSaving(true);
      try {
        const res = await fetchWithAuth(`/api/products/${activeProductForVariants.id}/features`, {
          method: 'POST',
          body: JSON.stringify({ attributes: updatedList }),
        });
        if (res.success) {
          setVariantsFeedback({ type: 'success', text: `Feature "${removedName}" removed and database updated.` });
          setFeaturesDirty(false);
          setActiveProductForVariants(res.data);
          await loadProducts();
        }
      } catch (err) {
        setVariantsFeedback({ type: 'error', text: err.message || 'Failed to update feature schema.' });
      } finally {
        setVariantsSaving(false);
      }
    }
  };

  const handleSaveFeatures = async () => {
    if (!activeProductForVariants) return;
    setVariantsSaving(true);
    try {
      const res = await fetchWithAuth(`/api/products/${activeProductForVariants.id}/features`, {
        method: 'POST',
        body: JSON.stringify({ attributes: featuresList }),
      });
      if (res.success) {
        setVariantsFeedback({ type: 'success', text: 'Product features configured and saved!' });
        setFeaturesDirty(false);
        setActiveProductForVariants(res.data);
        await loadProducts();
      }
    } catch (err) {
      setVariantsFeedback({ type: 'error', text: err.message || 'Failed to save features.' });
    } finally {
      setVariantsSaving(false);
    }
  };

  const handleCreateVariantSubmit = async (e) => {
    e.preventDefault();
    if (!activeProductForVariants) return;
    setVariantsSaving(true);
    setVariantsFeedback({ type: '', text: '' });

    try {
      const res = await fetchWithAuth(`/api/products/${activeProductForVariants.id}/variants`, {
        method: 'POST',
        body: JSON.stringify({
          name: variantForm.name,
          sku: variantForm.sku,
          attributes: variantForm.attributes,
          unitPrice: parseFloat(variantForm.unitPrice),
          costPrice: parseFloat(variantForm.costPrice || 0),
          stockQuantity: parseInt(variantForm.stockQuantity, 10) || 0,
        }),
      });

      if (res.success) {
        setVariantsFeedback({
          type: 'success',
          text: `Variant "${variantForm.name}" created with stock ${variantForm.stockQuantity} saved in DB!`,
        });
        setVariantsList((prev) => [...prev, res.data]);
        setVariantForm({
          name: '',
          sku: '',
          unitPrice: activeProductForVariants.unitPrice ? activeProductForVariants.unitPrice.toString() : '',
          costPrice: activeProductForVariants.costPrice ? activeProductForVariants.costPrice.toString() : '',
          stockQuantity: 0,
          attributes: {},
        });
        await loadProducts();
      }
    } catch (err) {
      setVariantsFeedback({ type: 'error', text: err.message || 'Failed to create variant.' });
    } finally {
      setVariantsSaving(false);
    }
  };

  const handleAdjustStock = async (variantId, newQty) => {
    if (!activeProductForVariants) return;
    try {
      const res = await fetchWithAuth(
        `/api/products/${activeProductForVariants.id}/variants/${variantId}/stock`,
        {
          method: 'PATCH',
          body: JSON.stringify({ stockQuantity: Math.max(0, parseInt(newQty, 10) || 0) }),
        }
      );
      if (res.success) {
        setVariantsList((prev) =>
          prev.map((v) => (v.id === variantId ? { ...v, stockQuantity: res.data.stockQuantity } : v))
        );
        await loadProducts();
      }
    } catch (err) {
      setVariantsFeedback({ type: 'error', text: err.message || 'Failed to adjust stock.' });
    }
  };

  const handleDeleteVariant = async (variantId) => {
    if (!activeProductForVariants) return;
    if (!window.confirm('Are you sure you want to remove this variant?')) return;
    try {
      const res = await fetchWithAuth(
        `/api/products/${activeProductForVariants.id}/variants/${variantId}`,
        {
          method: 'DELETE',
        }
      );
      if (res.success) {
        setVariantsList((prev) => prev.filter((v) => v.id !== variantId));
        setVariantsFeedback({ type: 'success', text: 'Variant removed successfully.' });
        await loadProducts();
      }
    } catch (err) {
      setVariantsFeedback({ type: 'error', text: err.message || 'Failed to delete variant.' });
    }
  };

  // const filteredProducts = products.filter((p) => {
  //   const matchesSearch =
  //     p.name?.toLowerCase().includes(searchTerm.toLowerCase());
  //   const matchesType = typeFilter === 'ALL' || p.type === typeFilter;
  //   return matchesSearch && matchesType;
  // });


const normalizedSearch = searchTerm.trim().toLowerCase();
const filteredProducts = products.filter((product) => {
  const matchesSearch =
    normalizedSearch === '' ||
    product.name?.toLowerCase().startsWith(normalizedSearch);
  const matchesType =
    typeFilter === 'ALL' || product.type === typeFilter;
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
                  <th className="py-3.5 px-4">Variants / DB Stock</th>
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
                        {p.variants && p.variants.length > 0 ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                              <Layers size={11} /> {p.variants.length} Variants
                            </span>
                            <div className="text-[10px] text-slate-500 font-medium">
                              <span className="text-emerald-700 font-bold">
                                {p.variants.reduce((acc, v) => acc + (v.stockQuantity || 0), 0)}
                              </span>{' '}
                              units total in DB
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Base item (No variants)</span>
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenVariantsModal(p)}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors flex items-center gap-1 shadow-2xs"
                            title="Configure Features & Variants"
                          >
                            <Sliders size={12} /> Variants
                          </button>
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
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                            title="Delete product"
                          >
                            <Trash2 size={14} />
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingProduct.type || 'HARDWARE'}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      const isSub = nextType === 'SUBSCRIPTION';
                      const isBundle = nextType === 'BUNDLE';
                      setEditingProduct({
                        ...editingProduct,
                        type: nextType,
                        category: editingProduct.category || nextType,
                        billingType: isSub ? 'RECURRING' : (editingProduct.billingType || 'ONE_TIME'),
                        billingInterval: isSub ? (editingProduct.billingInterval || 'MONTHLY') : null,
                        isInventoryTracked: (isSub || isBundle) ? false : editingProduct.isInventoryTracked,
                      });
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 font-medium"
                  >
                    <option value="HARDWARE">Hardware (Physical Asset)</option>
                    <option value="SERVICE">Service (Implementation / Labor)</option>
                    <option value="SUBSCRIPTION">Subscription (Recurring SaaS/Support)</option>
                    <option value="BUNDLE">Bundle (Package Offer)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={editingProduct.category || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                    placeholder="e.g. Hardware, Network, Cloud..."
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Billing Model</label>
                  <select
                    value={editingProduct.billingType || 'ONE_TIME'}
                    disabled={editingProduct.type === 'SUBSCRIPTION'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, billingType: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 font-medium disabled:bg-slate-50"
                  >
                    <option value="ONE_TIME">One-Time Billing</option>
                    <option value="RECURRING">Recurring Billing</option>
                  </select>
                </div>

                {(editingProduct.billingType === 'RECURRING' || editingProduct.type === 'SUBSCRIPTION') && (
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Billing Interval <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editingProduct.billingInterval || 'MONTHLY'}
                      onChange={(e) => setEditingProduct({ ...editingProduct, billingInterval: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 font-medium"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="YEARLY">Yearly / Annually</option>
                    </select>
                  </div>
                )}

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

      {/* ── PRODUCT FEATURES & VARIANTS MODAL ────────────────── */}
      {isVariantsModalOpen && activeProductForVariants && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                    <Sliders size={18} />
                  </span>
                  <h2 className="text-base font-black text-slate-900">
                    Product Features & Variant Stock
                  </h2>
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {activeProductForVariants.sku}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Define product features (e.g. Color, RAM, Storage) and manage authoritative variant stock counts in the database for{' '}
                  <strong className="text-slate-800">{activeProductForVariants.name}</strong>.
                </p>
              </div>
              <button
                onClick={() => setIsVariantsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Feedback Banner */}
            {variantsFeedback.text && (
              <div
                className={`mb-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
                  variantsFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {variantsFeedback.type === 'success' ? (
                  <CheckCircle2 size={16} className="text-emerald-700 flex-shrink-0" />
                ) : (
                  <XCircle size={16} className="text-red-600 flex-shrink-0" />
                )}
                <span>{variantsFeedback.text}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* ── SECTION 1: Product Features (Attributes) Schema ── */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Tag size={13} className="text-indigo-600" /> Feature Definitions
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Define configurable feature options (e.g., Color, Memory, RAM) that compose product variants.
                    </p>
                  </div>
                  {featuresDirty && (
                    <button
                      type="button"
                      onClick={handleSaveFeatures}
                      disabled={variantsSaving}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                    >
                      <Save size={13} /> Save Feature Schema
                    </button>
                  )}
                </div>

                {/* Current Features List */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {featuresList.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic">
                      No features defined yet. Add features below (e.g. Color, RAM, Storage).
                    </div>
                  ) : (
                    featuresList.map((f, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-lg p-2 text-xs flex items-center gap-2 shadow-2xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800">{f.name}:</span>{' '}
                          <span className="text-slate-600">
                            {Array.isArray(f.values) ? f.values.join(', ') : f.values}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(idx)}
                          className="text-slate-400 hover:text-red-600 p-0.5 rounded"
                          title="Remove feature"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Feature Inputs */}
                <div className="pt-2 border-t border-slate-200/80 space-y-2">
                  <div className="flex flex-col sm:flex-row items-end gap-2">
                    <div className="w-full sm:w-1/3">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Feature Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Color, RAM, Storage"
                        value={newFeatureName}
                        onChange={(e) => setNewFeatureName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddFeature();
                          }
                        }}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/30 font-medium"
                      />
                    </div>
                    <div className="w-full sm:flex-1">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Options / Values (comma-separated)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Space Black, Silver, Titanium OR 128GB, 256GB"
                        value={newFeatureValues}
                        onChange={(e) => setNewFeatureValues(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddFeature();
                          }
                        }}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/30"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddFeature()}
                      disabled={variantsSaving}
                      className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Plus size={13} /> {variantsSaving ? 'Saving...' : 'Add Feature'}
                    </button>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                    <span className="font-semibold text-slate-600">Quick Presets:</span>
                    <button
                      type="button"
                      onClick={() => handleAddFeature('Color', 'Space Black, Silver, Natural Titanium, Deep Blue')}
                      disabled={variantsSaving}
                      className="px-2 py-0.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 rounded text-[11px] font-medium transition-colors shadow-2xs"
                    >
                      + Preset: Color
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddFeature('RAM', '8GB, 16GB, 32GB')}
                      disabled={variantsSaving}
                      className="px-2 py-0.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 rounded text-[11px] font-medium transition-colors shadow-2xs"
                    >
                      + Preset: RAM
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddFeature('Storage', '128GB, 256GB, 512GB, 1TB')}
                      disabled={variantsSaving}
                      className="px-2 py-0.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 rounded text-[11px] font-medium transition-colors shadow-2xs"
                    >
                      + Preset: Storage
                    </button>
                  </div>
                </div>
              </div>

              {/* ── SECTION 2: Variants Matrix & Live DB Stock ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Layers size={14} className="text-indigo-600" /> Variant Stock Matrix ({variantsList.length} in DB)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Every variant maintains its own authoritative stock count directly in the PostgreSQL database.
                    </p>
                  </div>
                </div>

                {/* Variants Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                  {variantsLoading ? (
                    <div className="py-8 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" /> Loading variants from DB...
                    </div>
                  ) : variantsList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No variants registered yet. Use the form below to create your first variant.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-2.5 px-3">Variant & SKU</th>
                            <th className="py-2.5 px-3">Feature Values</th>
                            <th className="py-2.5 px-3 font-mono">Unit Price</th>
                            <th className="py-2.5 px-3 text-center">DB Stock Count</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {variantsList.map((variant) => {
                            const attrEntries = Object.entries(variant.attributes || {});
                            return (
                              <tr key={variant.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-900">{variant.name}</div>
                                  <div className="font-mono text-[10px] text-slate-400">{variant.sku}</div>
                                </td>

                                <td className="py-2.5 px-3">
                                  <div className="flex flex-wrap gap-1">
                                    {attrEntries.length === 0 ? (
                                      <span className="text-slate-400 text-[10px]">—</span>
                                    ) : (
                                      attrEntries.map(([k, v], i) => (
                                        <span
                                          key={i}
                                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                                        >
                                          {k}: {v}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                  {activeProductForVariants.currency || 'INR'}{' '}
                                  {Number(variant.unitPrice).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>

                                {/* Direct DB Stock Count with Quick Adjust */}
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustStock(variant.id, Math.max(0, variant.stockQuantity - 5))}
                                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px]"
                                      title="Subtract 5"
                                    >
                                      -5
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustStock(variant.id, Math.max(0, variant.stockQuantity - 1))}
                                      className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                                      title="Subtract 1"
                                    >
                                      -
                                    </button>
                                    <span
                                      className={`min-w-[42px] text-center font-mono font-bold px-2 py-0.5 rounded text-xs border ${
                                        variant.stockQuantity > 10
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : variant.stockQuantity > 0
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : 'bg-red-50 text-red-800 border-red-200'
                                      }`}
                                    >
                                      {variant.stockQuantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustStock(variant.id, variant.stockQuantity + 1)}
                                      className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                                      title="Add 1"
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustStock(variant.id, variant.stockQuantity + 10)}
                                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px]"
                                      title="Add 10"
                                    >
                                      +10
                                    </button>
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteVariant(variant.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete variant"
                                  >
                                    <Trash2 size={13} />
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

                {/* ── Add New Variant Form ── */}
                <form
                  onSubmit={handleCreateVariantSubmit}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Plus size={14} className="text-green-700" /> Create New Variant
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Authoritative inventory recorded upon creation
                    </span>
                  </div>

                  {/* Feature Selectors */}
                  {featuresList.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pb-2 border-b border-slate-200/70">
                      {featuresList.map((f, i) => (
                        <div key={i}>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            {f.name}
                          </label>
                          <select
                            value={variantForm.attributes[f.name] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updatedAttrs = { ...variantForm.attributes, [f.name]: val };
                              // Auto-generate suggested name & SKU
                              const attrParts = Object.values(updatedAttrs).filter(Boolean);
                              const suggestedName = `${activeProductForVariants.name} ${attrParts.join(' ')}`.trim();
                              const skuSuffix = attrParts
                                .map((p) => p.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase())
                                .join('-');
                              const suggestedSku = `${activeProductForVariants.sku}-${skuSuffix}`;

                              setVariantForm((prev) => ({
                                ...prev,
                                attributes: updatedAttrs,
                                name: prev.name && prev.name !== '' ? prev.name : suggestedName,
                                sku: prev.sku && prev.sku !== '' ? prev.sku : suggestedSku,
                              }));
                            }}
                            className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/30"
                          >
                            <option value="">-- Select {f.name} --</option>
                            {(Array.isArray(f.values) ? f.values : []).map((v, vIdx) => (
                              <option key={vIdx} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Variant Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. iPhone 15 Space Black 16GB 256GB"
                        required
                        value={variantForm.name}
                        onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/30"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Variant SKU *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. IP15-SB-16-256"
                        required
                        value={variantForm.sku}
                        onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600/30 uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Unit Price ({activeProductForVariants.currency || 'INR'}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={variantForm.unitPrice}
                        onChange={(e) => setVariantForm({ ...variantForm, unitPrice: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600/30"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Cost Price ({activeProductForVariants.currency || 'INR'})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={variantForm.costPrice}
                        onChange={(e) => setVariantForm({ ...variantForm, costPrice: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600/30"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                        Initial Stock in DB *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={variantForm.stockQuantity}
                        onChange={(e) => setVariantForm({ ...variantForm, stockQuantity: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-end">
                      <button
                        type="submit"
                        disabled={variantsSaving}
                        className="w-full py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                      >
                        {variantsSaving ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Plus size={13} />
                        )}
                        Save Variant & DB Stock
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>All changes to variants and stock are saved authoritatively in PostgreSQL.</span>
              <button
                type="button"
                onClick={() => setIsVariantsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
