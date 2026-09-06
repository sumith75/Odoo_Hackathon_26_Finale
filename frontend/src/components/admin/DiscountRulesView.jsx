import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  Percent,
  Plus,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export default function DiscountRulesView() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const initialForm = {
    name: '',
    productType: null,
    customerTier: null,
    maxDiscountPercentage: 20,
    requiresApprovalAbove: 10,
    requiresFinanceApprovalAbove: 20,
  };

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/discount-rules');
      if (res.success) {
        setRules(res.data);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to load discount rules' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleToggleStatus = async (rule) => {
    const newStatus = !rule.isActive;
    try {
      const res = await fetchWithAuth(`/api/discount-rules/${rule.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      if (res.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, isActive: newStatus } : r))
        );
        setFeedback({
          type: 'success',
          text: `Rule "${rule.name}" is now ${newStatus ? 'active' : 'inactive'}`,
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
      const payload = {
        name: form.name,
        productType: form.productType || null,
        customerTier: form.customerTier || null,
        maxDiscountPercentage: parseFloat(form.maxDiscountPercentage),
        requiresApprovalAbove: form.requiresApprovalAbove
          ? parseFloat(form.requiresApprovalAbove)
          : null,
        requiresFinanceApprovalAbove: form.requiresFinanceApprovalAbove
          ? parseFloat(form.requiresFinanceApprovalAbove)
          : null,
      };

      const res = await fetchWithAuth('/api/discount-rules', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setFeedback({ type: 'success', text: `Discount rule "${form.name}" created!` });
        setIsAddModalOpen(false);
        setForm(initialForm);
        await loadRules();
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to create discount rule' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`Delete discount rule "${rule.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`/api/discount-rules/${rule.id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        setRules((prev) => prev.filter((r) => r.id !== rule.id));
        setFeedback({ type: 'success', text: `Deleted "${rule.name}".` });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to delete discount rule' });
    } finally {
      setTimeout(() => setFeedback({ type: '', text: '' }), 3000);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: editingRule.name,
        productType: editingRule.productType || null,
        customerTier: editingRule.customerTier || null,
        maxDiscountPercentage: parseFloat(editingRule.maxDiscountPercentage),
        requiresApprovalAbove: editingRule.requiresApprovalAbove
          ? parseFloat(editingRule.requiresApprovalAbove)
          : null,
        requiresFinanceApprovalAbove: editingRule.requiresFinanceApprovalAbove
          ? parseFloat(editingRule.requiresFinanceApprovalAbove)
          : null,
      };

      const res = await fetchWithAuth(`/api/discount-rules/${editingRule.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setFeedback({ type: 'success', text: `Updated "${editingRule.name}" successfully.` });
        setIsEditModalOpen(false);
        setEditingRule(null);
        await loadRules();
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update rule' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ──────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Percent className="text-green-700" size={24} /> Discount Rules & Limits
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enforce corporate pricing boundaries, customer tier privileges, and automatic approval thresholds.
          </p>
        </div>

        <button
          onClick={() => {
            setForm(initialForm);
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-xs"
        >
          <Plus size={16} /> + Add Discount Rule
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

      {/* ── Rules Table ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-green-700 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading discount rules...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No discount rules configured yet. Click "+ Add Discount Rule" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Rule Name</th>
                  <th className="py-3.5 px-4">Target Scope</th>
                  <th className="py-3.5 px-4">Max Allowed Disc.</th>
                  <th className="py-3.5 px-4">Manager Approval &gt;</th>
                  <th className="py-3.5 px-4">Finance Approval &gt;</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{r.name}</td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                          {r.productType ? `Type: ${r.productType}` : 'All Products'}
                        </span>
                        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
                          {r.customerTier ? `Tier: ${r.customerTier}` : 'All Tiers'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {r.maxDiscountPercentage}%
                    </td>

                    <td className="py-3.5 px-4">
                      {r.requiresApprovalAbove !== null ? (
                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200">
                          &gt; {r.requiresApprovalAbove}%
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {r.requiresFinanceApprovalAbove !== null ? (
                        <span className="text-red-800 bg-red-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-red-200">
                          &gt; {r.requiresFinanceApprovalAbove}%
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleStatus(r)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                          r.isActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            r.isActive ? 'bg-emerald-600' : 'bg-slate-400'
                          }`}
                        />
                        {r.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingRule({ ...r });
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-green-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit rule"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete rule"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── ADD RULE MODAL ──────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Percent size={18} className="text-green-700" /> Add Discount Policy Rule
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rule Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Tier Discount Policy"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Product Scope</label>
                  <select
                    value={form.productType || ''}
                    onChange={(e) =>
                      setForm({ ...form, productType: e.target.value ? e.target.value : null })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  >
                    <option value="">All Product Types</option>
                    <option value="HARDWARE">Hardware Only</option>
                    <option value="SERVICE">Service Only</option>
                    <option value="SUBSCRIPTION">Subscription Only</option>
                    <option value="BUNDLE">Bundle Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer Tier</label>
                  <select
                    value={form.customerTier || ''}
                    onChange={(e) =>
                      setForm({ ...form, customerTier: e.target.value ? e.target.value : null })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  >
                    <option value="">All Customer Tiers</option>
                    <option value="BRONZE">Bronze Tier</option>
                    <option value="SILVER">Silver Tier</option>
                    <option value="GOLD">Gold Tier</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Absolute Max Discount Allowed (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  placeholder="20"
                  value={form.maxDiscountPercentage}
                  onChange={(e) => setForm({ ...form, maxDiscountPercentage: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Require Manager Above (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="10"
                    value={form.requiresApprovalAbove}
                    onChange={(e) => setForm({ ...form, requiresApprovalAbove: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Require Finance Above (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="20"
                    value={form.requiresFinanceApprovalAbove}
                    onChange={(e) =>
                      setForm({ ...form, requiresFinanceApprovalAbove: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
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
                  {submitting ? 'Creating...' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT RULE MODAL ─────────────────────────────────── */}
      {isEditModalOpen && editingRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 size={18} className="text-green-700" /> Edit Discount Rule
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rule Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Max Allowed Discount (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={editingRule.maxDiscountPercentage}
                  onChange={(e) =>
                    setEditingRule({ ...editingRule, maxDiscountPercentage: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Require Manager Above (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingRule.requiresApprovalAbove || ''}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, requiresApprovalAbove: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Require Finance Above (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingRule.requiresFinanceApprovalAbove || ''}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        requiresFinanceApprovalAbove: e.target.value,
                      })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
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
                  {submitting ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
