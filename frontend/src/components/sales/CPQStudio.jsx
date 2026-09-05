import React, { useState, useEffect, useRef } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Calculator,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Save,
  Send,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Building2,
  Tag,
  Search,
  X,
  RefreshCw,
  Info,
  Clock,
} from 'lucide-react';

const TYPE_CONFIG = {
  HARDWARE: { label: 'Hardware', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  SERVICE: { label: 'Service', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  SUBSCRIPTION: { label: 'Subscription', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  BUNDLE: { label: 'Bundle', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function CPQStudio({ editingQuoteId, onSaved, onSubmitted, onCancel }) {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  // Core Quote State
  const [quoteId, setQuoteId] = useState(editingQuoteId || null);
  const [quoteNumber, setQuoteNumber] = useState(null);
  const [quoteStatus, setQuoteStatus] = useState('DRAFT');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);

  // Reference Data
  const [customers, setCustomers] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Live Calculations & Intelligence State
  const [pricing, setPricing] = useState({
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    costAmount: 0,
    marginAmount: 0,
    marginPercentage: 0,
    marginHealth: 'HEALTHY',
  });

  const [risk, setRisk] = useState({
    riskScore: 0,
    riskLevel: 'LOW',
    reasons: [],
    approvalRequired: false,
    requiredApproverRole: null,
    violations: [],
  });

  const [recommendations, setRecommendations] = useState([]);

  // UI State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('ALL');
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [calculating, setCalculating] = useState(false);

  // Debounce ref
  const calcTimeoutRef = useRef(null);

  // ── 1. Load Initial Customers & Products ──────────────────────────────────
  useEffect(() => {
    const initData = async () => {
      setLoadingInitial(true);
      try {
        const [custRes, prodRes] = await Promise.all([
          fetchWithAuth('/api/customers'),
          fetchWithAuth('/api/products'),
        ]);

        if (custRes.success) setCustomers(custRes.data);
        if (prodRes.success) setCatalogProducts(prodRes.data);

        // If editing an existing quote, load its details
        if (editingQuoteId) {
          const qRes = await fetchWithAuth(`/api/quotations/${editingQuoteId}`);
          if (qRes.success && qRes.data) {
            const q = qRes.data;
            setQuoteId(q.id);
            setQuoteNumber(q.quoteNumber);
            setQuoteStatus(q.status);
            setSelectedCustomerId(q.customerId);
            setNotes(q.notes || '');

            const mappedItems = (q.items || []).map((it) => ({
              productId: it.productId,
              name: it.productNameSnapshot,
              type: it.productTypeSnapshot,
              unitPrice: parseFloat(it.unitPrice),
              costPrice: parseFloat(it.costPrice),
              quantity: it.quantity,
              discountPercentage: parseFloat(it.discountPercentage),
              taxRate: 18.0,
            }));
            setItems(mappedItems);
          }
        } else if (custRes.data && custRes.data.length > 0) {
          // Default to first customer (e.g. Acme Corporation)
          setSelectedCustomerId(custRes.data[0].id);
        }
      } catch (err) {
        setFeedback({ type: 'error', text: 'Failed to initialize CPQ Studio data.' });
      } finally {
        setLoadingInitial(false);
      }
    };

    initData();
  }, [editingQuoteId]);

  // ── 2. Live Calculation Trigger (Debounced) ────────────────────────────────
  const triggerLiveCalculation = (currentItems, custId) => {
    if (calcTimeoutRef.current) clearTimeout(calcTimeoutRef.current);

    setCalculating(true);
    calcTimeoutRef.current = setTimeout(async () => {
      try {
        const currentCust = customers.find((c) => c.id === custId);
        const payload = {
          items: currentItems.map((it) => ({
            productId: it.productId,
            name: it.name,
            type: it.type,
            unitPrice: it.unitPrice,
            costPrice: it.costPrice,
            quantity: it.quantity,
            discountPercentage: it.discountPercentage,
          })),
          customerTier: currentCust ? currentCust.tier : 'BRONZE',
        };

        const res = await fetchWithAuth('/api/quotations/calculate', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (res.success && res.data) {
          setPricing(res.data.pricing);
          setRisk(res.data.risk);
          setRecommendations(res.data.recommendations || []);
        }
      } catch (err) {
        console.error('Calculation error:', err);
      } finally {
        setCalculating(false);
      }
    }, 250);
  };

  useEffect(() => {
    if (!loadingInitial) {
      triggerLiveCalculation(items, selectedCustomerId);
    }
  }, [items, selectedCustomerId]);

  // ── 3. Line Items Handlers ────────────────────────────────────────────────
  const handleAddProduct = (product) => {
    // Check if already added
    const existingIndex = items.findIndex((i) => i.productId === product.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      setItems(updated);
    } else {
      const newItem = {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        type: product.type,
        unitPrice: parseFloat(product.unitPrice),
        costPrice: parseFloat(product.costPrice || 0),
        taxRate: parseFloat(product.taxRate || 18),
        quantity: 1,
        discountPercentage: 0,
        maxDiscountPercentage: parseFloat(product.maxDiscountPercentage || 15),
      };
      setItems([...items, newItem]);
    }
    setIsProductModalOpen(false);
  };

  const handleUpdateQuantity = (index, delta) => {
    const updated = [...items];
    const newQty = Math.max(1, updated[index].quantity + delta);
    updated[index].quantity = newQty;
    setItems(updated);
  };

  const handleUpdateDiscount = (index, value) => {
    const parsed = Math.min(100, Math.max(0, parseFloat(value) || 0));
    const updated = [...items];
    updated[index].discountPercentage = parsed;
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
  };

  // ── 4. Save Draft Handler ──────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!selectedCustomerId) {
      setFeedback({ type: 'error', text: 'Please select a customer before saving.' });
      return;
    }

    setSavingDraft(true);
    setFeedback({ type: '', text: '' });

    try {
      const payload = {
        customerId: selectedCustomerId,
        notes,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          discountPercentage: it.discountPercentage,
        })),
      };

      let res;
      if (quoteId) {
        res = await fetchWithAuth(`/api/quotations/${quoteId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetchWithAuth('/api/quotations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (res.success && res.data) {
        setQuoteId(res.data.id);
        setQuoteNumber(res.data.quoteNumber);
        setQuoteStatus(res.data.status);
        setFeedback({
          type: 'success',
          text: `Draft saved successfully! (Quote: ${res.data.quoteNumber})`,
        });
        if (onSaved) onSaved(res.data);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save draft quote.' });
    } finally {
      setSavingDraft(false);
      setTimeout(() => setFeedback({ type: '', text: '' }), 4000);
    }
  };

  // ── 5. Submit Quote Handler (Authoritative) ────────────────────────────────
  const handleSubmitQuote = async () => {
    if (!selectedCustomerId) {
      setFeedback({ type: 'error', text: 'Please select a customer.' });
      return;
    }
    if (items.length === 0) {
      setFeedback({ type: 'error', text: 'Please add at least one product before submitting.' });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: '', text: '' });

    try {
      // Step 1: Ensure saved as draft first
      let currentQuoteId = quoteId;
      const savePayload = {
        customerId: selectedCustomerId,
        notes,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          discountPercentage: it.discountPercentage,
        })),
      };

      if (!currentQuoteId) {
        const createRes = await fetchWithAuth('/api/quotations', {
          method: 'POST',
          body: JSON.stringify(savePayload),
        });
        if (!createRes.success) throw new Error(createRes.message);
        currentQuoteId = createRes.data.id;
        setQuoteId(currentQuoteId);
        setQuoteNumber(createRes.data.quoteNumber);
      } else {
        await fetchWithAuth(`/api/quotations/${currentQuoteId}`, {
          method: 'PUT',
          body: JSON.stringify(savePayload),
        });
      }

      // Step 2: Submit quote for authoritative backend transition
      const submitRes = await fetchWithAuth(`/api/quotations/${currentQuoteId}/submit`, {
        method: 'POST',
      });

      if (submitRes.success && submitRes.data) {
        setQuoteStatus(submitRes.data.status);
        setFeedback({
          type: 'success',
          text: submitRes.message || 'Quotation submitted successfully!',
        });
        if (onSubmitted) onSubmitted(submitRes.data);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to submit quotation.' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-green-700 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Initializing CPQ Studio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Top Bar ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-green-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <Calculator size={12} /> CPQ Studio
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {quoteNumber || 'New Deal (Unsaved)'}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                quoteStatus === 'PENDING_APPROVAL'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : quoteStatus === 'APPROVED'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {quoteStatus.replace(/_/g, ' ')}
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">Configure, Price & Quote</h1>
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold"
            >
              Back to Deals
            </button>
          )}

          <button
            onClick={handleSaveDraft}
            disabled={savingDraft || quoteStatus === 'PENDING_APPROVAL' || quoteStatus === 'APPROVED'}
            className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
          >
            {savingDraft ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            Save Draft
          </button>

          <button
            onClick={handleSubmitQuote}
            disabled={
              submitting ||
              items.length === 0 ||
              quoteStatus === 'PENDING_APPROVAL' ||
              quoteStatus === 'APPROVED'
            }
            className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
          >
            {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
            Submit Quote
          </button>
        </div>
      </div>

      {/* ── Feedback Banner ─────────────────────────────────── */}
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

      {/* ── Main CPQ Workspace Grid ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Customer & Line Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selector Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Building2 size={15} className="text-green-700" /> Target Customer
              </label>
              {selectedCustomer && (
                <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {selectedCustomer.tier} Tier Account
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  disabled={quoteStatus === 'PENDING_APPROVAL' || quoteStatus === 'APPROVED'}
                  className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-lg bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                >
                  <option value="">Select target customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.name} ({c.tier} Tier)
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-600 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">
                      {selectedCustomer.companyName || selectedCustomer.name}
                    </span>
                    <span className="text-[11px] text-slate-400">{selectedCustomer.email}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Currency: {selectedCustomer.currency || 'INR'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quotation Line Items Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Commercial Quote Items</h2>
                <p className="text-[11px] text-slate-400">Configure quantities, license counts and item discounts</p>
              </div>

              <button
                onClick={() => setIsProductModalOpen(true)}
                disabled={quoteStatus === 'PENDING_APPROVAL' || quoteStatus === 'APPROVED'}
                className="px-3.5 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                <Plus size={14} /> + Add Product
              </button>
            </div>

            {items.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">Your quotation is currently empty.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click "+ Add Product" to configure items from the catalog.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Unit Price</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3">Discount %</th>
                      <th className="py-2.5 px-3 font-mono">Net Line Total</th>
                      <th className="py-2.5 px-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {items.map((item, index) => {
                      const typeCfg = TYPE_CONFIG[item.type] || {
                        label: item.type,
                        badge: 'bg-gray-100 text-gray-700',
                      };

                      // Check if this item has a ceiling violation for instant visual alert
                      const hasViolation = risk.violations.some(
                        (v) => v.productName === item.name || v.requestedDiscount === item.discountPercentage
                      );

                      const gross = item.quantity * item.unitPrice;
                      const discAmt = gross * (item.discountPercentage / 100);
                      const net = gross - discAmt;

                      return (
                        <tr key={index} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            {item.sku && (
                              <span className="text-[10px] text-slate-400 font-mono">{item.sku}</span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${typeCfg.badge}`}
                            >
                              {typeCfg.label}
                            </span>
                          </td>

                          <td className="py-3 px-3 font-mono">
                            {currency} {Number(item.unitPrice).toLocaleString()}
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(index, -1)}
                                disabled={item.quantity <= 1 || quoteStatus !== 'DRAFT'}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 disabled:opacity-40"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-mono font-bold text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(index, 1)}
                                disabled={quoteStatus !== 'DRAFT'}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="relative w-24">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={item.discountPercentage}
                                onChange={(e) => handleUpdateDiscount(index, e.target.value)}
                                disabled={quoteStatus !== 'DRAFT'}
                                className={`w-full text-xs px-2 py-1 border rounded font-mono font-bold text-right pr-6 focus:outline-none ${
                                  hasViolation
                                    ? 'border-red-500 bg-red-50/50 text-red-700'
                                    : 'border-slate-200 focus:border-green-600'
                                }`}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                                %
                              </span>
                            </div>
                            {hasViolation && (
                              <span className="text-[10px] font-bold text-red-600 block mt-0.5">
                                Exceeds limit
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {currency} {Math.round(net).toLocaleString()}
                          </td>

                          <td className="py-3 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              disabled={quoteStatus !== 'DRAFT'}
                              className="p-1 text-slate-400 hover:text-red-600 rounded disabled:opacity-30"
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Notes Textarea */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Commercial Notes & Terms (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={quoteStatus !== 'DRAFT'}
                placeholder="e.g. Standard 30-day payment terms. Net 15 fulfillment."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
              />
            </div>
          </div>
        </div>

        {/* Right 1 Column: Live Financial Summary & Guardrails */}
        <div className="space-y-6">
          {/* Pricing Summary Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Financial Summary
              </span>
              {calculating && <RefreshCw size={13} className="text-green-700 animate-spin" />}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Gross Value</span>
                <span className="font-mono">{currency} {Number(pricing.grossTotal || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Total Discount</span>
                <span className="font-mono">- {currency} {Number(pricing.discountAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold pt-1 border-t border-slate-100">
                <span>Subtotal (Pre-Tax)</span>
                <span className="font-mono">{currency} {Number(pricing.subtotal || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax (GST 18%)</span>
                <span className="font-mono">{currency} {Number(pricing.taxAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total</span>
                <span className="font-mono text-green-700">
                  {currency} {Number(pricing.totalAmount || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Margin Health Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-green-700" /> Margin Health
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                  pricing.marginHealth === 'HEALTHY'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : pricing.marginHealth === 'WATCH'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {pricing.marginHealth}
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-slate-900">
                  {pricing.marginPercentage}%
                </span>
                <span className="text-xs text-slate-400 ml-1">gross margin</span>
              </div>
              <span className="font-mono text-xs font-bold text-slate-700">
                {currency} {Number(pricing.marginAmount || 0).toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Calculated dynamically against product acquisition cost.
            </p>
          </div>

          {/* Discount Risk Engine Card */}
          <div
            className={`border rounded-xl p-5 shadow-xs transition-all ${
              risk.riskLevel === 'HIGH'
                ? 'bg-red-50/40 border-red-200'
                : risk.riskLevel === 'MEDIUM'
                ? 'bg-amber-50/40 border-amber-200'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-green-700" /> Discount Risk Engine
              </span>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border tracking-wide uppercase ${
                  risk.riskLevel === 'HIGH'
                    ? 'bg-red-100 text-red-800 border-red-300'
                    : risk.riskLevel === 'MEDIUM'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}
              >
                {risk.riskLevel} RISK ({risk.riskScore}/100)
              </span>
            </div>

            {/* Approval Requirement Banner */}
            {risk.approvalRequired ? (
              <div className="mt-3 p-3 bg-amber-100/70 border border-amber-200 rounded-lg text-xs text-amber-900 font-semibold flex items-start gap-2">
                <Clock size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold">
                    {risk.requiredApproverRole === 'FINANCE_OPERATIONS'
                      ? 'Finance Approval Required'
                      : 'Sales Manager Approval Required'}
                  </span>
                  <span className="text-[11px] font-normal text-amber-800 leading-snug">
                    This deal cannot be sent directly to customer without managerial sign-off.
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-700" />
                No approvals required. Within standard discount limits.
              </div>
            )}

            {/* Reasons list */}
            {risk.reasons.length > 0 && (
              <div className="mt-3 space-y-1 text-xs">
                {risk.reasons.map((r, i) => (
                  <p key={i} className="text-slate-600 flex items-start gap-1.5 text-[11px]">
                    <span className="text-amber-600 flex-shrink-0 mt-0.5">•</span>
                    <span>{r}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Upsell / Cross-Sell Recommendations Card */}
          {recommendations.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-1.5">
                <Sparkles size={16} className="text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Recommended Add-Ons
                </h3>
              </div>

              <div className="space-y-2.5">
                {recommendations.map((rec) => (
                  <div
                    key={rec.productId}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{rec.name}</span>
                      <span className="font-mono font-bold text-slate-700">
                        {currency} {Number(rec.unitPrice).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">{rec.reason}</p>
                    <button
                      type="button"
                      onClick={() => handleAddProduct(rec)}
                      disabled={quoteStatus !== 'DRAFT'}
                      className="w-full py-1.5 bg-green-700 hover:bg-green-800 text-white rounded text-xs font-bold transition-colors shadow-xs"
                    >
                      + Add to Quote
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ADD PRODUCT MODAL ───────────────────────────────── */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Select Product to Add</h2>
                <p className="text-xs text-slate-400">Products from your organization catalog</p>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Bar inside modal */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3">
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search catalog products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                {['ALL', 'HARDWARE', 'SERVICE', 'SUBSCRIPTION'].map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setProductTypeFilter(tf)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                      productTypeFilter === tf
                        ? 'bg-green-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {catalogProducts
                .filter((p) => {
                  const matchesSearch =
                    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                    p.sku.toLowerCase().includes(productSearch.toLowerCase());
                  const matchesType = productTypeFilter === 'ALL' || p.type === productTypeFilter;
                  return matchesSearch && matchesType && p.isActive;
                })
                .map((product) => {
                  const typeCfg = TYPE_CONFIG[product.type] || {
                    label: product.type,
                    badge: 'bg-gray-100 text-gray-700',
                  };
                  return (
                    <div
                      key={product.id}
                      className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{product.name}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${typeCfg.badge}`}
                          >
                            {typeCfg.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="font-mono text-slate-400">{product.sku}</span>
                          {product.billingType === 'RECURRING' && ' • Recurring Monthly'}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {currency} {Number(product.unitPrice).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddProduct(product)}
                          className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                        >
                          + Select
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
