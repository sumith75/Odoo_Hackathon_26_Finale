import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  CreditCard,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';

export default function PaymentsView({ onNavigate }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Refund Modal State
  const [refundingPayment, setRefundingPayment] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = '/api/payments?limit=100';
      if (statusFilter) query += `&status=${statusFilter}`;
      if (methodFilter) query += `&paymentMethod=${methodFilter}`;

      const res = await fetchWithAuth(query);
      if (res.success) {
        setPayments(res.data || []);
      } else {
        setError(res.error?.message || 'Failed to fetch payments ledger');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching payment records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, methodFilter]);

  const handleExecuteRefund = async (e) => {
    e.preventDefault();
    if (!refundingPayment || !refundAmount || Number(refundAmount) <= 0) return;

    setRefundLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetchWithAuth(`/api/payments/${refundingPayment.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(refundAmount),
          reason: refundReason || 'Commercial adjustment via Payments Registry',
        }),
      });

      if (res.success) {
        setActionSuccess(res.message || 'Refund successfully executed.');
        setRefundingPayment(null);
        setRefundAmount('');
        setRefundReason('');
        await fetchPayments();
      } else {
        setActionError(res.error?.message || 'Refund failed');
      }
    } catch (err) {
      setActionError(err.message || 'Error processing refund');
    } finally {
      setRefundLoading(false);
    }
  };

  // Filter in memory for quick search by txn ref or customer name
  const filteredPayments = payments.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.transactionReference && p.transactionReference.toLowerCase().includes(term)) ||
      (p.customer?.name && p.customer.name.toLowerCase().includes(term)) ||
      (p.invoice?.invoiceNumber && p.invoice.invoiceNumber.toLowerCase().includes(term))
    );
  });

  // Calculate Rollups
  const totalCollected = payments
    .filter((p) => p.status === 'SUCCEEDED' || p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED' || p.status === 'REFUNDED')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalRefunded = payments.reduce((sum, p) => sum + Number(p.refundedAmount || 0), 0);
  const netSettlement = totalCollected - totalRefunded;

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <CreditCard size={24} className="text-green-700" />
            <span>Payments & Settlement Registry</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative transactional ledger of all inbound settlements, refunds, and gateway executions.
          </p>
        </div>

        <button
          onClick={fetchPayments}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer shadow-xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Financial KPI Strip ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Settlement</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            ₹{totalCollected.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">Authoritative Receipts</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Refunds Issued</span>
          <div className="text-2xl font-black text-amber-700 mt-1">
            ₹{totalRefunded.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 inline-block">Credit Adjustments</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Settlement</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            ₹{netSettlement.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-700 font-bold mt-1 inline-block">Retained Capital</span>
        </div>
      </div>

      {/* ── Status Alerts ─────────────────────────────────────── */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2 font-medium">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* ── Search & Filter Controls ─────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Txn Ref, Invoice, Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-green-600 focus:bg-white"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-hidden focus:ring-2 focus:ring-green-600 focus:bg-white"
          >
            <option value="">All Statuses</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
            <option value="REFUNDED">Refunded</option>
            <option value="FAILED">Failed</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-hidden focus:ring-2 focus:ring-green-600 focus:bg-white"
          >
            <option value="">All Methods</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="SIMULATED">Simulated</option>
            <option value="CARD">Card</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
          </select>
        </div>
      </div>

      {/* ── Refund Modal Overlay ──────────────────────────────── */}
      {refundingPayment && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Execute Refund for Payment: {refundingPayment.transactionReference}
              </h3>
              <p className="text-[11px] text-amber-800">
                Available refundable balance: ₹
                {(
                  Number(refundingPayment.amount) - Number(refundingPayment.refundedAmount || 0)
                ).toLocaleString('en-IN')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRefundingPayment(null)}
              className="text-amber-800 hover:text-amber-950 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleExecuteRefund} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">Refund Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  max={Number(refundingPayment.amount) - Number(refundingPayment.refundedAmount || 0)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">Reason for Refund</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Returned hardware, deal adjustment"
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={refundLoading}
              className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {refundLoading ? 'Processing Refund...' : `Confirm Refund of ₹${refundAmount || 0}`}
            </button>
          </form>
        </div>
      )}

      {/* ── Payments Table ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Transaction Ref</th>
              <th className="py-3 px-4">Invoice / Customer</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-green-700" />
                  Loading payment ledger...
                </td>
              </tr>
            ) : filteredPayments.length > 0 ? (
              filteredPayments.map((p) => {
                const refundable = Number(p.amount) - Number(p.refundedAmount || 0);
                const isRefundable =
                  (p.status === 'SUCCEEDED' || p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED') &&
                  refundable > 0.01;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {p.transactionReference}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{p.invoice?.invoiceNumber || '—'}</div>
                      <div className="text-[11px] text-slate-400">{p.customer?.name || 'Customer'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                        {p.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-extrabold text-slate-900">
                        ₹{Number(p.amount).toLocaleString('en-IN')}
                      </div>
                      {Number(p.refundedAmount || 0) > 0 && (
                        <div className="text-[10px] text-amber-700 font-bold">
                          -₹{Number(p.refundedAmount).toLocaleString('en-IN')} ref.
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          p.status === 'SUCCEEDED' || p.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'PARTIALLY_REFUNDED'
                            ? 'bg-amber-100 text-amber-800'
                            : p.status === 'REFUNDED'
                            ? 'bg-slate-100 text-slate-600 line-through'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-[11px] text-slate-500">
                      {new Date(p.paidAt || p.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {p.invoice?.id && (
                          <button
                            onClick={() => onNavigate && onNavigate('invoices', p.invoice.id)}
                            className="p-1.5 text-slate-500 hover:text-green-700 hover:bg-green-50 rounded-lg cursor-pointer"
                            title="View Invoice Dossier"
                          >
                            <ArrowRight size={14} />
                          </button>
                        )}
                        {isRefundable && (
                          <button
                            onClick={() => {
                              setRefundingPayment(p);
                              setRefundAmount(String(refundable));
                            }}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded text-[10px] font-bold cursor-pointer"
                            title="Issue Refund"
                          >
                            Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                  No payment records found matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
