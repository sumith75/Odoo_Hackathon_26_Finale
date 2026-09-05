import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Check,
  ExternalLink,
  ShieldAlert,
  FileText,
  DollarSign,
  Truck,
  MessageSquare,
  AlertCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = [
  { id: 'ALL', label: 'All Notifications' },
  { id: 'UNREAD', label: 'Unread Only' },
  { id: 'APPROVALS', label: 'Approvals & Governance' },
  { id: 'NEGOTIATIONS', label: 'Deal Room & Negotiations' },
  { id: 'FULFILLMENT', label: 'Fulfillment & Logistics' },
  { id: 'BILLING', label: 'Invoices & Payments' },
  { id: 'SYSTEM', label: 'System & Deal Health Alerts' },
];

export default function NotificationCenterView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [search, setSearch] = useState('');

  const token = localStorage.getItem('dealflow_token');

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?category=${activeCategory}&page=${page}&limit=15`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data || []);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Notification Center fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [activeCategory, page]);

  const handleMarkAsRead = async (id) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
      }
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const getCategoryIcon = (type) => {
    if (type?.includes('APPROVAL')) return <ShieldAlert size={18} className="text-amber-600" />;
    if (type?.includes('QUOTE')) return <FileText size={18} className="text-blue-600" />;
    if (type?.includes('NEGOTIATION')) return <MessageSquare size={18} className="text-purple-600" />;
    if (type?.includes('FULFILLMENT') || type?.includes('INVENTORY')) return <Truck size={18} className="text-emerald-600" />;
    if (type?.includes('INVOICE') || type?.includes('PAYMENT')) return <DollarSign size={18} className="text-green-600" />;
    return <AlertCircle size={18} className="text-slate-500" />;
  };

  const filteredNotifications = notifications.filter(
    (n) =>
      !search ||
      n.title?.toLowerCase().includes(search.toLowerCase()) ||
      n.message?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-700 text-white flex items-center justify-center font-bold">
              <Bell size={18} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notification Center</h1>
          </div>
          <p className="text-sm text-slate-500">
            Real-time workflow alerts, governance approvals, deal room negotiations, and status updates.
          </p>
        </div>
        <button
          onClick={handleMarkAllRead}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all"
        >
          <CheckCheck size={16} /> Mark All as Read
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar Category Tabs */}
        <div className="lg:col-span-1 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-1 h-fit">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-2">
            Categories
          </div>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setPage(1);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeCategory === cat.id
                  ? 'bg-green-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <Search size={16} className="text-slate-400 ml-2" />
            <input
              type="text"
              placeholder="Search notifications by keyword or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-xs outline-none bg-transparent text-slate-800 placeholder-slate-400 font-medium"
            />
          </div>

          {/* Notifications Card Feed */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-12 text-center">
                <Inbox size={32} className="mx-auto text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-700 mb-1">No Notifications Found</h3>
                <p className="text-xs text-slate-400">There are no notifications matching your current selection.</p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 sm:p-5 transition-colors flex items-start gap-4 ${
                    !n.isRead ? 'bg-emerald-50/30' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 mt-0.5 flex-shrink-0">
                    {getCategoryIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{n.title}</span>
                        {!n.isRead && (
                          <span className="text-[10px] font-bold bg-green-700 text-white px-2 py-0.5 rounded-full">
                            New
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-slate-400">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-3">{n.message}</p>
                    <div className="flex items-center gap-3">
                      {n.actionUrl && (
                        <button
                          onClick={() => {
                            if (!n.isRead) handleMarkAsRead(n.id);
                            navigate(n.actionUrl);
                          }}
                          className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors"
                        >
                          <span>Open Workflow</span>
                          <ExternalLink size={13} />
                        </button>
                      )}
                      {!n.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(n.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <Check size={14} /> Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-600"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-600"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
