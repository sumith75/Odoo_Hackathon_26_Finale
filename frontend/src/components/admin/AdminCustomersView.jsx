import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Search,
  PlusCircle,
  RefreshCw,
  Building2,
  Mail,
  ShieldCheck,
  Edit2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Filter,
  X,
} from 'lucide-react';

const TIER_STYLES = {
  GOLD: {
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    dot: 'bg-amber-500',
    label: 'Gold Tier',
  },
  SILVER: {
    badge: 'bg-slate-200 text-slate-800 border-slate-300',
    dot: 'bg-slate-500',
    label: 'Silver Tier',
  },
  BRONZE: {
    badge: 'bg-orange-100 text-orange-900 border-orange-300',
    dot: 'bg-orange-500',
    label: 'Bronze Tier',
  },
};

export default function AdminCustomersView() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [notification, setNotification] = useState(null);
  const [updatingTierId, setUpdatingTierId] = useState(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Form states
  const [addForm, setAddForm] = useState({
    name: '',
    companyName: '',
    email: '',
    tier: 'BRONZE',
    currency: 'INR',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    companyName: '',
    email: '',
    tier: 'BRONZE',
    status: 'ACTIVE',
  });

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/customers');
      if (res.success) {
        setCustomers(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Quick Tier Update Handler
  const handleQuickTierChange = async (customerId, newTier, customerName) => {
    setUpdatingTierId(customerId);
    try {
      const res = await fetchWithAuth(`/api/customers/${customerId}/tier`, {
        method: 'PATCH',
        body: JSON.stringify({ tier: newTier }),
      });

      if (res.success) {
        setNotification({
          type: 'success',
          message: res.message || `Customer tier updated to ${newTier}. AuditLog entry recorded.`,
        });
        // Update local state immediately
        setCustomers((prev) =>
          prev.map((c) => (c.id === customerId ? { ...c, tier: newTier } : c))
        );
      } else {
        setNotification({
          type: 'error',
          message: res.error?.message || 'Failed to update customer tier.',
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message || 'Error communicating with server.',
      });
    } finally {
      setUpdatingTierId(null);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Add Customer Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/customers', {
        method: 'POST',
        body: JSON.stringify(addForm),
      });

      if (res.success) {
        setNotification({
          type: 'success',
          message: `Customer "${addForm.companyName || addForm.name}" created with ${addForm.tier} tier.`,
        });
        setIsAddModalOpen(false);
        setAddForm({
          name: '',
          companyName: '',
          email: '',
          tier: 'BRONZE',
          currency: 'INR',
        });
        loadCustomers();
      } else {
        alert(res.error?.message || 'Failed to create customer');
      }
    } catch (err) {
      alert(err.message || 'Network error');
    }
  };

  // Edit Customer Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingCustomer) return;
    try {
      const res = await fetchWithAuth(`/api/customers/${editingCustomer.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });

      if (res.success) {
        setNotification({
          type: 'success',
          message: `Customer details updated successfully.`,
        });
        setIsEditModalOpen(false);
        setEditingCustomer(null);
        loadCustomers();
      } else {
        alert(res.error?.message || 'Failed to update customer');
      }
    } catch (err) {
      alert(err.message || 'Network error');
    }
  };

  const openEditModal = (cust) => {
    setEditingCustomer(cust);
    setEditForm({
      name: cust.name,
      companyName: cust.companyName || cust.name,
      email: cust.email,
      tier: cust.tier,
      status: cust.status || 'ACTIVE',
    });
    setIsEditModalOpen(true);
  };

  // Metrics
  const tierCounts = {
    GOLD: customers.filter((c) => c.tier === 'GOLD').length,
    SILVER: customers.filter((c) => c.tier === 'SILVER').length,
    BRONZE: customers.filter((c) => c.tier === 'BRONZE').length,
  };

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.companyName && c.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'ALL' || c.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="text-green-700" size={24} /> Customer Directory & Commercial Tier Governance
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Assign and govern organizational commercial tiers (BRONZE, SILVER, GOLD) that control automated CPQ discount ceilings and approval routing.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadCustomers}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-semibold flex items-center gap-1.5"
            title="Refresh list"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <PlusCircle size={15} /> Add Customer
          </button>
        </div>
      </div>

      {/* ── Notification Banner ───────────────────────────────── */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-700" />
            ) : (
              <AlertCircle size={16} className="text-red-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Tier Metric Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setTierFilter('ALL')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            tierFilter === 'ALL'
              ? 'bg-white border-green-700 ring-2 ring-green-600/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">All Accounts</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{customers.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Total managed clients</div>
        </div>

        <div
          onClick={() => setTierFilter('GOLD')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            tierFilter === 'GOLD'
              ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Gold Tier</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{tierCounts.GOLD}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Max discount allowance (15% HW / 10% Svc)</div>
        </div>

        <div
          onClick={() => setTierFilter('SILVER')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            tierFilter === 'SILVER'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Silver Tier</span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1">{tierCounts.SILVER}</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Mid allowance (10% HW / 7% Svc)</div>
        </div>

        <div
          onClick={() => setTierFilter('BRONZE')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            tierFilter === 'BRONZE'
              ? 'bg-orange-50/70 border-orange-400 ring-2 ring-orange-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">Bronze Tier</span>
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
          </div>
          <div className="text-2xl font-black text-orange-900 mt-1">{tierCounts.BRONZE}</div>
          <div className="text-[11px] text-orange-700 mt-0.5">Default new tier (5% HW / 3% Svc)</div>
        </div>
      </div>

      {/* ── Search & Filter Controls ──────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by company, customer name, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
          />
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Filter size={14} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-500">Tier:</span>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-600/30"
          >
            <option value="ALL">All Tiers ({customers.length})</option>
            <option value="GOLD">Gold Tier ({tierCounts.GOLD})</option>
            <option value="SILVER">Silver Tier ({tierCounts.SILVER})</option>
            <option value="BRONZE">Bronze Tier ({tierCounts.BRONZE})</option>
          </select>
        </div>
      </div>

      {/* ── Customer Accounts Table ───────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-7 h-7 text-green-700 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading customer directory...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No customers found matching the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-5 py-3.5">Customer & Organization</th>
                  <th className="px-5 py-3.5">Contact Email</th>
                  <th className="px-5 py-3.5">Commercial Tier</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((cust) => {
                  const style = TIER_STYLES[cust.tier] || TIER_STYLES.BRONZE;
                  const isUpdating = updatingTierId === cust.id;

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Customer / Company */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-center justify-center font-black flex-shrink-0">
                            <Building2 size={18} className="text-emerald-700" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">
                              {cust.companyName || cust.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Primary Contact: {cust.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Mail size={13} className="text-slate-400" />
                          <span>{cust.email}</span>
                        </div>
                      </td>

                      {/* Commercial Tier Selector (Dropdown) */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="relative inline-block">
                            <select
                              value={cust.tier}
                              disabled={isUpdating}
                              onChange={(e) =>
                                handleQuickTierChange(
                                  cust.id,
                                  e.target.value,
                                  cust.companyName || cust.name
                                )
                              }
                              className={`text-xs font-bold pl-2.5 pr-8 py-1.5 rounded-lg border appearance-none cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-green-600/30 ${
                                style.badge
                              } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                            >
                              <option value="BRONZE">BRONZE Tier</option>
                              <option value="SILVER">SILVER Tier</option>
                              <option value="GOLD">GOLD Tier</option>
                            </select>
                            <ChevronDown
                              size={13}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600"
                            />
                          </div>
                          {isUpdating && (
                            <RefreshCw size={12} className="animate-spin text-slate-500" />
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            cust.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              cust.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          ></span>
                          {cust.status || 'ACTIVE'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => openEditModal(cust)}
                          className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Edit2 size={12} /> Edit
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

      {/* ── Add Customer Modal ────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Building2 className="text-green-700" size={18} /> Add New Customer Account
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Company / Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={addForm.companyName}
                  onChange={(e) => setAddForm({ ...addForm, companyName: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Person Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. billing@acme.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Commercial Tier <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={addForm.tier}
                    onChange={(e) => setAddForm({ ...addForm, tier: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold focus:outline-none focus:ring-2 focus:ring-green-600/30"
                  >
                    <option value="BRONZE">BRONZE</option>
                    <option value="SILVER">SILVER</option>
                    <option value="GOLD">GOLD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <select
                    value={addForm.currency}
                    onChange={(e) => setAddForm({ ...addForm, currency: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold focus:outline-none focus:ring-2 focus:ring-green-600/30"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-700 text-white rounded-lg text-xs font-bold hover:bg-green-800 shadow-xs"
                >
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Customer Modal ────────────────────────────────── */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Edit2 className="text-green-700" size={18} /> Edit Customer Account
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Company / Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.companyName}
                  onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Person Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Commercial Tier <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editForm.tier}
                    onChange={(e) => setEditForm({ ...editForm, tier: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold focus:outline-none focus:ring-2 focus:ring-green-600/30"
                  >
                    <option value="BRONZE">BRONZE</option>
                    <option value="SILVER">SILVER</option>
                    <option value="GOLD">GOLD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-bold focus:outline-none focus:ring-2 focus:ring-green-600/30"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-700 text-white rounded-lg text-xs font-bold hover:bg-green-800 shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
