import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Inbox,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  Clock,
  Building2,
  ShieldCheck,
  RefreshCw,
  Eye,
  Percent,
  Activity,
  Layers,
  FileText,
  DollarSign,
  PackageCheck,
  Users,
  Box,
  Calendar,
  ChevronRight,
  Filter,
  Check,
  Zap,
} from 'lucide-react';

export default function ManagerDashboard({ onNavigateToApprovals, onNavigateToQuote, onNavigateToDeals }) {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';
  const currencySymbol = currency === 'INR' ? '₹' : '$';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState('30days');
  const [activeTab, setActiveTab] = useState('attention'); // 'attention' | 'pipeline' | 'approvals' | 'fulfillment' | 'billing' | 'sales_reps'

  // Additional analytics sub-states
  const [pipelineData, setPipelineData] = useState(null);
  const [approvalAnalytics, setApprovalAnalytics] = useState(null);
  const [negotiationAnalytics, setNegotiationAnalytics] = useState(null);
  const [fulfillmentAnalytics, setFulfillmentAnalytics] = useState(null);
  const [billingAnalytics, setBillingAnalytics] = useState(null);
  const [subscriptionAnalytics, setSubscriptionAnalytics] = useState(null);
  const [salesRepAnalytics, setSalesRepAnalytics] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const [
        dashRes,
        pipeRes,
        apprRes,
        negRes,
        fulRes,
        billRes,
        subRes,
        repRes,
      ] = await Promise.all([
        fetchWithAuth(`/api/manager/dashboard?timeframe=${timeframe}`),
        fetchWithAuth(`/api/manager/pipeline?timeframe=${timeframe}`),
        fetchWithAuth(`/api/manager/analytics/approvals?timeframe=${timeframe}`),
        fetchWithAuth(`/api/manager/analytics/negotiations?timeframe=${timeframe}`),
        fetchWithAuth(`/api/manager/analytics/fulfillment?timeframe=${timeframe}`),
        fetchWithAuth(`/api/manager/analytics/billing?timeframe=${timeframe}`),
        fetchWithAuth(`/api/manager/analytics/subscriptions`),
        fetchWithAuth(`/api/manager/analytics/sales-reps`),
      ]);

      if (dashRes.success) setData(dashRes.data);
      else setError(dashRes.error?.message || 'Failed to load manager dashboard.');

      if (pipeRes.success) setPipelineData(pipeRes.data);
      if (apprRes.success) setApprovalAnalytics(apprRes.data);
      if (negRes.success) setNegotiationAnalytics(negRes.data);
      if (fulRes.success) setFulfillmentAnalytics(fulRes.data);
      if (billRes.success) setBillingAnalytics(billRes.data);
      if (subRes.success) setSubscriptionAnalytics(subRes.data);
      if (repRes.success) setSalesRepAnalytics(repRes.data);

    } catch (err) {
      setError(err.message || 'Failed to connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [timeframe]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-green-700 animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-500">Evaluating Deal Health & Aggregating Analytics...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-xs text-red-700">
        <p className="font-bold mb-2">Error Loading Management Dashboard</p>
        <p className="mb-4">{error}</p>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-red-700 text-white rounded-lg font-bold hover:bg-red-800 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const dealsAttention = data?.dealsRequiringAttention || [];
  const urgentQuotes = data?.urgentPendingQuotes || [];
  const recentApprovals = data?.recentApprovals || [];
  const riskDist = data?.riskDistribution || { low: 0, moderate: 0, elevated: 0, high: 0 };

  const getHealthBadge = (status, score) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600" /> HEALTHY ({score})
          </span>
        );
      case 'GOOD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-800 border border-blue-200">
            <ShieldCheck size={12} className="text-blue-600" /> GOOD ({score})
          </span>
        );
      case 'AT_RISK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle size={12} className="text-amber-600" /> AT RISK ({score})
          </span>
        );
      case 'CRITICAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-50 text-red-800 border border-red-200">
            <XCircle size={12} className="text-red-600" /> CRITICAL ({score})
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header & Controls ───────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase bg-green-100 text-green-800">
              Module 9 Intelligence
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Management Dashboard & Deal Health</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time pipeline progression, actionable deal health signals, and end-to-end commercial governance
          </p>
        </div>

        {/* Time Filters & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200">
            {[
              { id: 'today', label: 'Today' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'this_quarter', label: 'This Quarter' },
              { id: 'this_year', label: 'This Year' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeframe(t.id)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  timeframe === t.id
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadDashboard}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 transition-colors cursor-pointer"
            title="Refresh Real-time Analytics"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={onNavigateToApprovals}
            className="px-3.5 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Inbox size={14} /> Approval Inbox
          </button>
        </div>
      </div>

      {/* ── Top Executive KPI Metrics Bar ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Pipeline Value */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pipeline</span>
            <TrendingUp size={14} className="text-green-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            {currencySymbol}
            {kpis.totalPipelineValue ? Number(kpis.totalPipelineValue).toLocaleString() : '0'}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{kpis.activeDealsCount ?? 0} active deals</p>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Approvals</span>
            <Inbox size={14} />
          </div>
          <div className="text-lg font-black text-amber-900">{kpis.pendingApprovals ?? 0}</div>
          <p className="text-[10px] text-amber-700 mt-0.5">Pending action</p>
        </div>

        {/* High Risk Deals */}
        <div className="bg-white p-3.5 rounded-xl border border-red-200 shadow-xs">
          <div className="flex items-center justify-between text-red-600 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">At Risk</span>
            <AlertTriangle size={14} />
          </div>
          <div className="text-lg font-black text-red-700">{kpis.highRiskDeals ?? 0}</div>
          <p className="text-[10px] text-red-600 mt-0.5">Commercial risk</p>
        </div>

        {/* Awaiting Customer */}
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Awaiting</span>
            <Users size={14} />
          </div>
          <div className="text-lg font-black text-blue-900">{kpis.quotesAwaitingCustomer ?? 0}</div>
          <p className="text-[10px] text-blue-700 mt-0.5">Sent / Negotiating</p>
        </div>

        {/* Fulfillment Delays */}
        <div className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Ops Delays</span>
            <PackageCheck size={14} />
          </div>
          <div className="text-lg font-black text-purple-900">{kpis.fulfillmentDelays ?? 0}</div>
          <p className="text-[10px] text-purple-700 mt-0.5">Pending dispatch</p>
        </div>

        {/* Outstanding Payments */}
        <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Outstanding</span>
            <DollarSign size={14} />
          </div>
          <div className="text-lg font-black text-rose-900">
            {currencySymbol}
            {kpis.outstandingPayments ? Number(kpis.outstandingPayments).toLocaleString() : '0'}
          </div>
          <p className="text-[10px] text-rose-700 mt-0.5">Invoice balance</p>
        </div>

        {/* MRR (Monthly Recurring Revenue) */}
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">MRR</span>
            <Zap size={14} />
          </div>
          <div className="text-lg font-black text-emerald-900">
            {currencySymbol}
            {kpis.monthlyRecurringRevenue ? Number(kpis.monthlyRecurringRevenue).toLocaleString() : '0'}
          </div>
          <p className="text-[10px] text-emerald-700 mt-0.5">Active subscriptions</p>
        </div>

        {/* Decisions Today */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Today</span>
            <CheckCircle2 size={14} className="text-emerald-600" />
          </div>
          <div className="text-lg font-black text-slate-900">{kpis.approvedToday ?? 0}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Approved today</p>
        </div>
      </div>

      {/* ── Navigation Tab Bar ─────────────────────────────────────────── */}
      <div className="border-b border-slate-200 flex space-x-6 overflow-x-auto text-xs font-bold text-slate-500">
        {[
          { id: 'attention', label: 'Deals Requiring Attention', icon: AlertTriangle, count: dealsAttention.length },
          { id: 'pipeline', label: 'Pipeline & Negotiation Funnel', icon: Layers },
          { id: 'approvals', label: 'Approval Governance SLA', icon: ShieldCheck, count: kpis.pendingApprovals },
          { id: 'fulfillment', label: 'Fulfillment & Ops', icon: Box, count: kpis.fulfillmentDelays },
          { id: 'billing', label: 'Billing & Subscriptions', icon: DollarSign },
          { id: 'sales_reps', label: 'Team & Rep Analytics', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-green-700 text-green-800 font-extrabold'
                  : 'border-transparent hover:text-slate-800'
              }`}
            >
              <Icon size={14} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-black">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab 1: Deals Requiring Attention (Actionable Signals Queue) ───── */}
      {activeTab === 'attention' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Activity size={16} className="text-red-600" /> Actionable Deals Queue
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Surfacing real database lifecycle signals requiring sales management intervention
                </p>
              </div>
              <button
                onClick={onNavigateToApprovals}
                className="text-xs font-bold text-green-700 hover:text-green-800 flex items-center gap-1 cursor-pointer"
              >
                View Approval Inbox ({kpis.pendingApprovals || 0}) <ArrowRight size={13} />
              </button>
            </div>

            {dealsAttention.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <ShieldCheck size={36} className="mx-auto mb-2 text-green-600" />
                <p className="font-bold text-slate-700">No Critical or At-Risk Deals</p>
                <p className="mt-0.5">All active deals are progressing within healthy lifecycle parameters.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {dealsAttention.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-4 sm:px-6 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-black text-slate-900 text-sm">{deal.quoteNumber}</span>
                        <span className="font-semibold text-slate-800 text-xs">— {deal.customerName}</span>
                        {getHealthBadge(deal.healthStatus, deal.healthScore)}
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                          {deal.status}
                        </span>
                      </div>

                      {deal.primarySignal && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-red-700 flex items-center gap-1">
                            <AlertTriangle size={12} /> {deal.primarySignal.type}:
                          </span>
                          <span className="text-slate-600 font-medium">{deal.primarySignal.message}</span>
                        </div>
                      )}

                      <div className="text-[11px] text-green-800 font-semibold bg-green-50/60 border border-green-100 px-2.5 py-1 rounded-md inline-block">
                        💡 <span className="font-bold">Next Recommended Action:</span> {deal.recommendedAction}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-end">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Value</div>
                        <div className="font-mono font-black text-slate-900 text-sm">
                          {currencySymbol}
                          {deal.totalAmount ? Number(deal.totalAmount).toLocaleString() : '0'}
                        </div>
                      </div>

                      <button
                        onClick={() => onNavigateToQuote(deal.id)}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-green-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        Open Deal <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Pipeline & Negotiation Funnel ─────────────────────────── */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          {/* Canonical Pipeline Stages Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6">
            <h2 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
              <Layers size={16} className="text-green-700" /> Canonical Quotation Lifecycle Pipeline
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {(pipelineData?.stages || []).map((stage) => (
                <div key={stage.stage} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-black uppercase text-slate-500 truncate mb-1">
                    {stage.stage}
                  </div>
                  <div className="text-lg font-black text-slate-900">{stage.dealCount} deals</div>
                  <div className="text-xs font-bold text-green-700 mt-1">
                    {currencySymbol}
                    {Number(stage.totalValue).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Negotiation Funnel Visualizer */}
          {negotiationAnalytics && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6">
              <h2 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                <RotateCcw size={16} className="text-blue-600" /> Negotiation Funnel Analytics
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                  <div className="text-[10px] font-bold text-blue-700 uppercase">Received</div>
                  <div className="text-xl font-black text-blue-900">{negotiationAnalytics.funnel?.customerReceived || 0}</div>
                </div>
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                  <div className="text-[10px] font-bold text-blue-700 uppercase">Negotiating</div>
                  <div className="text-xl font-black text-blue-900">{negotiationAnalytics.funnel?.negotiationStarted || 0}</div>
                </div>
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                  <div className="text-[10px] font-bold text-amber-700 uppercase">Counteroffers</div>
                  <div className="text-xl font-black text-amber-900">{negotiationAnalytics.counteroffers || 0}</div>
                </div>
                <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                  <div className="text-[10px] font-bold text-purple-700 uppercase">Re-Approvals</div>
                  <div className="text-xl font-black text-purple-900">{negotiationAnalytics.funnel?.reApprovalTriggered || 0}</div>
                </div>
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase">Approved</div>
                  <div className="text-xl font-black text-emerald-900">{negotiationAnalytics.approved || 0}</div>
                </div>
                <div className="p-3 bg-green-50/80 rounded-xl border border-green-200">
                  <div className="text-[10px] font-bold text-green-800 uppercase">Confirmed</div>
                  <div className="text-xl font-black text-green-950">{negotiationAnalytics.funnel?.customerConfirmed || 0}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Approval Governance SLA ───────────────────────────────── */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-500 uppercase">Average Approval Time</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {approvalAnalytics?.avgApprovalTime || 'No data'}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">From submission to manager decision</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-emerald-700 uppercase">Total Approved</div>
              <div className="text-2xl font-black text-emerald-800 mt-1">
                {approvalAnalytics?.approvedCount || 0}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-rose-700 uppercase">Total Rejected</div>
              <div className="text-2xl font-black text-rose-800 mt-1">
                {approvalAnalytics?.rejectedCount || 0}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-blue-700 uppercase">Returned for Revision</div>
              <div className="text-2xl font-black text-blue-800 mt-1">
                {approvalAnalytics?.returnedCount || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: Fulfillment & Operations ─────────────────────────────── */}
      {activeTab === 'fulfillment' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-amber-700 uppercase">Awaiting Allocation</div>
              <div className="text-2xl font-black text-amber-900 mt-1">
                {fulfillmentAnalytics?.unallocated || 0}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-blue-700 uppercase">Allocated & Ready</div>
              <div className="text-2xl font-black text-blue-900 mt-1">
                {fulfillmentAnalytics?.allocated || 0}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-purple-700 uppercase">Partially Fulfilled</div>
              <div className="text-2xl font-black text-purple-900 mt-1">
                {fulfillmentAnalytics?.partiallyFulfilled || 0}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-emerald-700 uppercase">Fully Completed</div>
              <div className="text-2xl font-black text-emerald-900 mt-1">
                {fulfillmentAnalytics?.fullyFulfilled || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 5: Billing & Subscriptions ──────────────────────────────── */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-500 uppercase">Total Invoiced</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {currencySymbol}
                {billingAnalytics?.totalInvoiced ? Number(billingAnalytics.totalInvoiced).toLocaleString() : '0'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-emerald-700 uppercase">Total Paid</div>
              <div className="text-2xl font-black text-emerald-800 mt-1">
                {currencySymbol}
                {billingAnalytics?.totalPaid ? Number(billingAnalytics.totalPaid).toLocaleString() : '0'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-amber-700 uppercase">One-Time Revenue</div>
              <div className="text-2xl font-black text-amber-900 mt-1">
                {currencySymbol}
                {billingAnalytics?.oneTimeRevenue ? Number(billingAnalytics.oneTimeRevenue).toLocaleString() : '0'}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Non-recurring hardware/services</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-green-700 uppercase">Recurring MRR Total</div>
              <div className="text-2xl font-black text-green-900 mt-1">
                {currencySymbol}
                {subscriptionAnalytics?.mrr ? Number(subscriptionAnalytics.mrr).toLocaleString() : '0'}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">From active subscription snapshots</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 6: Team & Rep Performance ───────────────────────────────── */}
      {activeTab === 'sales_reps' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-200">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Users size={16} className="text-green-700" /> Sales Representative Team Performance
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Sales Rep</th>
                  <th className="px-4 py-3 text-center">Active Deals</th>
                  <th className="px-4 py-3 text-right">Pipeline Value</th>
                  <th className="px-4 py-3 text-right">Confirmed Value</th>
                  <th className="px-4 py-3 text-center">Pending Approvals</th>
                  <th className="px-4 py-3 text-center">Negotiations</th>
                  <th className="px-4 py-3 text-center">Fulfilled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(salesRepAnalytics || []).map((rep) => (
                  <tr key={rep.salesRepId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{rep.name}</div>
                      <div className="text-[10px] text-slate-400">{rep.email}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">{rep.activeDealsCount}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {currencySymbol}{Number(rep.pipelineValue).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                      {currencySymbol}{Number(rep.confirmedValue).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-amber-700">{rep.pendingApprovals}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-700">{rep.negotiations}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-700">{rep.fulfilledDeals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
