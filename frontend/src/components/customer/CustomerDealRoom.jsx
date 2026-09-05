import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import {
  FileText,
  Calendar,
  Building2,
  Clock,
  Handshake,
  CheckCircle2,
  ArrowLeft,
  MessageSquare,
  Send,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Truck,
  ShieldCheck,
  Percent,
  Check,
  X,
  ExternalLink,
  Receipt,
  Download,
} from 'lucide-react';

export default function CustomerDealRoom({ quoteId, onBack, initialNegotiate = false, initialConfirm = false }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals & Panels
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  // Counter offer state
  const [showCounterModal, setShowCounterModal] = useState(initialNegotiate);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [proposedDiscount, setProposedDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [submittingCounter, setSubmittingCounter] = useState(false);

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [commentTargetItemId, setCommentTargetItemId] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Change request state
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeItem, setChangeItem] = useState(null);
  const [changeType, setChangeType] = useState('QUANTITY_CHANGE');
  const [requestedValue, setRequestedValue] = useState('');
  const [changeComment, setChangeComment] = useState('');
  const [submittingChange, setSubmittingChange] = useState(false);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(initialConfirm);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submittingConfirm, setSubmittingConfirm] = useState(false);
  const [confirmationSuccess, setConfirmationSuccess] = useState(false);

  const [toastMessage, setToastMessage] = useState(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDownloadInvoicePdf = async (inv) => {
    try {
      setDownloadingInvoiceId(inv.id);
      const token = localStorage.getItem('token') || localStorage.getItem('df360_token');
      const res = await fetch(`/api/invoices/${inv.id}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${res.status}: Failed to generate invoice PDF`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${inv.invoiceNumber || inv.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Invoice ${inv.invoiceNumber} PDF downloaded successfully!`, 'success');
    } catch (err) {
      showToast('Error downloading invoice PDF: ' + err.message, 'error');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  useEffect(() => {
    loadQuoteDetails();
  }, [quoteId]);

  const loadQuoteDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithAuth(`/api/customer/quotes/${quoteId}`);
      if (res.success && res.data) {
        setQuote(res.data);
        if (res.data.items?.length > 0 && !selectedItemId) {
          setSelectedItemId(res.data.items[0].id);
          setProposedDiscount(Math.min(30, (parseFloat(res.data.items[0].discountPercentage) || 0) + 5));
        }
      } else {
        setError(res.error?.message || 'Failed to load deal room dossier.');
      }
    } catch (err) {
      setError(err.message || 'Error loading quotation details.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Delivery Request
  const handleDeliverySubmit = async (e) => {
    e.preventDefault();
    if (!deliveryDate) return;
    try {
      setSubmittingDelivery(true);
      const res = await fetchWithAuth(`/api/customer/quotes/${quoteId}/delivery-request`, {
        method: 'POST',
        body: JSON.stringify({ requestedDate: deliveryDate, note: deliveryNote }),
      });
      if (res.success) {
        showToast('Delivery schedule requested successfully.');
        setShowDeliveryModal(false);
        setDeliveryNote('');
        loadQuoteDetails();
      } else {
        showToast(res.error?.message || 'Failed to request delivery date.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingDelivery(false);
    }
  };

  // Submit Counter-Offer
  const handleCounterSubmit = async (e) => {
    e.preventDefault();
    if (proposedDiscount === '') return;
    try {
      setSubmittingCounter(true);
      const res = await fetchWithAuth(`/api/customer/quotes/${quoteId}/counter-offer`, {
        method: 'POST',
        body: JSON.stringify({
          quotationItemId: selectedItemId,
          proposedDiscount: parseFloat(proposedDiscount),
          reason: discountReason,
          version: quote.version,
          expectedVersion: quote.version,
        }),
      });
      if (res.success) {
        showToast('Counter-offer proposal submitted for seller review.');
        setShowCounterModal(false);
        setDiscountReason('');
        loadQuoteDetails();
      } else {
        showToast(res.error?.message || 'Failed to submit counter-offer.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingCounter(false);
    }
  };

  // Submit Line Comment
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      setSubmittingComment(true);
      const res = await fetchWithAuth(`/api/customer/quotes/${quoteId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          quotationItemId: commentTargetItemId || null,
          message: newComment.trim(),
        }),
      });
      if (res.success) {
        setNewComment('');
        setCommentTargetItemId('');
        showToast('Comment submitted.');
        loadQuoteDetails();
      } else {
        showToast(res.error?.message || 'Failed to post comment.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Submit Line Change Request
  const handleChangeSubmit = async (e) => {
    e.preventDefault();
    if (!requestedValue) return;
    try {
      setSubmittingChange(true);
      const res = await fetchWithAuth(`/api/customer/quotes/${quoteId}/change-requests`, {
        method: 'POST',
        body: JSON.stringify({
          quotationItemId: changeItem?.id,
          requestType: changeType,
          currentValue: changeItem?.quantity,
          requestedValue,
          comment: changeComment,
        }),
      });
      if (res.success) {
        showToast('Change request submitted to representative.');
        setShowChangeModal(false);
        setChangeComment('');
        setRequestedValue('');
        loadQuoteDetails();
      } else {
        showToast(res.error?.message || 'Failed to submit change request.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingChange(false);
    }
  };

  // Submit Final Confirmation
  const handleConfirmSubmit = async () => {
    if (!termsAccepted) {
      showToast('Please check the confirmation box to proceed.', 'error');
      return;
    }
    try {
      setSubmittingConfirm(true);
      const res = await fetchWithAuth(`/api/customer/quotes/${quoteId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ termsAccepted: true, version: quote.version, expectedVersion: quote.version }),
      });
      if (res.success) {
        setConfirmationSuccess(true);
        loadQuoteDetails();
      } else {
        showToast(res.error?.message || 'Confirmation failed.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold text-slate-500">Connecting to secure deal room...</p>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
        <AlertCircle size={32} className="mx-auto text-red-600" />
        <h3 className="text-sm font-bold text-red-900">Quotation Unavailable</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto">{error || 'Quotation not found.'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-white border border-red-200 text-red-800 text-xs font-bold rounded-lg cursor-pointer hover:bg-red-100"
        >
          Back to My Quotes
        </button>
      </div>
    );
  }

  const currency = quote.currency === 'USD' ? '$' : '₹';
  const isConfirmable =
    (quote.status === 'SENT_TO_CUSTOMER' || quote.status === 'APPROVED') &&
    !quote.isExpired &&
    quote.status !== 'CUSTOMER_CONFIRMED';

  const isUnderNegotiation = quote.status === 'NEGOTIATION' || quote.status === 'PENDING_APPROVAL';

  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
  if (quote.displayStatus === 'CONFIRMED') badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (quote.displayStatus === 'AWAITING YOUR RESPONSE') badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
  if (isUnderNegotiation) badgeClass = 'bg-purple-100 text-purple-800 border-purple-300';
  if (quote.isExpired) badgeClass = 'bg-red-100 text-red-800 border-red-300';

  return (
    <div className="space-y-6">
      {/* ── Toast Alert ─────────────────────────────────────────── */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-bounce ${
            toastMessage.type === 'error'
              ? 'bg-red-600 text-white border-red-700'
              : 'bg-emerald-800 text-white border-emerald-900'
          }`}
        >
          {toastMessage.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ── Top Nav Back Bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-green-800 transition-colors cursor-pointer"
        >
          <ArrowLeft size={15} />
          <span>Back to My Quotes</span>
        </button>

        <div className="flex items-center gap-2">
          {quote.displayStatus === 'CONFIRMED' ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              <CheckCircle2 size={15} className="text-emerald-700" />
              <span>Contract Confirmed & Finalized</span>
            </span>
          ) : isConfirmable ? (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>Confirm & Accept Quotation</span>
            </button>
          ) : isUnderNegotiation ? (
            <span className="text-xs font-bold text-purple-800 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Clock size={14} />
              <span>Proposal Under Seller Review</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Deal Room Header Dossier ─────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded border border-slate-200">
                {quote.quoteNumber}
              </span>
              <span className={`text-xs font-bold px-3 py-0.5 rounded-full border ${badgeClass}`}>
                {quote.displayStatus}
              </span>
              {quote.isExpired && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-800 rounded">
                  EXPIRED
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Quotation Review & Negotiation Room
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" />
                <span className="font-semibold text-slate-700">Seller:</span>
                <span>{quote.seller?.organizationName}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" />
                <span className="font-semibold text-slate-700">Issued:</span>
                <span>{new Date(quote.createdAt).toLocaleDateString()}</span>
              </div>
              {quote.validUntil && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-slate-400" />
                    <span className="font-semibold text-slate-700">Valid Until:</span>
                    <span className={quote.isExpired ? 'text-red-600 font-bold' : ''}>
                      {new Date(quote.validUntil).toLocaleDateString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Representative Support Pill */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl min-w-[240px]">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Your Sales Representative
            </p>
            <p className="text-sm font-bold text-slate-900">{quote.seller?.salesRepName}</p>
            <p className="text-xs text-slate-500">{quote.seller?.salesRepEmail || 'sales@techworld.com'}</p>
          </div>
        </div>
      </div>

      {/* ── Revised Quotation Banner (Before / After Showcase) ────── */}
      {quote.previousTerms && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
              </span>
              <h3 className="text-sm font-black text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                <span>Revised Quotation (Version #{quote.version})</span>
              </h3>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
              Updated Terms Approved by Seller
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-emerald-200">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Previous Total</p>
              <p className="text-sm font-bold text-slate-500 line-through mt-0.5">
                {currency}{quote.previousTerms.totalAmount?.toLocaleString()}
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-emerald-300 ring-2 ring-emerald-400/20">
              <p className="text-[11px] font-bold text-emerald-700 uppercase">Revised Total</p>
              <p className="text-base font-black text-emerald-800 mt-0.5">
                {currency}{quote.financials?.totalAmount?.toLocaleString()}
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-emerald-200">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Previous Savings</p>
              <p className="text-sm font-semibold text-slate-600 mt-0.5">
                {currency}{quote.previousTerms.discountAmount?.toLocaleString()}
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-emerald-200">
              <p className="text-[11px] font-bold text-emerald-700 uppercase">Total New Savings</p>
              <p className="text-sm font-black text-emerald-800 mt-0.5">
                {currency}{quote.financials?.discountAmount?.toLocaleString()}
              </p>
            </div>
          </div>

          {quote.revisionNotes && (
            <div className="mt-3 p-3 bg-white/90 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2">
              <Sparkles size={16} className="text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-emerald-900">Seller Note: </span>
                <span>{quote.revisionNotes}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Order Summary Table (Strict Data Masking) ────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Configured Products & Pricing
            </h2>
            <p className="text-xs text-slate-400">Official catalog pricing and discounts offered by seller</p>
          </div>

          {!quote.isExpired && quote.status !== 'CUSTOMER_CONFIRMED' && (
            <button
              onClick={() => setShowCounterModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              <Percent size={14} />
              <span>Propose Counter-Offer</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Product & SKU</th>
                <th className="px-5 py-3.5 text-center">Type</th>
                <th className="px-5 py-3.5 text-center">Qty</th>
                <th className="px-5 py-3.5 text-right">Unit List Price</th>
                <th className="px-5 py-3.5 text-right">Offered Discount</th>
                <th className="px-5 py-3.5 text-right">Line Total</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quote.items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-900 text-xs">{it.productName}</p>
                    <span className="text-[11px] text-slate-400">Item ID: {it.id.slice(0, 8)}</span>
                  </td>

                  <td className="px-5 py-4 text-center">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {it.productType}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-center font-bold text-slate-800">{it.quantity}</td>

                  <td className="px-5 py-4 text-right font-medium text-slate-700">
                    {currency}{it.unitPrice?.toLocaleString()}
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className="text-emerald-700 font-bold">{it.discountPercentage}%</span>
                    {it.discountAmount > 0 && (
                      <span className="block text-[10px] text-slate-400">
                        -{currency}{it.discountAmount?.toLocaleString()}
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-right font-black text-slate-900 text-sm">
                    {currency}{it.lineTotal?.toLocaleString()}
                  </td>

                  <td className="px-5 py-4 text-center">
                    {!quote.isExpired && quote.status !== 'CUSTOMER_CONFIRMED' && (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setChangeItem(it);
                            setRequestedValue(String(it.quantity));
                            setShowChangeModal(true);
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded cursor-pointer"
                          title="Request unit or specification change"
                        >
                          Change Qty
                        </button>
                        <button
                          onClick={() => {
                            setCommentTargetItemId(it.id);
                            const el = document.getElementById('deal-room-comments');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="p-1 text-slate-400 hover:text-green-700 hover:bg-green-50 rounded cursor-pointer"
                          title="Ask question on this line item"
                        >
                          <MessageSquare size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Authoritative Financial Totals ──────────────────────── */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-emerald-700" />
              <span>Authoritative DealFlow360 Pricing Engine Guarantee</span>
            </p>
            <p className="text-[11px]">All taxes and statutory GST/VAT calculated authoritatively.</p>
          </div>

          <div className="w-full md:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold">{currency}{quote.financials?.subtotal?.toLocaleString()}</span>
            </div>

            {quote.financials?.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Total Savings:</span>
                <span>-{currency}{quote.financials?.discountAmount?.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Tax & Statutory:</span>
              <span className="font-semibold">{currency}{quote.financials?.taxAmount?.toLocaleString()}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between text-slate-900 font-black text-base">
              <span>Grand Total:</span>
              <span className="text-green-700">{currency}{quote.financials?.totalAmount?.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Invoices & Settlement Section ──────────────── */}
      {quote.invoices && quote.invoices.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                <Receipt size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Invoices & Settlement Ledger
                </h3>
                <p className="text-[11px] text-slate-400">Official tax invoices and payment settlement records</p>
              </div>
            </div>
            <span className="text-xs font-extrabold text-slate-700">
              {quote.invoices.length} {quote.invoices.length === 1 ? 'Invoice' : 'Invoices'} Issued
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quote.invoices.map((inv) => (
              <div key={inv.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900">{inv.invoiceNumber}</span>
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoicePdf(inv)}
                      disabled={downloadingInvoiceId === inv.id}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 px-2 py-0.5 rounded cursor-pointer transition disabled:opacity-50"
                      title="Download Official Tax Invoice PDF"
                    >
                      <Download size={11} />
                      <span>{downloadingInvoiceId === inv.id ? 'Generating...' : 'PDF'}</span>
                    </button>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      inv.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : inv.status === 'PARTIALLY_PAID'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400 block">Total</span>
                    <span className="font-bold text-slate-800">{currency}{inv.totalAmount?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Paid</span>
                    <span className="font-bold text-emerald-700">{currency}{inv.amountPaid?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Due</span>
                    <span className={`font-bold ${inv.amountDue > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                      {currency}{inv.amountDue?.toLocaleString()}
                    </span>
                  </div>
                </div>

                {inv.payments && inv.payments.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 text-[10px] space-y-1">
                    <span className="font-bold text-slate-500 uppercase tracking-wider block">Payments Recorded:</span>
                    {inv.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-slate-600">
                        <span className="font-mono text-slate-800">{p.transactionReference}</span>
                        <span className="font-bold text-emerald-700">+{currency}{p.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Two-Column Bottom Workspace: Delivery Schedule & Negotiation ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Delivery Schedule & Timeline */}
        <div className="space-y-6">
          {/* Delivery Schedule Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <Truck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    Delivery Schedule
                  </h3>
                  <p className="text-[11px] text-slate-400">Requested fulfillment timeline</p>
                </div>
              </div>

              {!quote.isExpired && quote.status !== 'CUSTOMER_CONFIRMED' && (
                <button
                  onClick={() => setShowDeliveryModal(true)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Request Date
                </button>
              )}
            </div>

            {quote.deliveryRequests?.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No delivery date requested yet. Click &quot;Request Date&quot; to propose your preferred schedule.
              </p>
            ) : (
              <div className="space-y-2">
                {quote.deliveryRequests.map((dr) => (
                  <div key={dr.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar size={13} className="text-emerald-700" />
                        <span>Target: {new Date(dr.requestedDate).toLocaleDateString()}</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        {dr.status}
                      </span>
                    </div>
                    {dr.note && <p className="text-slate-600 text-[11px]">Note: &quot;{dr.note}&quot;</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Milestone Timeline */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
              Negotiation & Milestone Timeline
            </h3>

            <div className="space-y-4">
              {quote.timeline.map((event, idx) => (
                <div key={idx} className="flex gap-3 text-xs">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full mt-1 ${
                        event.status === 'COMPLETED'
                          ? 'bg-emerald-600'
                          : event.status === 'EXPIRED'
                          ? 'bg-red-600'
                          : 'bg-purple-600 animate-pulse'
                      }`}
                    />
                    {idx < quote.timeline.length - 1 && <div className="w-0.5 h-full bg-slate-200 mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{event.title}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Line Comments & Negotiation Stream */}
        <div className="space-y-6" id="deal-room-comments">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col h-[520px]">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-green-700" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Negotiation & Comments Stream
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {quote.comments?.length || 0} message{quote.comments?.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Comments Feed */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {quote.comments?.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-6 text-slate-400 text-xs">
                  <div>
                    <MessageSquare size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No comments yet</p>
                    <p className="text-[11px] mt-1">
                      Post a question or negotiation request to communicate with your representative.
                    </p>
                  </div>
                </div>
              ) : (
                quote.comments.map((c) => {
                  const isCustomer = c.authorRole === 'CUSTOMER';
                  return (
                    <div
                      key={c.id}
                      className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs ${
                          isCustomer
                            ? 'bg-green-700 text-white rounded-br-xs'
                            : 'bg-slate-100 text-slate-800 rounded-bl-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold ${isCustomer ? 'text-green-100' : 'text-slate-900'}`}>
                            {c.authorName || (isCustomer ? 'You' : 'Sales Representative')}
                          </span>
                          <span className={`text-[10px] ${isCustomer ? 'text-green-200' : 'text-slate-400'}`}>
                            {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap">{c.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Input */}
            {!quote.isExpired && quote.status !== 'CUSTOMER_CONFIRMED' && (
              <form onSubmit={handleCommentSubmit} className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Ask a question or request terms clarification..."
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-green-700 focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Send</span>
                  <Send size={13} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── Delivery Request Modal ───────────────────────────────── */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Request Delivery Date
              </h3>
              <button onClick={() => setShowDeliveryModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDeliverySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Delivery Date *
                </label>
                <input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-green-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Special Instructions / Facility Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="e.g. Delivery dock hours: 9 AM to 1 PM. Loading ramp required."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-green-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeliveryModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDelivery || !deliveryDate}
                  className="px-4 py-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  {submittingDelivery ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Counter-Offer Negotiation Modal ─────────────────────── */}
      {showCounterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Percent size={18} className="text-purple-700" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Propose Counter-Offer Discount
                </h3>
              </div>
              <button onClick={() => setShowCounterModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCounterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Product Item
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-green-700 bg-white"
                >
                  {quote.items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.productName} (Current Discount: {it.discountPercentage}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Proposed Discount (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="90"
                    step="0.5"
                    required
                    value={proposedDiscount}
                    onChange={(e) => setProposedDiscount(e.target.value)}
                    placeholder="e.g. 20"
                    className="w-full pl-3 pr-8 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-purple-700 font-bold text-purple-900"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Submitting a counter-offer recalculates terms and routes the request to managerial review.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Commercial Justification (Reason)
                </label>
                <textarea
                  rows={3}
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="e.g. Based on our procurement volume commitment across all units, we require a 20% discount."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-purple-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCounterModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCounter || proposedDiscount === ''}
                  className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  {submittingCounter ? 'Submitting Counter-Offer...' : 'Submit Counter-Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Line Change Request Modal ────────────────────────────── */}
      {showChangeModal && changeItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Request Line Item Change
              </h3>
              <button onClick={() => setShowChangeModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangeSubmit} className="space-y-3">
              <div>
                <p className="text-xs font-bold text-slate-800">{changeItem.productName}</p>
                <p className="text-[11px] text-slate-400">Current Quantity: {changeItem.quantity}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Change Type
                </label>
                <select
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-green-700 bg-white"
                >
                  <option value="QUANTITY_CHANGE">Change Quantity</option>
                  <option value="REMOVE_ITEM">Remove Item</option>
                  <option value="PRODUCT_CHANGE">Substitute Product</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Requested Value *
                </label>
                <input
                  type="text"
                  required
                  value={requestedValue}
                  onChange={(e) => setRequestedValue(e.target.value)}
                  placeholder="e.g. 15 (for quantity) or 0 (to remove)"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-green-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Note to Representative
                </label>
                <textarea
                  rows={2}
                  value={changeComment}
                  onChange={(e) => setChangeComment(e.target.value)}
                  placeholder="Reason for change..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-green-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowChangeModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingChange || !requestedValue}
                  className="px-4 py-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  {submittingChange ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Order Confirmation Modal ─────────────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            {confirmationSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-xl font-black text-slate-900">Quotation Confirmed!</h2>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Thank you! Quote #{quote.quoteNumber} has been officially confirmed and digitally signed. Your order has been routed to operations and warehouse fulfillment.
                </p>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setConfirmationSuccess(false);
                    onBack();
                  }}
                  className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-700" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Confirm & Accept Quotation
                    </h3>
                  </div>
                  <button onClick={() => setShowConfirmModal(false)} className="text-slate-400 hover:text-slate-700">
                    <X size={18} />
                  </button>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Quotation:</span>
                    <span>{quote.quoteNumber}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Products Ordered:</span>
                    <span>{quote.items.length} line items</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Final Amount:</span>
                    <span className="font-bold text-slate-900">{currency}{quote.financials?.totalAmount?.toLocaleString()}</span>
                  </div>
                  {quote.deliveryRequests?.length > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Requested Delivery:</span>
                      <span>{new Date(quote.deliveryRequests[0].requestedDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Mandatory Terms Acceptance Checkbox */}
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="accept-terms"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="accept-terms" className="text-xs text-slate-700 leading-relaxed cursor-pointer select-none">
                    <span className="font-bold text-slate-900">I confirm and accept</span> the quotation, pricing, line items, and terms shown above on behalf of {quote.customer?.companyName || 'our company'}.
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submittingConfirm || !termsAccepted}
                    onClick={handleConfirmSubmit}
                    className="px-5 py-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {submittingConfirm ? 'Confirming Deal...' : 'Confirm Order'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
