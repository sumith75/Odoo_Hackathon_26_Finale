import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  CheckCheck,
  Plus,
  CheckCircle2,
  XCircle,
  Edit2,
  RefreshCw,
  X,
  Shield,
  FileSpreadsheet,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';

const ROLE_CONFIG = {
  SALES_MANAGER: {
    label: 'Sales Manager',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: Shield,
  },
  FINANCE_OPERATIONS: {
    label: 'Finance & Ops',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: FileSpreadsheet,
  },
  ADMIN: {
    label: 'Admin Only',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: ShieldCheck,
  },
};

export default function ApprovalRulesView() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const initialForm = {
    name: '',
    productType: null,
    minDiscountPercentage: 15.01,
    maxDiscountPercentage: 25.0,
    requiredRole: 'SALES_MANAGER',
    priority: 1,
  };

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/approval-rules');
      if (res.success) {
        setRules(res.data);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to load approval rules' });
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
      const res = await fetchWithAuth(`/api/approval-rules/${rule.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      if (res.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, isActive: newStatus } : r))
        );
        setFeedback({
          type: 'success',
          text: `Approval rule "${rule.name}" is now ${newStatus ? 'active' : 'inactive'}`,
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
        minDiscountPercentage: parseFloat(form.minDiscountPercentage),
        maxDiscountPercentage: parseFloat(form.maxDiscountPercentage),
        requiredRole: form.requiredRole,
        priority: parseInt(form.priority, 10) || 1,
      };

      const res = await fetchWithAuth('/api/approval-rules', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setFeedback({ type: 'success', text: `Approval tier "${form.name}" created!` });
        setIsAddModalOpen(false);
        setForm(initialForm);
        await loadRules();
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to create approval rule' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: editingRule.name,
        productType: editingRule.productType || null,
        minDiscountPercentage: parseFloat(editingRule.minDiscountPercentage),
        maxDiscountPercentage: parseFloat(editingRule.maxDiscountPercentage),
        requiredRole: editingRule.requiredRole,
        priority: parseInt(editingRule.priority, 10) || 1,
      };

      const res = await fetchWithAuth(`/api/approval-rules/${editingRule.id}`, {
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
            <CheckCheck className="text-green-700" size={24} /> Approval Rules & Hierarchy
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure multi-tier approval chains routing quotes to Sales Managers or Finance based on deal discount range.
          </p>
        </div>

        <button
          onClick={() => {
            setForm(initialForm);
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-xs"
        >
          <Plus size={16} /> + Add Approval Tier
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

      {/* ── Ladder Table ────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-green-700 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading approval ladder...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No approval rules configured yet. Click "+ Add Approval Tier" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Tier / Name</th>
                  <th className="py-3.5 px-4">Product Scope</th>
                  <th className="py-3.5 px-4">Discount Range</th>
                  <th className="py-3.5 px-4">Required Approver</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {rules.map((r) => {
                  const roleCfg = ROLE_CONFIG[r.requiredRole] || {
                    label: r.requiredRole,
                    badge: 'bg-gray-100 text-gray-700',
                  };
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200">
                          {r.priority}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">{r.name}</td>

                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                          {r.productType ? r.productType : 'All Products'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {r.minDiscountPercentage}% — {r.maxDiscountPercentage}%
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${roleCfg.badge}`}
                        >
                          {roleCfg.label}
                        </span>
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
                      </td>
                    </tr>
                  );
                })}
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
                <CheckCheck size={18} className="text-green-700" /> Add Approval Tier Rule
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
                  Tier / Rule Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tier 2: Sales Manager Approval"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Priority Ladder
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Min Discount (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={form.minDiscountPercentage}
                    onChange={(e) => setForm({ ...form, minDiscountPercentage: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Max Discount (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={form.maxDiscountPercentage}
                    onChange={(e) => setForm({ ...form, maxDiscountPercentage: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Required Approver Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.requiredRole}
                  onChange={(e) => setForm({ ...form, requiredRole: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 font-medium"
                >
                  <option value="SALES_MANAGER">Sales Manager</option>
                  <option value="FINANCE_OPERATIONS">Finance & Operations</option>
                  <option value="ADMIN">Tenant Administrator</option>
                </select>
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
                  {submitting ? 'Creating...' : 'Create Tier'}
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
                <Edit2 size={18} className="text-green-700" /> Edit Approval Tier
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min Disc (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingRule.minDiscountPercentage}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, minDiscountPercentage: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Disc (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingRule.maxDiscountPercentage}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, maxDiscountPercentage: e.target.value })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Required Role</label>
                <select
                  value={editingRule.requiredRole}
                  onChange={(e) => setEditingRule({ ...editingRule, requiredRole: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 font-medium"
                >
                  <option value="SALES_MANAGER">Sales Manager</option>
                  <option value="FINANCE_OPERATIONS">Finance & Operations</option>
                  <option value="ADMIN">Tenant Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editingRule.priority}
                  onChange={(e) => setEditingRule({ ...editingRule, priority: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                />
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
                  {submitting ? 'Saving...' : 'Save Tier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
