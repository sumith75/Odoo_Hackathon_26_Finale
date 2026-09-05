import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  Package,
  Percent,
  CheckCheck,
  History,
  LogOut,
  ChevronDown,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  Warehouse,
} from 'lucide-react';

const ADMIN_NAVIGATION = [
  { id: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
  { id: 'organization', label: 'Organization Setup', icon: Building2 },
  { id: 'team', label: 'Team Management', icon: Users },
  { id: 'customers', label: 'Customer Directory', icon: UserCheck },
  { id: 'products', label: 'Product Catalog', icon: Package },
  { id: 'discount-rules', label: 'Discount Rules', icon: Percent },
  { id: 'approval-rules', label: 'Approval Rules', icon: CheckCheck },
  { id: 'warehouses', label: 'Warehouses & Inventory', icon: Warehouse },
  { id: 'audit', label: 'Audit Activity', icon: History },
];

export default function AdminLayout({ activeTab, onSelectTab, children }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* ── Top Bar ────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Left Brand + Org */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
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
                  Admin Portal
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
                {user?.currency || user?.organization?.currency || ''}
              </span>
            </div>
          </div>

          {/* Right User Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="w-7 h-7 rounded-full bg-green-700 text-white font-bold text-xs flex items-center justify-center">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-800 leading-none">{user?.name}</div>
                <div className="text-[10px] font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                  <ShieldCheck size={10} /> Tenant Admin
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-700 px-3 py-1.5 border border-slate-200 hover:border-red-200 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Body with Sidebar ─────────────────────────── */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:block w-64 border-r border-slate-200 bg-white p-4 flex-shrink-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">
            Administration
          </div>
          <nav className="space-y-1">
            {ADMIN_NAVIGATION.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-green-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={17} className={isActive ? 'text-white' : 'text-slate-500'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900">
            <p className="font-bold mb-1 flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-700" /> Multi-Tenant Mode
            </p>
            <p className="text-[11px] text-emerald-700 leading-snug">
              All settings, team accounts, catalogs, and rules are strictly isolated to your organization.
            </p>
          </div>
        </aside>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/50" onClick={() => setMobileMenuOpen(false)}>
            <div
              className="bg-white w-72 h-full p-4 shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-3">
                <div className="font-bold text-slate-900">DealFlow360 Admin</div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-500">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1 flex-1">
                {ADMIN_NAVIGATION.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                        isActive ? 'bg-green-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={logout}
                className="flex items-center gap-2 p-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
