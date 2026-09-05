import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, FileText, CheckSquare, Package,
  RefreshCcw, Receipt, HeartPulse, BarChart2,
  ShoppingBag, LogOut, ChevronDown, RotateCcw, Menu, X
} from 'lucide-react';

import { AuthProvider, useAuth, GOOGLE_PERSONAS } from './context/AuthContext';
import LoginView from './components/LoginView';
import AdminView from './components/AdminView';
import SalesRepCPQView from './components/SalesRepCPQView';
import ApprovalInboxView from './components/ApprovalInboxView';
import CustomerPortalView from './components/CustomerPortalView';
import WarehouseFulfillmentView from './components/WarehouseFulfillmentView';
import BillingCheckoutView from './components/BillingCheckoutView';
import DashboardView from './components/DashboardView';

// ── Nav configuration ────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',     icon: LayoutDashboard, roles: ['ADMIN','SALES_REP','SALES_MANAGER','FINANCE_OPERATIONS'] },
  { id: 'sales',       label: 'Quotations',    icon: FileText,         roles: ['ADMIN','SALES_REP','SALES_MANAGER'] },
  { id: 'manager',     label: 'Approvals',     icon: CheckSquare,      roles: ['ADMIN','SALES_MANAGER'] },
  { id: 'operations',  label: 'Fulfillment',   icon: Package,          roles: ['ADMIN','FINANCE_OPERATIONS'] },
  { id: 'billing',     label: 'Subscriptions', icon: RefreshCcw,       roles: ['ADMIN','FINANCE_OPERATIONS'] },
  { id: 'invoices',    label: 'Invoices',      icon: Receipt,          roles: ['ADMIN','FINANCE_OPERATIONS'] },
  { id: 'health',      label: 'Deal Health',   icon: HeartPulse,       roles: ['ADMIN','SALES_MANAGER'] },
  { id: 'reports',     label: 'Reports',       icon: BarChart2,        roles: ['ADMIN','SALES_MANAGER','FINANCE_OPERATIONS'] },
  { id: 'admin',       label: 'Products',      icon: ShoppingBag,      roles: ['ADMIN'] },
  // Customer-only
  { id: 'customer',    label: 'My Quotes',     icon: FileText,         roles: ['CUSTOMER'] },
];

const ROLE_COLORS = {
  ADMIN:              'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30',
  SALES_REP:          'bg-teal-400/15 text-teal-300 ring-1 ring-teal-400/30',
  SALES_MANAGER:      'bg-lime-400/15 text-lime-300 ring-1 ring-lime-400/30',
  FINANCE_OPERATIONS: 'bg-green-400/15 text-green-300 ring-1 ring-green-400/30',
  CUSTOMER:           'bg-emerald-900 text-emerald-200 ring-1 ring-emerald-700',
};

