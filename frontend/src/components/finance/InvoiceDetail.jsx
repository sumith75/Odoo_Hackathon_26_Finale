import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Receipt,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CreditCard,
  Building2,
  RefreshCw,
  Send,
  Printer,
  ShieldCheck,
} from 'lucide-react';

export default function InvoiceDetail({ invoiceId, onBack }) {
  const { user } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Payment form state
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payNotes, setPayNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [paymentError, setPaymentError] = useState(null);

  const fetchInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/finance/invoices/${invoiceId}`);
      if (res.success) {
        setInvoice(res.data);
        if (res.data?.amountDue) {
          setPayAmount(String(res.data.amountDue));
        }
      } else {
        setError(res.error?.message || 'Invoice not found');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to billing service');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrg = async () => {
    try {
      const res = await fetchWithAuth('/api/organization');
      if (res.success) setOrgData(res.data);
    } catch {}
  };

  // Refund state
  const [refundingPaymentId, setRefundingPaymentId] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  useEffect(() => {
    fetchInvoice();
    fetchOrg();
  }, [invoiceId]);

  const handleSimulatePayment = async (e) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) {
      setPaymentError('Please specify a valid payment amount.');
      return;
    }

    setSubmittingPayment(true);
    setPaymentError(null);
    setPaymentSuccess(null);

    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    try {
      const res = await fetchWithAuth(`/api/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(payAmount),
          paymentMethod: payMethod,
          method: payMethod,
          notes: payNotes || 'Settlement via Finance Portal',
          idempotencyKey,
        }),
      });

      if (res.success) {
        setPaymentSuccess(res.message || 'Payment successfully settled.');
        setPayNotes('');
        await fetchInvoice();
      } else {
        setPaymentError(res.error?.message || 'Payment processing failed');
      }
    } catch (err) {
      setPaymentError(err.message || 'Error processing payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleExecuteRefund = async (e) => {
    e.preventDefault();
    if (!refundingPaymentId || !refundAmount || Number(refundAmount) <= 0) {
      setPaymentError('Please specify a valid refund amount.');
      return;
    }

    setSubmittingRefund(true);
    setPaymentError(null);
    setPaymentSuccess(null);

    try {
      const res = await fetchWithAuth(`/api/payments/${refundingPaymentId}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(refundAmount),
          reason: refundReason || 'Commercial settlement adjustment',
        }),
      });

      if (res.success) {
        setPaymentSuccess(res.message || 'Refund successfully processed.');
        setRefundingPaymentId(null);
        setRefundAmount('');
        setRefundReason('');
        await fetchInvoice();
      } else {
        setPaymentError(res.error?.message || 'Refund processing failed');
      }
    } catch (err) {
      setPaymentError(err.message || 'Error executing refund');
    } finally {
      setSubmittingRefund(false);
    }
  };

  if (loading && !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw size={28} className="animate-spin text-green-700 mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Invoice Dossier...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center max-w-lg mx-auto mt-10">
        <AlertTriangle size={32} className="text-red-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-red-900">Error Loading Invoice</h3>
        <p className="text-xs text-red-700 mt-1 mb-4">{error || 'Invoice not found'}</p>
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 cursor-pointer"
        >
          Back to Invoices
        </button>
      </div>
    );
  }

  const isFullyPaid = invoice.status === 'PAID';
  const payments = invoice.payments || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Invoices</span>
        </button>

        <span
          className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
            isFullyPaid
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-amber-100 text-amber-800 border border-amber-200'
          }`}
        >
          {isFullyPaid ? <CheckCircle2 size={13} /> : <Clock size={13} />}
          {invoice.status}
        </span>
      </div>

      {/* ── Formal Invoice Document Card ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-700 text-white font-bold rounded-lg flex items-center justify-center text-sm">
                D
              </div>
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">DealFlow360</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {orgData?.name || user?.organizationName || 'Your Organization'}
              {orgData?.address && <><br />{orgData.address}</>}
              {orgData?.companyEmail && <><br />{orgData.companyEmail}</>}
            </p>
          </div>

          <div className="sm:text-right">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">TAX INVOICE</h2>
            <p className="text-xs font-mono font-bold text-slate-700 mt-1">{invoice.invoiceNumber}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Date: {new Date(invoice.createdAt).toLocaleDateString()}<br />
              Type: <strong className="text-slate-700">{invoice.invoiceType}</strong>
            </p>
          </div>
        </div>

        {/* Bill To Info */}
        <div className="grid grid-cols-2 gap-6 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Billed To</span>
            <h3 className="text-sm font-bold text-slate-900 mt-1">{invoice.customer?.name}</h3>
            <p className="text-slate-500 mt-0.5">{invoice.customer?.email}</p>
            <p className="text-slate-500">Tier: {invoice.customer?.tier || 'STANDARD'}</p>
          </div>
          <div className="sm:text-right">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Reference</span>
            <p className="text-xs font-bold text-slate-800 mt-1">
              Quote: {invoice.quotation?.quoteNumber || '—'}
            </p>
            <p className="text-slate-500">Currency: {invoice.currency || 'INR'}</p>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                <th className="py-2.5 px-4">Item & Description</th>
                <th className="py-2.5 px-4 text-center">Qty</th>
                <th className="py-2.5 px-4 text-right">Unit Price</th>
                <th className="py-2.5 px-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{item.description}</div>
                      <div className="text-[11px] text-slate-400">{item.product?.sku}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">{item.quantity}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-600">
                      ₹{Number(item.unitPrice).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      ₹{Number(item.lineTotal).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                    No line items attached.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Totals */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-100 text-xs">
          <div className="text-slate-400 text-[11px] max-w-xs leading-relaxed">
            Payment Terms: Immediate upon receipt.<br />
            Self-governing immutable invoice record generated by DealFlow360 Multi-Tenant Engine.
          </div>

          <div className="space-y-2 min-w-64">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold">₹{Number(invoice.subtotal).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax (GST 18%):</span>
              <span className="font-semibold">₹{Number(invoice.taxAmount).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
              <span>Grand Total:</span>
              <span className="text-emerald-700">₹{Number(invoice.totalAmount).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-700 pt-1">
              <span>Amount Paid:</span>
              <span className="text-emerald-700">₹{Number(invoice.amountPaid).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-100">
              <span>Amount Due:</span>
              <span className={Number(invoice.amountDue) > 0 ? 'text-amber-700' : 'text-slate-400'}>
                ₹{Number(invoice.amountDue).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment Simulation Panel (Interactive) ─────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <CreditCard size={18} className="text-green-700" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Simulate Payment Settlement
            </h3>
            <p className="text-[11px] text-slate-500">
              Execute transactional settlement. Idempotently sets invoice to PAID and syncs quote status.
            </p>
          </div>
        </div>

        {paymentSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2 font-medium">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{paymentSuccess}</span>
          </div>
        )}

        {paymentError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2 font-medium">
            <AlertTriangle size={15} className="text-red-600 shrink-0" />
            <span>{paymentError}</span>
          </div>
        )}

        {!isFullyPaid ? (
          <form onSubmit={handleSimulatePayment} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">Payment Amount (₹)</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(invoice.amountDue))}
                      className="px-2 py-0.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded text-[10px] font-bold cursor-pointer"
                    >
                      Full Balance
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(Math.round((Number(invoice.amountDue) / 2) * 100) / 100))}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-[10px] font-bold cursor-pointer"
                    >
                      50% Partial
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  max={invoice.amountDue}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-green-600 focus:bg-white"
                  placeholder="e.g. 820000"
                  required
                />
                <div className="flex items-center justify-between text-slate-500 text-[11px] mt-1">
                  <span>Balance after payment:</span>
                  <span className="font-extrabold text-slate-900">
                    ₹{Math.max(0, Number(invoice.amountDue) - Number(payAmount || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-green-600 focus:bg-white"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / Wire)</option>
                  <option value="SIMULATED">Direct Settlement (Simulated Gateway)</option>
                  <option value="CARD">Corporate Credit / Debit Card</option>
                  <option value="UPI">UPI Enterprise / QR Settlement</option>
                  <option value="CASH">Cash / Physical Receipt</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Backend-authoritative provider execution via SimulatedPaymentProvider.
                </p>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Notes / Transaction Reference</label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="e.g. Wire transfer reference, purchase order notes"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-green-600 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submittingPayment || Number(invoice.amountDue) <= 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <CreditCard size={15} />
              <span>
                {submittingPayment
                  ? 'Processing Settlement...'
                  : `Record Payment of ₹${Number(payAmount || 0).toLocaleString('en-IN')}`}
              </span>
            </button>
          </form>
        ) : (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <span>This invoice is fully paid and settled in PostgreSQL.</span>
            </div>
            <span className="font-extrabold text-emerald-800 text-sm">₹0.00 Outstanding</span>
          </div>
        )}
      </div>

      {/* ── Payments History Log & Refund Controls ──────────────── */}
      {payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
              Settlement & Payment Registry ({payments.length})
            </h4>
            <span className="text-[11px] text-slate-500 font-semibold">Authoritative Ledger</span>
          </div>

          {/* Inline Refund Modal/Form */}
          {refundingPaymentId && (
            <form onSubmit={handleExecuteRefund} className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900">Issue Refund for Payment #{refundingPaymentId.substring(0, 8)}</span>
                <button
                  type="button"
                  onClick={() => setRefundingPaymentId(null)}
                  className="text-amber-700 hover:text-amber-900 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">Refund Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900"
                    placeholder="Enter amount"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">Reason</label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-900"
                    placeholder="e.g. Customer requested refund"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submittingRefund}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {submittingRefund ? 'Processing Refund...' : `Confirm Refund of ₹${refundAmount || 0}`}
              </button>
            </form>
          )}

          <div className="divide-y divide-slate-100 text-xs">
            {payments.map((p) => {
              const refundable = Number(p.amount) - Number(p.refundedAmount || 0);
              const isRefundable = (p.status === 'SUCCEEDED' || p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED') && refundable > 0.01;

              return (
                <div key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono text-[11px]">{p.transactionReference}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
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
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(p.paidAt).toLocaleString()} • Method: <strong className="text-slate-600">{p.paymentMethod}</strong>
                      {p.notes && <span className="italic"> — "{p.notes}"</span>}
                    </p>
                    {Number(p.refundedAmount || 0) > 0 && (
                      <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                        Refunded: ₹{Number(p.refundedAmount).toLocaleString('en-IN')} (Net: ₹{refundable.toLocaleString('en-IN')})
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="font-black text-emerald-700 text-sm">
                        ₹{Number(p.amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {isRefundable && !refundingPaymentId && (
                      <button
                        type="button"
                        onClick={() => {
                          setRefundingPaymentId(p.id);
                          setRefundAmount(String(refundable));
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 rounded text-[11px] font-bold transition-all cursor-pointer"
                      >
                        Refund
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
