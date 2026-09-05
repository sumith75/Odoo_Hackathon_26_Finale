import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  History,
  CheckCircle2,
  XCircle,
  RotateCcw,
  RefreshCw,
  Building2,
  User,
  ShieldCheck,
} from 'lucide-react';

export default function ApprovalHistoryView({ onSelectQuote }) {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth('/api/manager/history');
      if (res.success) {
        setHistory(res.data || []);
      } else {
        setError(res.error?.message || 'Failed to load approval history.');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manager Approval History</h1>
          <p className="text-xs text-slate-500 mt-1">
            Historical log of commercial sign-offs, rejections, and revision requests
          </p>
        </div>

        <button
          onClick={loadHistory}
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh History</span>
        </button>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <RefreshCw className="w-8 h-8 text-green-700 animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading decision history...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-700 bg-red-50">
            <p className="font-bold">{error}</p>
          </div>
        ) : history.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400">
            <History size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-slate-700 text-sm">No approval history yet</p>
            <p className="mt-1">When managers approve, reject, or return quotes, records will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Quote #</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Approver</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-center">Margin</th>
                  <th className="px-4 py-3">Reason / Comment</th>
                  <th className="px-4 py-3 text-center">Date & Time</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {history.map((h) => {
                  const isApprove = h.status === 'APPROVED';
                  const isReject = h.status === 'REJECTED';
                  const isReturn = h.status === 'RETURNED_FOR_REVISION';

                  return (
                    <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {h.quotation?.quoteNumber}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isApprove
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : isReject
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}
                        >
                          {isApprove && <CheckCircle2 size={11} />}
                          {isReject && <XCircle size={11} />}
                          {isReturn && <RotateCcw size={11} />}
                          {h.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {h.approver?.name || 'Sales Manager'}
                      </td>

                      <td className="px-4 py-3 text-slate-800 font-semibold">
                        {h.quotation?.customer?.name}
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-right text-slate-900 whitespace-nowrap">
                        {currency === 'INR' ? '₹' : '$'}
                        {Number(h.quotation?.totalAmount || 0).toLocaleString()}
                      </td>

                      <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700">
                        {h.marginPercentageAtDecision ? `${h.marginPercentageAtDecision}%` : '-'}
                      </td>

                      <td className="px-4 py-3 max-w-xs text-slate-600 truncate">
                        {h.reason || h.comment || <span className="text-slate-400 italic">No comment</span>}
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {h.actedAt ? new Date(h.actedAt).toLocaleString() : new Date(h.createdAt).toLocaleString()}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onSelectQuote(h.quotationId)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold transition-colors cursor-pointer"
                        >
                          View Dossier
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
    </div>
  );
}