function DealFlowApp() {
  const { user, isAuthenticated, isLoading, logout, switchRole, personas } = useAuth();
  const [activeTab, setActiveTab]     = useState('sales');
  const [activeQuoteId, setActiveQuoteId] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen]   = useState(false);

  // Sync tab on role switch
  useEffect(() => {
    if (user?.tab) setActiveTab(user.tab);
  }, [user?.role]);

  // Only show nav items the current role can access
  const visibleNav = NAV_ITEMS.filter(item =>
    user?.role && item.roles.includes(user.role)
  );

  const handleRoleSwitch = async (roleObj) => {
    await switchRole(roleObj);
    setActiveTab(roleObj.tab);
    setUserMenuOpen(false);
  };

  const handleResetDemo = async () => {
    try {
      await fetch('/api/admin/reset', { method: 'POST' });
      setActiveQuoteId(null);
      window.location.reload();
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Login gate
  if (!isAuthenticated || !user) {
    return <LoginView onLoginSuccess={(tab) => { if (tab) setActiveTab(tab); }} />;
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col">

      {/* ── Top Header ─────────────────────────────────── */}
      <header className="bg-emerald-950/90 border-b border-emerald-800/70 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">

          {/* Brand */}
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-1.5 text-emerald-300 hover:bg-emerald-900 rounded-md"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-green-600 rounded-md flex items-center justify-center text-white font-black text-sm">
                D
              </div>
              <div>
                <span className="text-base font-display font-bold text-emerald-50">DealFlow360</span>
                <span className="hidden sm:inline ml-2 text-xs text-emerald-300/60">Enterprise</span>
              </div>
            </div>
          </div>

          {/* Right side: user menu */}
          <div className="flex items-center gap-2">
            {/* Reset demo */}
            <button
              onClick={handleResetDemo}
              title="Reset demo data"
              className="p-2 text-emerald-300/60 hover:text-emerald-200 hover:bg-emerald-900 rounded-md transition-colors"
            >
              <RotateCcw size={15} />
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-md hover:bg-emerald-900 transition-colors"
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover border border-emerald-600"
                />
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-emerald-50 leading-none">{user.name}</div>
                  <div className={`text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 inline-block ${ROLE_COLORS[user.role]}`}>
                    {user.badge}
                  </div>
                </div>
                <ChevronDown size={14} className="text-emerald-300/60 hidden sm:block" />
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-emerald-950 border border-emerald-700 rounded-lg shadow-lg shadow-emerald-950/50 z-50 overflow-hidden">
                  {/* Current user */}
                  <div className="px-4 py-3 border-b border-emerald-800 bg-emerald-900/60">
                    <p className="text-xs font-semibold text-emerald-300/60 uppercase tracking-wider mb-2">Signed in as</p>
                    <div className="flex items-center gap-2">
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-50">{user.name}</p>
                        <p className="text-xs text-emerald-300/60">{user.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Switch persona */}
                  <div className="px-4 py-2 border-b border-emerald-800">
                    <p className="text-[11px] font-semibold text-emerald-300/60 uppercase tracking-wider mb-1.5">Switch Persona</p>
                    {personas.map(p => (
                      <button
                        key={p.role}
                        onClick={() => handleRoleSwitch(p)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left ${
                          user.role === p.role ? 'bg-emerald-400/15 text-emerald-300' : 'text-emerald-100 hover:bg-emerald-900'
                        }`}
                      >
                        <img src={p.avatar} alt={p.name} className="w-6 h-6 rounded-full border border-emerald-600" />
                        <span className="font-medium">{p.name}</span>
                        {user.role === p.role && (
                          <span className="ml-auto text-green-600">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Logout */}
                  <div className="p-2">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-300 hover:bg-rose-400/10 rounded-md transition-colors"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Navigation Tabs ─────────────────────────── */}
        <div className="border-t border-emerald-900 bg-emerald-950/70 hidden lg:block">
          <nav className="flex items-center px-4 md:px-6 overflow-x-auto">
            {visibleNav.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileNavOpen(false); }}
                  className={`nav-tab ${isActive ? 'active' : ''}`}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Mobile Nav Drawer ───────────────────────── */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-emerald-900 bg-emerald-950">
            <nav className="flex flex-col py-1">
              {visibleNav.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setMobileNavOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-green-700 bg-green-50'
                        : 'text-emerald-300/70 hover:bg-emerald-900 hover:text-emerald-100'
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Click outside to close dropdowns */}
      {userMenuOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
      )}

      {/* ── Page Content ───────────────────────────────── */}
      <main className="flex-1 p-4 md:p-6 max-w-screen-xl mx-auto w-full">

        {activeTab === 'admin' && (
          <AdminView onRulesUpdated={() => setActiveTab('sales')} />
        )}

        {activeTab === 'sales' && (
          <SalesRepCPQView
            prefillExcessiveDiscount={false}
            onQuoteCreated={(quote) => {
              setActiveQuoteId(quote.id);
              const needsApproval =
                quote.status === 'PENDING_APPROVAL' ||
                quote.approval_status === 'PENDING_APPROVAL' ||
                quote.approval_status === 'PENDING_MANAGER';
              setActiveTab(needsApproval ? 'manager' : 'operations');
            }}
          />
        )}

        {activeTab === 'manager' && (
          <ApprovalInboxView
            onApproved={(quote) => {
              setActiveQuoteId(quote.id);
              setActiveTab('operations');
            }}
          />
        )}

        {activeTab === 'operations' && (
          <WarehouseFulfillmentView quoteId={activeQuoteId} />
        )}

        {activeTab === 'customer' && (
          <CustomerPortalView
            quoteId={activeQuoteId}
            onCounterOfferSubmitted={() => setActiveTab('manager')}
            onQuoteConfirmed={() => setActiveTab('billing')}
          />
        )}

        {activeTab === 'billing' && (
          <BillingCheckoutView
            quoteId={activeQuoteId}
            onPaymentCompleted={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'dashboard' && <DashboardView />}

        {(activeTab === 'invoices' || activeTab === 'health' || activeTab === 'reports') && (
          <div className="card">
            <div className="card-body py-16 text-center text-emerald-300/60">
              <p className="text-sm">This section is coming soon.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DealFlowApp />
    </AuthProvider>
  );
}
