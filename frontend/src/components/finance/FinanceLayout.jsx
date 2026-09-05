import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchWithAuth } from '../../utils/api';
import {
  LayoutDashboard,
  PackageCheck,
  Receipt,
  Repeat,
  Warehouse,
  LogOut,
  Building2,
  Menu,
  X,
  Bell,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

const FINANCE_NAV_ITEMS = [
  { id: 'dashboard', path: '/finance/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'fulfillment', path: '/finance/fulfillment', label: 'Fulfillment Queue', icon: PackageCheck, hasBadge: true },
  { id: 'invoices', path: '/finance/invoices', label: 'Invoices & Billing', icon: Receipt },
  { id: 'subscriptions', path: '/finance/subscriptions', label: 'Subscriptions', icon: Repeat },
  { id: 'warehouses', path: '/finance/warehouses', label: 'Warehouses & Stock', icon: Warehouse },
];

export default function FinanceLayout({ activeTab, onSelectTab, children }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);

  // Poll / fetch pending count for live badge
  useEffect(() => {
    const fetchBadge = async () => {
      try {
        const res = await fetchWithAuth('/api/finance/dashboard');
        if (res.success && res.data?.kpis) {
          setBadgeCount(res.data.kpis.pendingAllocationCount || 0);
        }
      } catch (err) {
        console.error('Failed to fetch finance badge count:', err);
      }
    };
    fetchBadge();
    const interval = setInterval(fetchBadge, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* ── Top Bar ────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Left Brand + Org */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-700 text-white font-bold rounded-lg flex items-center justify-center text-base shadow-xs">
                D
              </div>
              <div className="leading-tight">
                <span className="font-bold text-slate-900 tracking-tight text-base">DealFlow360</span>
                <span className="text-[11px] block font-semibold text-green-700 tracking-wide uppercase">
                  Finance & Operations Portal
                </span>
              </div>
            </div>

            <div className="hidden md:flex items-center pl-4 border-l border-slate-200">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Building2 size={12} className="text-emerald-700" />
                {user?.organizationName || '—'}
              </span>
            </div>
          </div>

          {/* Right User & Live Status */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Multi-Warehouse Sync
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold shadow-xs">
                {user?.name?.slice(0, 2).toUpperCase() || 'FO'}
              </div>
              <div className="hidden lg:block text-left leading-tight">
                <p className="text-xs font-semibold text-slate-800">{user?.name}</p>
                <p className="text-[10px] text-slate-500 font-medium capitalize">
                  Finance & Operations
                </p>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Workspace Body ────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Desktop) */}
        <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col justify-between p-4 shrink-0">
          <nav className="space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Operations Navigation
            </div>
            {FINANCE_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-green-50 text-green-800 border border-green-200/80 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      size={17}
                      className={isActive ? 'text-green-700' : 'text-slate-400'}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.hasBadge && badgeCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick System Health Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
              <ShieldCheck size={14} className="text-green-600" />
              <span>Multi-Tenant Engine</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Real-time stock validation, automated split allocation, and hybrid billing ledger.
            </p>
          </div>
        </aside>

        {/* Mobile Slide-over Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-full bg-white h-full shadow-2xl flex flex-col justify-between p-4 z-50">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-500">
                    <X size={18} />
                  </button>
                </div>
                <nav className="space-y-1">
                  {FINANCE_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                          isActive
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={17} className={isActive ? 'text-green-700' : 'text-slate-400'} />
                          <span>{item.label}</span>
                        </div>
                        {item.hasBadge && badgeCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                            {badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Central Workspace Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
