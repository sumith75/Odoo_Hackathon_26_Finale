import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Building2,
  User,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Percent,
  Calculator,
  History,
  Clock,
  RefreshCw,
  Send,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export default function ApprovalDetails({ quoteId, onBack, onActionCompleted }) {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'APPROVE' | 'REJECT' | 'RETURN'
  const [modalReason, setModalReason] = useState('');
  const [modalComment, setModalComment] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadQuoteDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(`/api/manager/approvals/${quoteId}`);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error?.message || 'Failed to load quotation dossier.');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (quoteId) loadQuoteDetails();
  }, [quoteId]);

  // Execute Approve, Reject, or Return for Revision
  const handleExecuteAction = async () => {
    setActionError('');
    if ((activeModal === 'REJECT' || activeModal === 'RETURN') && !modalReason.trim()) {
      setActionError('A clear justification reason is mandatory.');
      return;
    }

    setSubmittingAction(true);
    try {
      let endpoint = `/api/manager/approvals/${quoteId}/`;
      let body = {};

      if (activeModal === 'APPROVE') {
        endpoint += 'approve';
        body = { comment: modalComment };
      } else if (activeModal === 'REJECT') {
        endpoint += 'reject';
        body = { reason: modalReason };
      } else if (activeModal === 'RETURN') {
        endpoint += 'return-for-revision';
        body = { reason: modalReason };
      }

      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.success) {
        setActiveModal(null);
        setModalReason('');
        setModalComment('');
        await loadQuoteDetails();
        if (onActionCompleted) onActionCompleted(res.data);
      } else {
        setActionError(res.error?.message || res.message || 'Failed to process approval action.');
      }
    } catch (err) {
      setActionError(err.message || 'Error communicating with server.');
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-green-700 animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-500">Loading Authoritative Decision Dossier...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-xs text-red-700 max-w-lg mx-auto">
        <AlertTriangle size={24} className="mx-auto mb-2 text-red-600" />
        <p className="font-bold text-sm mb-1">Dossier Unavailable</p>
        <p className="mb-4">{error || 'Quotation details could not be retrieved.'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 cursor-pointer"
        >
          Return to Inbox
        </button>
      </div>
    );
  }

  const { quote, telemetry, auditHistory = [] } = data;
  const isPendingManager =
    quote.status === 'PENDING_APPROVAL' && quote.approvalStatus === 'PENDING_MANAGER';
  const isHighRisk = quote.riskLevel === 'HIGH';
  const marginDelta = telemetry?.marginDelta || {};
  const comparison = telemetry?.comparison || {};
  const approvalChain = telemetry?.approvalChain || [];
  const governanceItems = telemetry?.governanceItems || [];

  return (
    <div className="space-y-6">
      {/* ── Back Navigation & Top Bar ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
            title="Back to Inbox"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-mono font-black text-slate-900">{quote.quoteNumber}</h1>
              {comparison.isReapproval && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                  RE-APPROVAL REQUIRED
                </span>
              )}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  isHighRisk
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {quote.riskLevel} RISK ({quote.riskScore}/100)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Client: <span className="font-bold text-slate-700">{quote.customer?.name}</span> • Rep:{' '}
              <span className="font-bold text-slate-700">{quote.salesRep?.name}</span>
            </p>
          </div>
        </div>

        {/* Current State Indicator */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Quotation Status
            </span>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase ${
                isPendingManager
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : quote.status === 'APPROVED'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : quote.status === 'REJECTED'
                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                  : quote.status === 'RETURNED_FOR_REVISION'
                  ? 'bg-blue-100 text-blue-900 border border-blue-300'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {isPendingManager ? 'Awaiting Manager Decision' : quote.status}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3 Column Decision Layout ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Comprehensive Dossier */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Commercial Snapshot */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Commercial Entity & Account Overview
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Customer Company</span>
                <span className="font-bold text-slate-800 text-sm">
                  {quote.customer?.companyName || quote.customer?.name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Customer Tier</span>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-black bg-amber-50 text-amber-900 border border-amber-300">
                  {quote.customer?.tier} TIER
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Sales Representative</span>
                <span className="font-bold text-slate-800">{quote.salesRep?.name}</span>
                <span className="block text-[11px] text-slate-500">{quote.salesRep?.email}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Submitted At</span>
                <span className="font-mono font-medium text-slate-700">
                  {new Date(quote.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Section 12: Margin Delta Check (Mandatory Manager Review) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator size={15} className="text-green-700" />
                Profitability & Margin Delta Analysis
              </h2>
              <span className="text-[11px] text-slate-400">Baseline (0% Discount) vs Proposed</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-slate-500 block font-medium">Base Margin (0% Disc)</span>
                <span className="text-base font-mono font-bold text-slate-700">
                  {marginDelta.baseMarginPercentage}%
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  {currency === 'INR' ? '₹' : '$'}
                  {Number(marginDelta.baseMarginAmount || 0).toLocaleString()} profit
                </span>
              </div>

              <div>
                <span className="text-slate-500 block font-medium">Current Proposed Margin</span>
                <span className="text-base font-mono font-bold text-slate-900">
                  {quote.marginPercentage}%
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  {currency === 'INR' ? '₹' : '$'}
                  {Number(quote.marginAmount || 0).toLocaleString()} profit
                </span>
              </div>

              <div>
                <span className="text-slate-500 block font-medium">Margin Delta %</span>
                <span
                  className={`text-base font-mono font-black flex items-center gap-1 ${
                    (marginDelta.marginDeltaPercentage || 0) < 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {(marginDelta.marginDeltaPercentage || 0) < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                  {marginDelta.marginDeltaPercentage}%
                </span>
                <span className="text-[10px] text-slate-400 block">Relative variance</span>
              </div>

              <div>
                <span className="text-slate-500 block font-medium">Total Margin Impact</span>
                <span className="text-base font-mono font-black text-red-600">
                  {currency === 'INR' ? '₹' : '$'}
                  {Math.abs(Number(marginDelta.marginImpactAmount || 0)).toLocaleString()}
                </span>
                <span className="text-[10px] text-red-500 block font-semibold">Margin sacrifice</span>
              </div>
            </div>
          </div>

          {/* Section 10: Discount Governance Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Discount Governance & Line Items Analysis
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Itemized discount ceiling verification against Admin-configured rules
                </p>
              </div>
              {telemetry.violations?.length > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-300">
                  {telemetry.violations.length} Limit Exceeded
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-center">Qty</th>
                    <th className="px-4 py-2.5 text-right">Unit Price</th>
                    <th className="px-4 py-2.5 text-center">Applied Disc</th>
                    <th className="px-4 py-2.5 text-center">Allowed Ceiling</th>
                    <th className="px-4 py-2.5 text-center">Variance</th>
                    <th className="px-4 py-2.5 text-center">Governance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {governanceItems.map((item) => {
                    const isExceeded = item.isExceeded;
                    return (
                      <tr
                        key={item.id}
                        className={isExceeded ? 'bg-red-50/50' : 'hover:bg-slate-50'}
                      >
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 block">{item.productName}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Cost: {currency === 'INR' ? '₹' : '$'}
                            {Number(item.costPrice).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700">
                            {item.productType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                          {currency === 'INR' ? '₹' : '$'}
                          {Number(item.unitPrice).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-black text-slate-900">
                          {item.appliedDiscount}%
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-slate-600">
                          {item.allowedDiscount}%
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold">
                          <span className={isExceeded ? 'text-red-700' : 'text-emerald-700'}>
                            {item.variance > 0 ? `+${item.variance}%` : `${item.variance}%`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isExceeded ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-300">
                              <AlertTriangle size={11} /> EXCEEDED (+{item.excessPercentage}%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 size={11} /> Within Limit
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 13: Before / After Comparison */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Percent size={15} className="text-green-700" />
              Commercial Comparison: Baseline Terms vs Proposed Deal
            </h2>

            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <div className="grid grid-cols-4 bg-slate-50 p-2.5 font-bold text-slate-500 uppercase text-[10px] border-b border-slate-200">
                <span>Metric</span>
                <span className="text-right">Original / Baseline</span>
                <span className="text-right">Proposed Terms</span>
                <span className="text-right">Delta</span>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-4 p-2.5 font-sans">
                  <span className="text-slate-600 font-medium">Total Contract Value</span>
                  <span className="text-right font-mono text-slate-500">
                    {currency === 'INR' ? '₹' : '$'}
                    {Number(comparison.baselineTotal || 0).toLocaleString()}
                  </span>
                  <span className="text-right font-mono font-bold text-slate-900">
                    {currency === 'INR' ? '₹' : '$'}
                    {Number(comparison.proposedTotal || 0).toLocaleString()}
                  </span>
                  <span className="text-right font-mono font-bold text-red-600">
                    -{currency === 'INR' ? '₹' : '$'}
                    {Math.abs(Number(quote.discountAmount || 0)).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-4 p-2.5 font-sans">
                  <span className="text-slate-600 font-medium">Gross Margin %</span>
                  <span className="text-right font-mono text-slate-500">
                    {comparison.baseMarginPercentage}%
                  </span>
                  <span className="text-right font-mono font-bold text-slate-900">
                    {comparison.proposedMarginPercentage}%
                  </span>
                  <span
                    className={`text-right font-mono font-bold ${
                      (comparison.marginDeltaPercentage || 0) < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {comparison.marginDeltaPercentage}%
                  </span>
                </div>

                <div className="grid grid-cols-4 p-2.5 font-sans">
                  <span className="text-slate-600 font-medium">Gross Profit Amount</span>
                  <span className="text-right font-mono text-slate-500">
                    {currency === 'INR' ? '₹' : '$'}
                    {Number(comparison.baseMarginAmount || 0).toLocaleString()}
                  </span>
                  <span className="text-right font-mono font-bold text-slate-900">
                    {currency === 'INR' ? '₹' : '$'}
                    {Number(comparison.proposedMarginAmount || 0).toLocaleString()}
                  </span>
                  <span className="text-right font-mono font-bold text-red-600">
                    {comparison.marginImpactAmount ? `${comparison.marginImpactAmount}` : '0'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 42: Audit Timeline */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <History size={15} className="text-green-700" />
              Full Audit Trail & Quote Activity Timeline
            </h2>

            {auditHistory.length === 0 ? (
              <p className="text-xs text-slate-400">No previous audit records logged for this quotation.</p>
            ) : (
              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {auditHistory.map((log) => (
                  <div key={log.id} className="relative text-xs">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-green-600 ring-4 ring-white" />
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      <span>{log.action.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] font-normal text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Actor: <span className="font-semibold">{log.user?.name || 'System User'}</span>{' '}
                      {log.user?.role && `[${log.user.role}]`}
                    </p>
                    {log.metadata?.reason && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded mt-1 border border-amber-200">
                        Reason: "{log.metadata.reason}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Decision Panel & Visual Risk Meter */}
        <div className="space-y-6">
          {/* Section 33: Sticky Decision Panel */}
          <div className="bg-white border-2 border-slate-300 rounded-xl p-5 shadow-md sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Approval Decision Panel
              </span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {quote.requiredApproverRole?.replace(/_/g, ' ') || 'Sales Manager'}
              </span>
            </div>

            {/* Quick Metrics Summary */}
            <div className="space-y-2 text-xs mb-5">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Contract Total</span>
                <span className="font-mono font-bold text-slate-900">
                  {currency === 'INR' ? '₹' : '$'}
                  {Number(quote.totalAmount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Blended Risk Score</span>
                <span
                  className={`font-mono font-bold ${
                    isHighRisk ? 'text-red-700' : 'text-amber-700'
                  }`}
                >
                  {quote.riskScore} / 100 ({quote.riskLevel})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Gross Margin</span>
                <span className="font-mono font-bold text-slate-800">
                  {quote.marginPercentage}% ({marginDelta.marginDeltaPercentage}%)
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Discount Ceilings</span>
                <span
                  className={`font-bold ${
                    telemetry.violations?.length > 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {telemetry.violations?.length || 0} Exceeded
                </span>
              </div>
            </div>

            {/* Decision Actions */}
            {isPendingManager ? (
              <div className="space-y-2.5">
                {/* Approve Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActionError('');
                    setActiveModal('APPROVE');
                  }}
                  className="w-full py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 size={16} /> Approve Deal
                </button>

                {/* Return for Revision Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActionError('');
                    setActiveModal('RETURN');
                  }}
                  className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw size={15} /> Return for Revision
                </button>

                {/* Reject Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActionError('');
                    setActiveModal('REJECT');
                  }}
                  className="w-full py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <XCircle size={15} /> Reject Quotation
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-600">
                <p className="font-bold mb-1">Decision Concluded</p>
                <p className="text-[11px] text-slate-500">
                  This quotation is currently{' '}
                  <span className="font-bold text-slate-800">{quote.status}</span> and is not awaiting managerial action.
                </p>
              </div>
            )}
          </div>

          {/* Section 11: Blended Risk Score & Telemetry */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle size={15} className="text-amber-600" />
              Corporate Risk Telemetry
            </h3>

            <div className="my-3">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-2xl font-black font-mono text-slate-900">
                  {quote.riskScore}
                  <span className="text-xs text-slate-400 font-normal"> / 100</span>
                </span>
                <span
                  className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                    isHighRisk
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {quote.riskLevel} RISK
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isHighRisk ? 'bg-red-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, quote.riskScore)}%` }}
                />
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 block uppercase">
                Authoritative Reasons:
              </span>
              {Array.isArray(quote.riskReasons) && quote.riskReasons.length > 0 ? (
                quote.riskReasons.map((reason, idx) => (
                  <p key={idx} className="text-xs text-red-700 flex items-start gap-1.5 leading-relaxed">
                    <span className="text-red-500 font-bold">•</span>
                    <span>{reason}</span>
                  </p>
                ))
              ) : (
                <p className="text-xs text-slate-500">Commercial terms are within standard bounds.</p>
              )}
            </div>
          </div>

          {/* Section 14: Visual Approval Chain */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-green-700" />
              Approval Ladder Sequence
            </h3>

            <div className="space-y-3 text-xs">
              {approvalChain.map((step, idx) => {
                const isDone = step.status === 'SUBMITTED' || step.status === 'APPROVED';
                const isPending = step.status === 'PENDING';
                const isNotReq = step.status === 'NOT_REQUIRED';
                const isRejected = step.status === 'REJECTED';

                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border bg-slate-50 border-slate-200">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : isPending
                            ? 'bg-amber-500 text-white'
                            : isRejected
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-300 text-slate-700'
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block leading-tight">{step.label}</span>
                        {step.user && <span className="text-[10px] text-slate-400">{step.user}</span>}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isDone
                          ? 'bg-emerald-100 text-emerald-800'
                          : isPending
                          ? 'bg-amber-100 text-amber-900'
                          : isNotReq
                          ? 'bg-slate-200 text-slate-600'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {step.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Modals ─────────────────────────────────────── */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {activeModal === 'APPROVE' && <CheckCircle2 className="text-green-700" size={18} />}
                {activeModal === 'RETURN' && <RotateCcw className="text-blue-700" size={18} />}
                {activeModal === 'REJECT' && <XCircle className="text-rose-600" size={18} />}
                {activeModal === 'APPROVE' && `Approve Quotation ${quote.quoteNumber}?`}
                {activeModal === 'RETURN' && `Return ${quote.quoteNumber} for Revision`}
                {activeModal === 'REJECT' && `Reject Quotation ${quote.quoteNumber}`}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            {activeModal === 'APPROVE' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600">
                  You are authorizing commercial sign-off for <span className="font-bold">{quote.customer?.name}</span> totaling{' '}
                  <span className="font-bold font-mono">
                    {currency === 'INR' ? '₹' : '$'}
                    {Number(quote.totalAmount).toLocaleString()}
                  </span>.
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Approval Comments (Optional):
                  </label>
                  <textarea
                    rows={3}
                    value={modalComment}
                    onChange={(e) => setModalComment(e.target.value)}
                    placeholder="e.g. Approved due to strategic expansion with Gold customer."
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-green-600"
                  />
                </div>
              </div>
            )}

            {activeModal === 'RETURN' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Send this deal back to Sales Rep <span className="font-bold">{quote.salesRep?.name}</span> for commercial adjustment.
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Revision Reason & Instructions <span className="text-red-500">*</span>:
                  </label>
                  <textarea
                    rows={3}
                    value={modalReason}
                    onChange={(e) => setModalReason(e.target.value)}
                    placeholder="e.g. Reduce Installation Service discount to 10% or provide commercial justification."
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-green-600"
                    required
                  />
                </div>
              </div>
            )}

            {activeModal === 'REJECT' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Declining this quotation will terminate the current commercial negotiation. Sales Rep will be notified.
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Rejection Reason <span className="text-red-500">*</span>:
                  </label>
                  <textarea
                    rows={3}
                    value={modalReason}
                    onChange={(e) => setModalReason(e.target.value)}
                    placeholder="e.g. Service discount of 18% is commercially unacceptable."
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-rose-600"
                    required
                  />
                </div>
              </div>
            )}

            {actionError && (
              <div className="text-xs text-red-700 bg-red-50 p-2.5 rounded border border-red-200">
                {actionError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleExecuteAction}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer disabled:opacity-60 ${
                  activeModal === 'APPROVE'
                    ? 'bg-green-700 hover:bg-green-800'
                    : activeModal === 'RETURN'
                    ? 'bg-blue-700 hover:bg-blue-800'
                    : 'bg-rose-700 hover:bg-rose-800'
                }`}
              >
                {submittingAction ? 'Executing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
