import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Mail,
  Phone,
  Globe,
  DollarSign,
  Clock,
  MapPin,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

const INDUSTRIES = [
  'Technology & Software',
  'Hardware & Electronics',
  'Manufacturing & Industrial',
  'Financial Services & Fintech',
  'Healthcare & Pharmaceuticals',
  'Logistics & Supply Chain',
  'Retail & E-commerce',
  'Professional Consulting',
  'Other',
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

export default function OrganizationView() {
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    name: '',
    companyEmail: '',
    phone: '',
    industry: '',
    country: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    address: '',
  });

  const loadOrganization = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetchWithAuth('/api/organization');
      if (res.success && res.data) {
        setForm({
          name: res.data.name || '',
          companyEmail: res.data.companyEmail || '',
          phone: res.data.phone || '',
          industry: res.data.industry || '',
          country: res.data.country || 'India',
          currency: res.data.currency || 'INR',
          timezone: res.data.timezone || 'Asia/Kolkata',
          address: res.data.address || '',
        });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load organization settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganization();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetchWithAuth('/api/organization', {
        method: 'PUT',
        body: JSON.stringify(form),
      });

      if (res.success) {
        setSuccessMsg('Organization profile updated successfully');
        await refreshUser();
      } else {
        setErrorMsg(res.message || 'Update failed');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update organization profile');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-green-700 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading organization profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Building2 className="text-green-700" size={24} /> Organization Profile & Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure primary organization identity, currency, region, and official contact information.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-sm font-semibold">
          <CheckCircle2 size={18} className="text-emerald-700" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-800 text-sm font-semibold">
          <AlertCircle size={18} className="text-red-600" />
          {errorMsg}
        </div>
      )}

      {/* ── Form Card ─────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Organization Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Organization / Company Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                placeholder="e.g. TechWorld Solutions Pvt Ltd"
              />
            </div>
          </div>

          {/* Industry */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Industry Domain
            </label>
            <select
              name="industry"
              value={form.industry}
              onChange={handleChange}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Company Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Official Company Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail size={15} />
              </div>
              <input
                type="email"
                name="companyEmail"
                value={form.companyEmail}
                onChange={handleChange}
                className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                placeholder="info@techworld.com"
              />
            </div>
          </div>

          {/* Company Phone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Primary Phone Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Phone size={15} />
              </div>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          {/* Base Currency */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Default Operational Currency <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <DollarSign size={15} />
              </div>
              <select
                name="currency"
                value={form.currency}
                onChange={handleChange}
                required
                className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
              >
                {CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur} - Primary Currency
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Used as base currency for products, quote totals, and invoices.
            </p>
          </div>

          {/* Country */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Country
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Globe size={15} />
              </div>
              <input
                type="text"
                name="country"
                value={form.country}
                onChange={handleChange}
                className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                placeholder="India"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Primary Timezone
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Clock size={15} />
              </div>
              <input
                type="text"
                name="timezone"
                value={form.timezone}
                onChange={handleChange}
                className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                placeholder="Asia/Kolkata"
              />
            </div>
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Registered Office Address
            </label>
            <div className="relative">
              <div className="absolute top-2.5 left-3 flex items-start pointer-events-none text-slate-400">
                <MapPin size={15} />
              </div>
              <textarea
                name="address"
                rows={3}
                value={form.address}
                onChange={handleChange}
                className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
                placeholder="Plot 42, Hitech City, Hyderabad, Telangana, India"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Saving Changes...
              </>
            ) : (
              <>
                <Save size={16} /> Save Organization Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
