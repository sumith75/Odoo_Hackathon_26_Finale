import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import DiscountRulesView from './admin/DiscountRulesView';
import AdminDashboard from './admin/AdminDashboard';

/**
 * AdminView — Database-backed Admin View
 * Replaces legacy static mock data with live PostgreSQL data from /api/discount-rules and /api/products
 */
export default function AdminView({ onRulesUpdated }) {
  const [activeTab, setActiveTab] = useState('rules');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
              Admin Governance
            </span>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Settings className="text-green-700" size={22} /> Commercial Policy & Discount Governance
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time PostgreSQL-backed governance rules: tier discount ceilings, minimum profit margins, and auto-approval limits.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              activeTab === 'rules'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Discount Rules
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Organization Overview
          </button>
        </div>
      </div>

      {/* Real Live Database Component */}
      {activeTab === 'rules' ? (
        <DiscountRulesView />
      ) : (
        <AdminDashboard onNavigate={() => setActiveTab('rules')} />
      )}
    </div>
  );
}
