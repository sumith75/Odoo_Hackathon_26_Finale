import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Shield,
  Briefcase,
  FileSpreadsheet,
  ShieldCheck,
  RefreshCw,
  X,
  Lock,
  Mail,
  Phone,
  User,
} from 'lucide-react';

const ROLE_CONFIG = {
  SALES_REP: {
    label: 'Sales Rep',
    fullLabel: 'Sales Representative',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Briefcase,
  },
  SALES_MANAGER: {
    label: 'Sales Manager',
    fullLabel: 'Sales Manager',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: Shield,
  },
  FINANCE_OPERATIONS: {
    label: 'Finance / Ops',
    fullLabel: 'Finance & Operations',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: FileSpreadsheet,
  },
  ADMIN: {
    label: 'Admin',
    fullLabel: 'Organization Admin',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: ShieldCheck,
  },
};

export default function TeamManagement() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SALES_REP',
    phone: '',
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [statusActionId, setStatusActionId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const loadTeam = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/team');
      if (res.success) {
        setMembers(res.data);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to load team members' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, []);

  const handleToggleStatus = async (member) => {
    const newStatus = member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setStatusActionId(member.id);
    try {
      const res = await fetchWithAuth(`/api/team/${member.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success) {
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, status: newStatus } : m))
        );
        setFeedback({
          type: 'success',
          text: `User ${member.name} is now ${newStatus.toLowerCase()}`,
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update status' });
    } finally {
      setStatusActionId(null);
      setTimeout(() => setFeedback({ type: '', text: '' }), 3000);
    }
  };

  const handleDelete = async (member) => {
    if (!window.confirm(`Delete team member "${member.name}" (${member.email})? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`/api/team/${member.id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
        setFeedback({ type: 'success', text: `Deleted "${member.name}".` });
      }
    } catch (err) {
      // The backend puts the useful message under error.error.message (e.g.
      // "this member has quotes/history, deactivate instead") — fetchWithAuth
      // only reads a top-level `message`, so pull the real one from err.data.
      const detailedMessage = err.data?.error?.message;
      setFeedback({
        type: 'error',
        text: detailedMessage || err.message || 'Failed to delete team member.',
      });
    } finally {
      setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFeedback({ type: '', text: '' });

    try {
      const res = await fetchWithAuth('/api/team', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          text: `Employee account created! ${form.name} can now sign in immediately.`,
        });
        setIsAddModalOpen(false);
        setForm({ name: '', email: '', password: '', role: 'SALES_REP', phone: '' });
        await loadTeam();
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to create team member' });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFeedback({ type: '', text: '' });

    try {
      const payload = {
        name: editingMember.name,
        role: editingMember.role,
        phone: editingMember.phone,
      };
      if (editingMember.password) {
        payload.password = editingMember.password;
      }

      const res = await fetchWithAuth(`/api/team/${editingMember.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setFeedback({ type: 'success', text: `Updated ${editingMember.name} successfully.` });
        setIsEditModalOpen(false);
        setEditingMember(null);
        await loadTeam();
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update member' });
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Header ──────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Users className="text-green-700" size={24} /> Team & User Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision employee access for Sales Representatives, Sales Managers, and Finance Operations.
          </p>
        </div>

        <button
          onClick={() => {
            setForm({ name: '', email: '', password: '', role: 'SALES_REP', phone: '' });
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-xs"
        >
          <UserPlus size={16} /> + Add Team Member
        </button>
      </div>

      {/* ── Alert / Feedback ────────────────────────────────── */}
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

      {/* ── Filters & Search ────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Filter size={14} className="text-slate-400" />
          {['ALL', 'SALES_REP', 'SALES_MANAGER', 'FINANCE_OPERATIONS', 'ADMIN'].map((rf) => (
            <button
              key={rf}
              onClick={() => setRoleFilter(rf)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                roleFilter === rf
                  ? 'bg-green-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {rf === 'ALL' ? 'All Roles' : ROLE_CONFIG[rf]?.label || rf}
            </button>
          ))}
        </div>
      </div>

      {/* ── Members Table ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-green-700 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading roster...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No team members found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Member</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Contact Phone</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredMembers.map((member) => {
                  const roleCfg = ROLE_CONFIG[member.role] || {
                    label: member.role,
                    badge: 'bg-gray-100 text-gray-700',
                  };
                  const isStatusToggling = statusActionId === member.id;

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                            {member.name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{member.name}</div>
                            <div className="text-slate-500 text-[11px]">{member.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${roleCfg.badge}`}
                        >
                          {roleCfg.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {member.phone || '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleStatus(member)}
                          disabled={isStatusToggling}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                            member.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              member.status === 'ACTIVE' ? 'bg-emerald-600' : 'bg-slate-400'
                            }`}
                          />
                          {member.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingMember({
                                id: member.id,
                                name: member.name,
                                email: member.email,
                                role: member.role,
                                phone: member.phone || '',
                                password: '',
                              });
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-green-700 hover:bg-slate-100 rounded-md transition-colors"
                            title="Edit member"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(member)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete member"
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

      {/* ── ADD TEAM MEMBER MODAL ───────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus size={18} className="text-green-700" /> Provision New Team Member
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
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="rahul@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 font-medium"
                >
                  <option value="SALES_REP">Sales Representative (Create Quotes & Deals)</option>
                  <option value="SALES_MANAGER">Sales Manager (Approve Quote Discounts)</option>
                  <option value="FINANCE_OPERATIONS">Finance & Operations (Billing & Invoices)</option>
                  <option value="ADMIN">Administrator (Full Tenant Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  User will use this password to immediately log in at the portal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="+91 98765 00000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
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
                  disabled={formSubmitting}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> Provisioning...
                    </>
                  ) : (
                    'Provision Member'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT TEAM MEMBER MODAL ──────────────────────────── */}
      {isEditModalOpen && editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 size={18} className="text-green-700" /> Edit Member: {editingMember.email}
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
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingMember.name}
                  onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
                <select
                  value={editingMember.role}
                  onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 font-medium"
                >
                  <option value="SALES_REP">Sales Representative</option>
                  <option value="SALES_MANAGER">Sales Manager</option>
                  <option value="FINANCE_OPERATIONS">Finance & Operations</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editingMember.phone}
                  onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reset Password (Leave blank to keep existing)
                </label>
                <input
                  type="password"
                  placeholder="New password (optional)"
                  value={editingMember.password || ''}
                  onChange={(e) => setEditingMember({ ...editingMember, password: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
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
                  disabled={formSubmitting}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
