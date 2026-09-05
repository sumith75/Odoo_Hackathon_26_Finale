import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchWithAuth } from '../../utils/api';
import {
  LayoutDashboard,
  Inbox,
  Briefcase,
  History,
  LogOut,
  Building2,
  ShieldAlert,
  ShieldCheck,
  Menu,
  X,
  Bell,
  Sparkles,
} from 'lucide-react';

const MANAGER_NAV_ITEMS = [
  { id: 'dashboard', path: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'approvals', path: '/manager/approvals', label: 'Approval Inbox', icon: Inbox, hasBadge: true },
  { id: 'deals', path: '/manager/deals', label: 'Team Deals', icon: Briefcase },
  { id: 'history', path: '/manager/history', label: 'Approval History', icon: History },
];

export default function ManagerLayout({ activeTab, onSelectTab, children }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Poll / fetch pending count for live badge
  useEffect(() => {
    const fetchBadgeCount = async () => {
      try {
        const res = await fetchWithAuth('/api/manager/dashboard');
        if (res.success && res.data?.kpis) {
          setPendingCount(res.data.kpis.pendingApprovals || 0);
        }
      } catch (err) {
        console.error('Failed to fetch pending approvals count:', err);
      }
    };
    fetchBadgeCount();
    const interval = setInterval(fetchBadgeCount, 15000);
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
                  Sales Manager / Approver Portal
                </span>
              </div>
            </div>

            <div className="hidden md:flex items-center pl-4 border-l border-slate-200">
              <span className="text-xs font-medium text-slate-500 mr-2">Organization:</span>
              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1.5">
                <Building2 size={13} className="text-green-700" />
                {user?.organizationName || user?.organization?.name || '—'}
              </span>
              <span className="ml-2 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {user?.currency || 'INR'}
              </span>
            </div>
          </div>

          {/* Right User Controls */}
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <button
                onClick={() => onSelectTab('approvals')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <ShieldAlert size={14} className="text-amber-600" />
                <span>{pendingCount} Pending Approval{pendingCount > 1 ? 's' : ''}</span>
              </button>
            )}

            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 font-bold text-xs">
                {user?.name?.slice(0, 2).toUpperCase() || 'SM'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-none">{user?.name || 'Sales Manager'}</p>
                <p className="text-[10px] font-semibold text-amber-700 leading-none mt-1">
                  Sales Manager
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout Body ───────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col justify-between p-4 flex-shrink-0">
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                Approval Governance
              </p>
              <nav className="space-y-1">
                {MANAGER_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-green-700 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                        <span>{item.label}</span>
                      </div>
                      {item.hasBadge && pendingCount > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                            isActive ? 'bg-white text-green-800' : 'bg-amber-500 text-white'
                          }`}
                        >
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Governance Note */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950">
              <div className="flex items-center gap-1.5 font-bold mb-1 text-green-800">
                <ShieldCheck size={14} className="text-green-700" />
                Authority Chain
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                You evaluate requested discounts exceeding ceilings (Hardware &gt;15%, Service &gt;10%, Subscription &gt;5%) and enforce profit margin health.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <div className="text-[11px] text-slate-400 flex items-center justify-between px-2">
              <span>DealFlow360 Multi-Tenant</span>
              <span className="font-semibold text-slate-500">v3.0.0</span>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-64 bg-white flex flex-col justify-between p-4 shadow-xl z-10">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                  <span className="font-bold text-sm text-slate-800">Sales Manager Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400">
                    <X size={18} />
                  </button>
                </div>
                <nav className="space-y-1">
                  {MANAGER_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-green-700 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                          <span>{item.label}</span>
                        </div>
                        {item.hasBadge && pendingCount > 0 && (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                              isActive ? 'bg-white text-green-800' : 'bg-amber-500 text-white'
                            }`}
                          >
                            {pendingCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
              <button
                onClick={logout}
                className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
