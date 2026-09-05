import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function AuditActivityView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/audit');
      if (res.success) {
        setLogs(res.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEntity = entityFilter === 'ALL' || log.entityType === entityFilter;
    return matchesSearch && matchesEntity;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Header ──────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <History className="text-green-700" size={24} /> Audit Trail & System Events
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable, append-only security log of all administrative actions, rule modifications, and roster updates.
          </p>
        </div>

        <button
          onClick={loadAuditLogs}
          className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Logs
        </button>
      </div>

      {/* ── Filters & Search ────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, entity or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Filter size={14} className="text-slate-400" />
          {['ALL', 'USER', 'ORGANIZATION', 'PRODUCT', 'DISCOUNT_RULE', 'APPROVAL_RULE'].map(
            (ef) => (
              <button
                key={ef}
                onClick={() => setEntityFilter(ef)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  entityFilter === ef
                    ? 'bg-green-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {ef === 'ALL' ? 'All Entities' : ef.replace(/_/g, ' ')}
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Logs List ───────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-green-700 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading audit events...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No audit records found matching criteria.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const isExpanded = expandedId === log.id;
              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-green-700 border border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Layers size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase">
                            {log.entityType}
                          </span>
                          {log.entityId && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {log.entityId}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {new Date(log.createdAt).toLocaleString()}
                          </span>
                          {log.userId && (
                            <span className="flex items-center gap-1 font-mono text-slate-600">
                              <User size={12} /> Performer: {log.userId.slice(0, 10)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="text-slate-400 hover:text-slate-600 p-1 flex items-center gap-1 text-[11px] font-medium"
                      >
                        {isExpanded ? 'Hide Payload' : 'View Payload'}
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>

                  {isExpanded && log.metadata && (
                    <div className="mt-3 pl-11">
                      <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
