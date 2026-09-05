import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  Repeat,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Receipt,
  Play,
  Clock,
  Sparkles,
  ExternalLink,
  Pencil,
  XCircle,
} from 'lucide-react';

export default function SubscriptionsView({ onNavigate }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [editingQtyFor, setEditingQtyFor] = useState(null);
  const [qtyInput, setQtyInput] = useState('');

  const fetchSubscriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/finance/subscriptions');
      if (res.success) {
        setSubscriptions(res.data || []);
      } else {
        setError(res.error?.message || 'Failed to fetch subscriptions');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to subscription service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleBillCycle = async (subId) => {
    setActionLoading(subId);
    setActionMessage(null);
    try {
      const res = await fetchWithAuth(`/api/finance/subscriptions/${subId}/bill`, {
        method: 'POST',
      });
      if (res.success) {
        setActionMessage(res.message || 'Recurring invoice generated.');
        await fetchSubscriptions();
      } else {
        setError(res.error?.message || 'Billing cycle execution failed');
      }
    } catch (err) {
      setError(err.message || 'Error executing billing cycle');
    } finally {
      setActionLoading(null);
    }
  };

  const startEditQty = (sub) => {
    setEditingQtyFor(sub.id);
    setQtyInput(String(sub.quantity));
    setActionMessage(null);
  };

  const handleApplyQtyChange = async (subId) => {
    const newQuantity = parseInt(qtyInput, 10);
    if (!Number.isFinite(newQuantity) || newQuantity < 0) {
      setError('Enter a valid non-negative quantity.');
      return;
    }
    setActionLoading(subId);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/finance/subscriptions/${subId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: newQuantity, reason: 'Manual quantity change via Finance console' }),
      });
      if (res.success) {
        setActionMessage(res.message || 'Subscription quantity updated.');
        setEditingQtyFor(null);
        await fetchSubscriptions();
      } else {
        setError(res.error?.message || 'Quantity change failed');
      }
    } catch (err) {
      setError(err.message || 'Error changing subscription quantity');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async (subId) => {
    setActionLoading(subId);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/finance/subscriptions/${subId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled via Finance console' }),
      });
      if (res.success) {
        setActionMessage(res.message || 'Subscription cancelled.');
        await fetchSubscriptions();
      } else {
        setError(res.error?.message || 'Cancellation failed');
      }
    } catch (err) {
      setError(err.message || 'Error cancelling subscription');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Recurring Subscriptions & MRR Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Automated recurring revenue lifecycle management, billing cycle execution, and ARR forecasting.
          </p>
        </div>
        <button
          onClick={fetchSubscriptions}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2 font-medium">
          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* ── Subscriptions Table ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && subscriptions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-green-700" />
            <p className="text-xs font-medium">Loading active subscriptions...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 text-xs">
            <AlertTriangle size={20} className="mx-auto mb-1" />
            {error}
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Repeat size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-semibold text-slate-700">No active subscriptions</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Subscriptions are automatically created when deals containing recurring products are fulfilled.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Product / Plan</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Qty</th>
                  <th className="py-3 px-4">Monthly Rate</th>
                  <th className="py-3 px-4">Billing Cycle</th>
                  <th className="py-3 px-4">Next Billing Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{sub.product?.name || 'Subscription'}</div>
                      <span className="text-[11px] text-slate-400 font-normal">
                        Quote: {sub.quotation?.quoteNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{sub.customer?.name}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {editingQtyFor === sub.id ? (
                        <input
                          type="number"
                          min="0"
                          value={qtyInput}
                          onChange={(e) => setQtyInput(e.target.value)}
                          className="w-16 px-1.5 py-1 border border-slate-300 rounded text-xs"
                          autoFocus
                        />
                      ) : (
                        sub.quantity
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-purple-700">
                      ₹{Number(sub.recurringTotal).toLocaleString('en-IN')}/mo
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{sub.billingFrequency || 'MONTHLY'}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        {new Date(sub.nextBillingDate).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          sub.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <CheckCircle2 size={11} /> {sub.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {sub.status === 'ACTIVE' && editingQtyFor === sub.id ? (
                          <>
                            <button
                              onClick={() => handleApplyQtyChange(sub.id)}
                              disabled={actionLoading === sub.id}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading === sub.id ? 'Applying...' : 'Apply'}
                            </button>
                            <button
                              onClick={() => setEditingQtyFor(null)}
                              className="px-2 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        ) : sub.status === 'ACTIVE' ? (
                          <>
                            <button
                              onClick={() => handleBillCycle(sub.id)}
                              disabled={actionLoading === sub.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Play size={12} />
                              <span>{actionLoading === sub.id ? 'Billing...' : 'Bill Cycle'}</span>
                            </button>
                            <button
                              onClick={() => startEditQty(sub)}
                              disabled={actionLoading === sub.id}
                              title="Change quantity (prorated)"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleCancelSubscription(sub.id)}
                              disabled={actionLoading === sub.id}
                              title="Cancel subscription (unused-time credit)"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 cursor-pointer disabled:opacity-50"
                            >
                              <XCircle size={12} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">No actions</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
