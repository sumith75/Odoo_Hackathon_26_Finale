import React, { useState, useEffect } from 'react';
import {
  History,
  ShieldAlert,
  CheckCircle2,
  Settings,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  User,
  Globe,
  Calendar,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';

export default function AdminActivityCenter() {
  const [metrics, setMetrics] = useState({
    totalToday: 0,
    riskEventsCount: 0,
    approvalsCount: 0,
    policyChangesCount: 0,
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [actorRole, setActorRole] = useState('');
  const [entityType, setEntityType] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const token = localStorage.getItem('dealflow_token');

  const fetchActivity = async () => {
    setLoading(true);
    try {
      let query = `/api/audit/activity?page=${page}&limit=20`;
      if (category !== 'ALL') query += `&category=${category}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;
      if (actorRole) query += `&actorRole=${actorRole}`;
      if (entityType) query += `&entityType=${entityType}`;

      const res = await fetch(query, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        if (data.metrics) setMetrics(data.metrics);
        setLogs(data.data || []);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error('System Activity Center fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, [page, category, actorRole, entityType]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchActivity();
  };

  const getActorRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded">Admin</span>;
      case 'SALES_MANAGER':
        return <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Manager</span>;
      case 'SALES_REP':
        return <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Sales Rep</span>;
      case 'CUSTOMER':
        return <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Customer</span>;
      case 'FINANCE_OPERATIONS':
        return <span className="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded">Finance</span>;
      default:
        return <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">System</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-700 text-white flex items-center justify-center font-bold">
              <History size={18} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Activity Center</h1>
          </div>
          <p className="text-sm text-slate-500">
            Immutable system audit logs, policy change records, governance actions, and real-time security events.
          </p>
        </div>
        <button
          onClick={fetchActivity}
          className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Stream
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Events Today</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{metrics.totalToday}</div>
          <span className="text-[11px] font-semibold text-slate-400">Total recorded system events</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Risk Alerts</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700">{metrics.riskEventsCount}</div>
          <span className="text-[11px] font-semibold text-slate-400">Margin & ceiling violations</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approvals Executed</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{metrics.approvalsCount}</div>
          <span className="text-[11px] font-semibold text-slate-400">Manager & finance decisions</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Policy Changes</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
              <Settings size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-700">{metrics.policyChangesCount}</div>
          <span className="text-[11px] font-semibold text-slate-400">Rules & tier modifications</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search by action, description, or entity ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-xs bg-transparent outline-none text-slate-800 placeholder-slate-400 font-medium"
            />
          </div>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-slate-700"
          >
            <option value="ALL">All Event Categories</option>
            <option value="HIGH_RISK">High Risk & Alerts</option>
            <option value="APPROVALS">Approvals & Governance</option>
            <option value="SYSTEM">System & Policy Settings</option>
          </select>

          <select
            value={actorRole}
            onChange={(e) => {
              setActorRole(e.target.value);
              setPage(1);
            }}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-slate-700"
          >
            <option value="">All Actor Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="SALES_MANAGER">Sales Manager</option>
            <option value="SALES_REP">Sales Rep</option>
            <option value="CUSTOMER">Customer</option>
            <option value="FINANCE_OPERATIONS">Finance</option>
          </select>

          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-slate-700"
          >
            <option value="">All Entities</option>
            <option value="QUOTATION">Quotation</option>
            <option value="CUSTOMER">Customer</option>
            <option value="USER">User Account</option>
            <option value="PRODUCT">Product</option>
            <option value="DISCOUNT_RULE">Discount Rule</option>
            <option value="APPROVAL_RULE">Approval Rule</option>
          </select>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading system activity stream...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No activity logs found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">
                          {log.user?.name || log.actorRole || 'System'}
                        </span>
                        {getActorRoleBadge(log.actorRole)}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        {log.entityType} {log.entityId ? `#${log.entityId.slice(0, 8)}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-600">
                      {log.description || '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-xs font-bold text-green-700 hover:text-green-800 flex items-center gap-1 ml-auto bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <Eye size={13} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-200">
            <span className="text-xs font-medium text-slate-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total logs)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-600"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-600"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payload Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Audit Log Details</h3>
                <span className="text-xs font-semibold text-slate-500">Log ID: {selectedLog.id}</span>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 block font-semibold mb-0.5">Action:</span>
                <span className="font-bold text-slate-900">{selectedLog.action}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 block font-semibold mb-0.5">Timestamp:</span>
                <span className="font-bold text-slate-900">{new Date(selectedLog.createdAt).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 block font-semibold mb-0.5">Actor:</span>
                <span className="font-bold text-slate-900">{selectedLog.user?.name || selectedLog.actorRole || 'System'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 block font-semibold mb-0.5">IP Address:</span>
                <span className="font-bold text-slate-900">{selectedLog.ipAddress || 'Internal/Local'}</span>
              </div>
            </div>

            {selectedLog.description && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block font-semibold mb-0.5">Description:</span>
                <p className="font-medium text-slate-800">{selectedLog.description}</p>
              </div>
            )}

            {selectedLog.metadata && (
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">Metadata Payload:</span>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.beforeState && (
              <div>
                <span className="text-xs font-bold text-amber-600 block mb-1">Before State:</span>
                <pre className="p-3 bg-slate-900 text-amber-300 rounded-xl text-xs font-mono overflow-x-auto">
                  {JSON.stringify(selectedLog.beforeState, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.afterState && (
              <div>
                <span className="text-xs font-bold text-emerald-600 block mb-1">After State:</span>
                <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl text-xs font-mono overflow-x-auto">
                  {JSON.stringify(selectedLog.afterState, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
