import React, { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  Users,
  Package,
  Percent,
  CheckCheck,
  Building2,
  TrendingUp,
  Clock,
  ArrowRight,
  PlusCircle,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export default function AdminDashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth('/api/admin/dashboard');
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.message || 'Failed to load dashboard metrics');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-green-700 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading organization metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
        <p className="font-bold">Error loading dashboard</p>
        <p className="mt-1">{error}</p>
        <button
          onClick={loadDashboard}
          className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { organization, team, products, rules, recentActivity } = data || {};

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
              Admin Overview
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Tenant ID: {organization?.id}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            {organization?.name || 'Organization Workspace'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your sales engine, team roster, multi-tier pricing, and approval workflows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboard}
            title="Refresh metrics"
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => onNavigate('organization')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Building2 size={14} /> Org Settings
          </button>
        </div>
      </div>

      {/* ── Key Metrics Grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div
          onClick={() => onNavigate('team')}
          className="bg-white border border-slate-200 hover:border-green-600 p-5 rounded-xl shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Team Roster</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-green-700 flex items-center justify-center group-hover:bg-green-700 group-hover:text-white transition-colors">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900">{team?.total || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">members</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
            <span className="font-semibold text-blue-700">{team?.salesReps || 0} Reps</span>
            <span>•</span>
            <span className="font-semibold text-amber-700">{team?.salesManagers || 0} Mgrs</span>
            <span>•</span>
            <span className="font-semibold text-emerald-700">{team?.financeOps || 0} Fin</span>
          </div>
        </div>

        {/* Customer Accounts & Commercial Tiers */}
        <div
          onClick={() => onNavigate('customers')}
          className="bg-white border border-slate-200 hover:border-green-600 p-5 rounded-xl shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer Directory</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-green-700 flex items-center justify-center group-hover:bg-green-700 group-hover:text-white transition-colors">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-slate-900">Commercial Tiers</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
            <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">GOLD</span>
            <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">SILVER</span>
            <span className="font-bold text-orange-800 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">BRONZE</span>
          </div>
        </div>

        {/* Product Catalog */}
        <div
          onClick={() => onNavigate('products')}
          className="bg-white border border-slate-200 hover:border-green-600 p-5 rounded-xl shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catalog Products</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-green-700 flex items-center justify-center group-hover:bg-green-700 group-hover:text-white transition-colors">
              <Package size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900">{products?.total || 0}</span>
            <span className="text-xs text-emerald-700 font-semibold ml-1.5">
              ({products?.active || 0} Active)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
            <span>{products?.byType?.HARDWARE || 0} Hardw</span>
            <span>•</span>
            <span>{products?.byType?.SERVICE || 0} Serv</span>
            <span>•</span>
            <span>{products?.byType?.SUBSCRIPTION || 0} Sub</span>
          </div>
        </div>

        {/* Discount Rules */}
        <div
          onClick={() => onNavigate('discount-rules')}
          className="bg-white border border-slate-200 hover:border-green-600 p-5 rounded-xl shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Discount Rules</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-green-700 flex items-center justify-center group-hover:bg-green-700 group-hover:text-white transition-colors">
              <Percent size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900">{rules?.discountRules || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">rules active</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Automated customer & tier discount policy
          </div>
        </div>

        {/* Approval Rules */}
        <div
          onClick={() => onNavigate('approval-rules')}
          className="bg-white border border-slate-200 hover:border-green-600 p-5 rounded-xl shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approval Ladder</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-green-700 flex items-center justify-center group-hover:bg-green-700 group-hover:text-white transition-colors">
              <CheckCheck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900">{rules?.approvalRules || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">thresholds</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Manager & Finance approval chains
          </div>
        </div>
      </div>

      {/* ── Quick Actions Bar ──────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
          Quick Setup Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('team')}
            className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-green-600 hover:bg-emerald-50/40 text-left transition-all group"
          >
            <div>
              <div className="text-sm font-bold text-slate-800 group-hover:text-green-800">
                + Add Team Member
              </div>
              <div className="text-xs text-slate-500">Provision sales or finance user</div>
            </div>
            <ArrowRight size={16} className="text-slate-400 group-hover:text-green-700" />
          </button>

          <button
            onClick={() => onNavigate('products')}
            className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-green-600 hover:bg-emerald-50/40 text-left transition-all group"
          >
            <div>
              <div className="text-sm font-bold text-slate-800 group-hover:text-green-800">
                + Add Product
              </div>
              <div className="text-xs text-slate-500">Hardware, service, or subscription</div>
            </div>
            <ArrowRight size={16} className="text-slate-400 group-hover:text-green-700" />
          </button>

          <button
            onClick={() => onNavigate('discount-rules')}
            className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-green-600 hover:bg-emerald-50/40 text-left transition-all group"
          >
            <div>
              <div className="text-sm font-bold text-slate-800 group-hover:text-green-800">
                + Add Discount Rule
              </div>
              <div className="text-xs text-slate-500">Tier limits & auto approvals</div>
            </div>
            <ArrowRight size={16} className="text-slate-400 group-hover:text-green-700" />
          </button>

          <button
            onClick={() => onNavigate('approval-rules')}
            className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-green-600 hover:bg-emerald-50/40 text-left transition-all group"
          >
            <div>
              <div className="text-sm font-bold text-slate-800 group-hover:text-green-800">
                + Add Approval Rule
              </div>
              <div className="text-xs text-slate-500">Multi-tier signoff thresholds</div>
            </div>
            <ArrowRight size={16} className="text-slate-400 group-hover:text-green-700" />
          </button>
        </div>
      </div>

      {/* ── Recent Activity Feed ───────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Organization Activity</h2>
            <p className="text-xs text-slate-500">Real-time audit trail of changes within this tenant</p>
          </div>
          <button
            onClick={() => onNavigate('audit')}
            className="text-xs font-bold text-green-700 hover:text-green-800 flex items-center gap-1"
          >
            View Full Trail <ArrowRight size={13} />
          </button>
        </div>

        {recentActivity && recentActivity.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {recentActivity.map((log) => (
              <div key={log.id} className="py-3 flex items-start justify-between text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800">{log.action.replace(/_/g, ' ')}</span>
                    <span className="text-slate-500 ml-1.5">
                      on <span className="font-semibold text-slate-700">{log.entityType}</span>
                      {log.entityId && ` (${log.entityId.slice(0, 8)}...)`}
                    </span>
                    {log.metadata && typeof log.metadata === 'object' && Object.keys(log.metadata).length > 0 && (
                      <span className="text-slate-400 block text-[11px] mt-0.5 font-mono">
                        {JSON.stringify(log.metadata)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-slate-400 whitespace-nowrap ml-4">
                  {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            No activity logs recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
