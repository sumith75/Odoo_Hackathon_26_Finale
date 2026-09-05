import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchWithAuth } from '../../utils/api';
import {
  LayoutDashboard,
  FileText,
  Handshake,
  CheckCircle2,
  LogOut,
  Building2,
  Bell,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  User,
  Clock,
  ChevronRight,
} from 'lucide-react';

const CUSTOMER_NAV = [
  { id: 'dashboard', path: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'quotes', path: '/customer/quotes', label: 'My Quotes', icon: FileText },
  { id: 'negotiations', path: '/customer/quotes?status=UNDER_NEGOTIATION', label: 'Under Negotiation', icon: Handshake },
  { id: 'confirmed', path: '/customer/quotes?status=CONFIRMED', label: 'Confirmed Orders', icon: CheckCircle2 },
];

export default function CustomerLayout({ activeTab, onSelectTab, children }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetchWithAuth('/api/customer/notifications');
        if (res.success && res.data) {
          setNotifications(res.data);
          setUnreadCount(res.unreadCount || 0);
        }
      } catch (err) {
        console.error('Failed to fetch customer notifications:', err);
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = async () => {
    try {
      for (const n of notifications.filter((x) => !x.isRead)) {
        await fetchWithAuth(`/api/customer/notifications/${n.id}/read`, { method: 'PUT' });
      }
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* ── Top Bar ────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Left Brand + Customer Company */}
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
                  Customer Deal Room
                </span>
              </div>
            </div>

            {/* Customer Company pill */}
            <div className="hidden md:flex items-center pl-4 border-l border-slate-200">
              <span className="text-xs font-medium text-slate-500 mr-2">Company:</span>
              <span className="text-xs font-bold text-slate-800 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5">
                <Building2 size={13} className="text-emerald-700" />
                {user?.companyName || 'Acme Corporation'}
              </span>
              {user?.tier && (
                <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  {user.tier} TIER
                </span>
              )}
            </div>
          </div>

          {/* Right Controls: Notifications & User Profile */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-emerald-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell size={15} className="text-slate-600" />
                      <span className="text-xs font-bold text-slate-800">Your Deal Alerts</span>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No notifications yet. Quotation updates will appear here.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 text-xs transition-colors ${
                            n.isRead ? 'bg-white' : 'bg-emerald-50/50'
                          }`}
                        >
                          <p className="font-semibold text-slate-800">{n.title}</p>
                          <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                {user?.name?.charAt(0) || 'C'}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-xs font-semibold text-slate-800">{user?.name || 'Customer'}</p>
                <p className="text-[10px] text-slate-400">{user?.email || 'customer@acme.com'}</p>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout (Sidebar + Content) ─────────────────── */}
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 p-4 hidden lg:flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                Deal Room Navigation
              </p>
              <nav className="space-y-1">
                {CUSTOMER_NAV.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-green-700 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Security Guarantee Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-1">
                <ShieldCheck size={16} className="text-emerald-700" />
                <span>Verified Deal Room</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Direct negotiation channel with your dedicated sales representative.
              </p>
            </div>
          </div>

          {/* Representative Support Info */}
          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Need immediate help?</p>
            <p>Contact your account manager directly through quote comments.</p>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="w-64 h-full bg-white p-4 flex flex-col justify-between shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="font-bold text-slate-800 text-sm">Customer Portal</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                    <X size={18} />
                  </button>
                </div>
                <nav className="space-y-1">
                  {CUSTOMER_NAV.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          isActive ? 'bg-green-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} />
                          <span>{item.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
