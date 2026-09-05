import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Search,
  Building2,
  Mail,
  PlusCircle,
  RefreshCw,
  Tag,
  CheckCircle2,
} from 'lucide-react';

const TIER_BADGE = {
  GOLD: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
  SILVER: 'bg-slate-200 text-slate-800 border-slate-300 font-bold',
  BRONZE: 'bg-orange-100 text-orange-900 border-orange-300 font-bold',
};

export default function CustomersView({ onSelectCustomerForQuote }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/customers');
      if (res.success) {
        setCustomers(res.data);
      }
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filtered = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.companyName && c.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'ALL' || c.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Users className="text-green-700" size={24} /> Customer Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Accounts, commercial classifications, and organization discount governance records.
          </p>
        </div>

        <button
          onClick={loadCustomers}
          className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh List
        </button>
      </div>

      {/* ── Search & Filter Bar ────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search accounts by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
          />
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <span className="text-xs font-bold text-slate-500">Commercial Tier:</span>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-600/30"
          >
            <option value="ALL">All Tiers ({customers.length})</option>
            <option value="GOLD">Gold Tier</option>
            <option value="SILVER">Silver Tier</option>
            <option value="BRONZE">Bronze Tier</option>
          </select>
        </div>
      </div>

      {/* ── Customer Cards / Table ────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-green-700 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading customer accounts...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No customers found matching your search.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((cust) => (
              <div
                key={cust.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-black flex items-center justify-center text-sm flex-shrink-0">
                    <Building2 size={20} className="text-slate-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {cust.companyName || cust.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          TIER_BADGE[cust.tier] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {cust.tier} Tier
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Mail size={12} className="text-slate-400" /> {cust.email}
                      </span>
                      <span>•</span>
                      <span>Currency: {cust.currency || 'INR'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => onSelectCustomerForQuote(cust.id)}
                    className="px-3.5 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <PlusCircle size={14} /> Create Quote
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
