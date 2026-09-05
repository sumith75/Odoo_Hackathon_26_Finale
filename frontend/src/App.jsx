import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, FileText, CheckSquare, Package,
  RefreshCcw, Receipt, HeartPulse, BarChart2,
  ShoppingBag, LogOut, ChevronDown, RotateCcw, Menu, X
} from 'lucide-react';

import { AuthProvider, useAuth } from './context/AuthContext';
import LoginView from './components/LoginView';
import AdminView from './components/AdminView';
import SalesRepCPQView from './components/SalesRepCPQView';
import ApprovalInboxView from './components/ApprovalInboxView';
import CustomerPortalView from './components/CustomerPortalView';
import WarehouseFulfillmentView from './components/WarehouseFulfillmentView';
import BillingCheckoutView from './components/BillingCheckoutView';
import DashboardView from './components/DashboardView';

// ── Nav items with role-based visibility ──────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',     icon: LayoutDashboard, roles: ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE_MANAGER'] },
  { id: 'sales',      label: 'Quotations',    icon: FileText,        roles: ['ADMIN', 'SALES_REP', 'SALES_MANAGER'] },
  { id: 'manager',    label: 'Approvals',     icon: CheckSquare,     roles: ['ADMIN', 'SALES_MANAGER'] },
  { id: 'operations', label: 'Fulfillment',   icon: Package,         roles: ['ADMIN', 'FINANCE_MANAGER'] },
  { id: 'billing',    label: 'Billing',       icon: RefreshCcw,      roles: ['ADMIN', 'FINANCE_MANAGER'] },
  { id: 'invoices',   label: 'Invoices',      icon: Receipt,         roles: ['ADMIN', 'FINANCE_MANAGER'] },
  { id: 'health',     label: 'Deal Health',   icon: HeartPulse,      roles: ['ADMIN', 'SALES_MANAGER'] },
  { id: 'reports',    label: 'Reports',       icon: BarChart2,       roles: ['ADMIN', 'SALES_MANAGER', 'FINANCE_MANAGER'] },
  { id: 'admin',      label: 'Products',      icon: ShoppingBag,     roles: ['ADMIN'] },
  // Customer-only
  { id: 'customer',   label: 'My Quotes',     icon: FileText,        roles: ['CUSTOMER'] },
];

const ROLE_BADGE = {
  ADMIN:           { label: 'Admin',       cls: 'bg-purple-100 text-purple-700' },
  SALES_REP:       { label: 'Sales Rep',   cls: 'bg-blue-100 text-blue-700' },
  SALES_MANAGER:   { label: 'Manager',     cls: 'bg-amber-100 text-amber-800' },
  FINANCE_MANAGER: { label: 'Finance',     cls: 'bg-green-100 text-green-700' },
  CUSTOMER:        { label: 'Customer',    cls: 'bg-gray-100 text-gray-700' },
};

// ── Default tab per role ──────────────────────────────────────────────────────
const ROLE_DEFAULT_TAB = {
  ADMIN:           'admin',
  SALES_REP:       'sales',
  SALES_MANAGER:   'manager',
  FINANCE_MANAGER: 'billing',
  CUSTOMER:        'customer',
};

function DealFlowApp() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [activeTab, setActiveTab]         = useState('sales');
  const [activeQuoteId, setActiveQuoteId] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen]   = useState(false);

  // When user logs in, set their default tab
  useEffect(() => {
    if (user?.role) {
      setActiveTab(ROLE_DEFAULT_TAB[user.role] || 'sales');
    }
  }, [user?.role]);

  const visibleNav = NAV_ITEMS.filter(item =>
    user?.role && item.roles.includes(user.role)
  );

  const handleResetDemo = async () => {
    try {
      await fetch('/api/admin/reset', { method: 'POST' });
      setActiveQuoteId(null);
      window.location.reload();
    } catch {}
  };

  // Loading splash
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in → Login page
  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

  const badge = ROLE_BADGE[user.role] || { label: user.role, cls: 'bg-gray-100 text-gray-700' };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top Header ─────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">

          {/* Brand + mobile menu */}
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-green-600 rounded-md flex items-center justify-center text-white font-black text-sm">D</div>
              <span className="text-base font-bold text-gray-900">DealFlow360</span>
              <span className="hidden sm:inline text-xs text-gray-400">Enterprise</span>
            </div>
          </div>

          {/* Right: user menu */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDemo}
              title="Reset demo data"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <RotateCcw size={15} />
            </button>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
              >
                <img
                  src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=16a34a&color=fff`}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover border border-gray-200"
                />
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-gray-900 leading-none">{user.name}</div>
                  <div className={`text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 inline-block ${badge.cls}`}>
                    {badge.label}
                  </div>
                </div>
                <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    {user.orgName && <p className="text-xs text-gray-400 mt-0.5">{user.orgName}</p>}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded mt-1 inline-block ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
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

        {/* ── Desktop Nav Tabs ────────────────────────── */}
        <div className="border-t border-gray-100 hidden lg:block">
          <nav className="flex items-center px-4 md:px-6 overflow-x-auto">
            {visibleNav.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`nav-tab ${activeTab === item.id ? 'active' : ''}`}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Mobile Nav ──────────────────────────────── */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-gray-100">
            <nav className="flex flex-col py-1">
              {visibleNav.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setMobileNavOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                      activeTab === item.id ? 'text-green-700 bg-green-50' : 'text-gray-600 hover:bg-gray-50'
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

      {userMenuOpen && <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />}

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
            <div className="card-body py-16 text-center text-gray-400">
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
