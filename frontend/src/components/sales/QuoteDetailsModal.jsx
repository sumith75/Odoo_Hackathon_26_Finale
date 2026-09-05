import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  X,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit,
  Tag,
  ShieldCheck,
} from 'lucide-react';

export default function QuoteDetailsModal({ quoteId, onClose, onEditDraft }) {
  const { user } = useAuth();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  const currency = user?.currency || 'INR';

  useEffect(() => {
    const loadQuote = async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth(`/api/quotations/${quoteId}`);
        if (res.success) {
          setQuote(res.data);
        }
      } catch (err) {
        console.error('Failed to load quote details', err);
      } finally {
        setLoading(false);
      }
    };

    if (quoteId) {
      loadQuote();
    }
  }, [quoteId]);

  if (!quoteId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-800 text-sm">
                {quote?.quoteNumber}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                  quote?.status === 'PENDING_APPROVAL'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : quote?.status === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {quote?.status?.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on {new Date(quote?.createdAt).toLocaleDateString()} by {quote?.salesRep?.name}
            </p>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-green-700 animate-spin mb-2" />
            <p className="text-xs text-slate-500">Loading deal details...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-4 space-y-5">
            {/* Customer & Risk Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Customer Information
                </span>
                <span className="font-bold text-slate-900 block text-sm">
                  {quote?.customer?.companyName || quote?.customer?.name}
                </span>
                <p className="text-slate-500">{quote?.customer?.email}</p>
                <span className="inline-block mt-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {quote?.customer?.tier} Tier Account
                </span>
              </div>

              <div
                className={`p-3.5 border rounded-xl text-xs space-y-1 ${
                  quote?.riskLevel === 'HIGH'
                    ? 'bg-red-50/50 border-red-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Discount Risk Evaluation
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                      quote?.riskLevel === 'HIGH'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {quote?.riskLevel} ({quote?.riskScore}/100)
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-700 pt-1">
                  Approval Status:{' '}
                  <span className="text-amber-800">{quote?.approvalStatus?.replace(/_/g, ' ')}</span>
                </div>

                {quote?.riskReasons && Array.isArray(quote.riskReasons) && (
                  <div className="space-y-0.5 pt-1">
                    {quote.riskReasons.map((r, idx) => (
                      <p key={idx} className="text-[11px] text-slate-600 flex items-start gap-1">
                        <span>•</span> <span>{r}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Quoted Line Items
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500">
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 font-mono">Unit Price</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 font-mono">Discount</th>
                      <th className="py-2.5 px-3 font-mono">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {quote?.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.productNameSnapshot}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-medium border border-slate-200">
                            {item.productTypeSnapshot}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {currency} {Number(item.unitPrice).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">{item.quantity}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-700 font-semibold">
                          {item.discountPercentage}% (-{currency}{' '}
                          {Number(item.discountAmount).toLocaleString()})
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {currency} {Number(item.lineTotal).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Totals */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Pre-Tax):</span>
                <span className="font-mono font-bold text-slate-800">
                  {currency} {Number(quote?.subtotal).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Discount Concession:</span>
                <span className="font-mono font-bold text-emerald-700">
                  - {currency} {Number(quote?.discountAmount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Gross Deal Margin:</span>
                <span className="font-mono font-bold text-slate-800">
                  {currency} {Number(quote?.marginAmount).toLocaleString()} ({quote?.marginPercentage}%)
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax (GST 18%):</span>
                <span className="font-mono font-bold text-slate-800">
                  {currency} {Number(quote?.taxAmount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="font-mono text-green-700 text-base">
                  {currency} {Number(quote?.totalAmount).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          {quote?.status === 'DRAFT' && onEditDraft && (
            <button
              onClick={() => {
                onClose();
                onEditDraft(quote.id);
              }}
              className="px-3.5 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Edit size={13} /> Edit in CPQ Studio
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
