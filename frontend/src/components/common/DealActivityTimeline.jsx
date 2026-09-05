import React, { useState, useEffect } from 'react';
import {
  History,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Send,
  MessageSquare,
  ShieldAlert,
  FileCheck,
  Package,
  FileText,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function DealActivityTimeline({ entityType = 'QUOTATION', entityId, showInternalDetails = true }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const token = localStorage.getItem('dealflow_token');

  useEffect(() => {
    if (!entityId) return;

    const fetchTimeline = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/audit/entity/${entityType}/${entityId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setLogs(data.data || []);
        } else {
          setError(data.error?.message || 'Failed to load deal activity timeline.');
        }
      } catch (err) {
        console.error('Timeline fetch error:', err);
        setError('Network error fetching timeline.');
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [entityType, entityId]);

  const getActionIcon = (action) => {
    if (action?.includes('APPROVED') || action?.includes('ACCEPT'))
      return <CheckCircle2 size={16} className="text-green-600" />;
    if (action?.includes('REJECTED'))
      return <XCircle size={16} className="text-red-600" />;
    if (action?.includes('RETURN'))
      return <RotateCcw size={16} className="text-amber-600" />;
    if (action?.includes('SUBMIT') || action?.includes('SENT'))
      return <Send size={16} className="text-blue-600" />;
    if (action?.includes('COUNTER') || action?.includes('NEGOTIAT') || action?.includes('COMMENT'))
      return <MessageSquare size={16} className="text-purple-600" />;
    if (action?.includes('RISK') || action?.includes('VIOLATION'))
      return <ShieldAlert size={16} className="text-rose-600" />;
    if (action?.includes('CONFIRM'))
      return <FileCheck size={16} className="text-emerald-600" />;
    if (action?.includes('FULFILL'))
      return <Package size={16} className="text-emerald-700" />;
    return <FileText size={16} className="text-slate-500" />;
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

  if (loading) {
    return <div className="p-6 text-center text-xs text-slate-400">Loading activity timeline...</div>;
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs">{error}</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-400">
        <History size={20} className="mx-auto mb-1 text-slate-300" />
        No audit activity recorded for this record yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <History size={15} className="text-green-700" /> Activity & Governance Audit Trail
        </h3>
        <span className="text-[11px] font-semibold text-slate-500">{logs.length} events</span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {logs.map((log) => {
          const isExpanded = expandedId === log.id;
          const hasMetadata = log.metadata || log.beforeState || log.afterState;

          return (
            <div key={log.id} className="relative group">
              {/* Point Node */}
              <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center shadow-xs group-hover:border-green-700 transition-colors">
                {getActionIcon(log.action)}
              </div>

              {/* Card */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{log.action.replace(/_/g, ' ')}</span>
                    {getActorRoleBadge(log.actorRole)}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock size={12} />
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-snug mb-1">
                  {log.description || `${log.action} performed.`}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1 font-medium">
                    <User size={12} /> {log.user?.name || 'System / Customer'}
                  </span>

                  {showInternalDetails && hasMetadata && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      className="text-green-700 hover:text-green-800 font-bold flex items-center gap-1 transition-colors"
                    >
                      <span>{isExpanded ? 'Hide Payload' : 'View Payload'}</span>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>

                {/* Expanded Payload / State diff */}
                {isExpanded && showInternalDetails && (
                  <div className="mt-3 p-3 bg-slate-900 text-slate-200 rounded-lg text-[11px] font-mono overflow-x-auto space-y-2">
                    {log.metadata && (
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Metadata:</div>
                        <pre className="text-[10px] leading-relaxed">{JSON.stringify(log.metadata, null, 2)}</pre>
                      </div>
                    )}
                    {log.beforeState && (
                      <div>
                        <div className="text-[10px] text-amber-400 font-bold uppercase mb-1">Before State:</div>
                        <pre className="text-[10px] leading-relaxed">{JSON.stringify(log.beforeState, null, 2)}</pre>
                      </div>
                    )}
                    {log.afterState && (
                      <div>
                        <div className="text-[10px] text-emerald-400 font-bold uppercase mb-1">After State:</div>
                        <pre className="text-[10px] leading-relaxed">{JSON.stringify(log.afterState, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
