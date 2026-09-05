import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Building2, User, Shield, Briefcase, FileSpreadsheet } from 'lucide-react';

const ROLE_INFO = {
  SALES_REP: {
    title: 'Sales Representative Portal',
    badge: 'Sales Rep',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Briefcase,
    description: 'DealFlow360 CPQ & Quotations Engine',
    details: 'As a Sales Representative, you will create quotations, configure products, calculate real-time discount risk scores, and request managerial approvals.',
  },
  SALES_MANAGER: {
    title: 'Sales Manager Approval Portal',
    badge: 'Sales Manager',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Shield,
    description: 'Quote Approval Chain & Deal Health',
    details: 'As a Sales Manager, you will review pending quote discounts, evaluate approval rules, approve or reject deals, and monitor pipeline margins.',
  },
  FINANCE_OPERATIONS: {
    title: 'Finance & Operations Portal',
    badge: 'Finance & Ops',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: FileSpreadsheet,
    description: 'Hybrid Billing, Invoicing & Fulfillment',
    details: 'As a Finance & Operations specialist, you manage warehouse stock allocation, hybrid recurring + milestone billing, and final contract sign-offs.',
  },
  CUSTOMER: {
    title: 'Customer Negotiation Portal',
    badge: 'Customer',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: User,
    description: 'Deal Review & Negotiation Room',
    details: 'View live quotations, accept proposals, submit counter-offers with requested discounts, and complete digital checkout.',
  },
};

export default function RolePortalPlaceholder() {
  const { user, logout } = useAuth();
  const info = ROLE_INFO[user?.role] || {
    title: 'DealFlow360 Workspace',
    badge: user?.role || 'User',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: User,
    description: 'Role-based Workspace',
    details: 'You are signed into DealFlow360.',
  };

  const IconComponent = info.icon;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-700 text-white font-black rounded flex items-center justify-center text-base">
            D
          </div>
          <div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">DealFlow360</span>
            <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
              Enterprise B2B
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 size={16} className="text-green-700" />
            <span className="font-semibold text-gray-800">
              {user?.organizationName || user?.companyName || user?.organization?.name || 'DealFlow360 Enterprise'}
            </span>
          </div>

          <div className="h-4 w-px bg-gray-300" />

          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 px-3 py-1.5 border border-red-200 hover:bg-red-50 rounded transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-8 flex flex-col justify-center items-center">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 w-full text-center">
          <div className="w-16 h-16 bg-green-50 text-green-700 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-green-200">
            <IconComponent size={32} />
          </div>

          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider mb-2 ${info.color}`}>
            {info.badge} {user?.tier ? `• ${user.tier} TIER` : ''}
          </span>

          <h1 className="text-2xl font-bold text-gray-900 mt-2">{info.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{info.description}</p>

          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-left max-w-lg mx-auto">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 block font-medium">Logged-in Customer</span>
                <span className="font-semibold text-gray-800 text-sm">{user?.name}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Email</span>
                <span className="font-semibold text-gray-800 text-sm">{user?.email}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Account Type</span>
                <span className="font-semibold text-emerald-700 text-sm">
                  {user?.companyName ? `${user.companyName} (Client)` : user?.role}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Vendor Organization</span>
                <span className="font-semibold text-gray-800 text-sm">
                  {user?.organizationName || user?.organization?.name || 'TechWorld Solutions'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 text-sm text-gray-600 max-w-md mx-auto">
            <p>{info.details}</p>
            <p className="mt-3 text-xs text-emerald-700 font-semibold bg-emerald-50 py-2 px-3 rounded border border-emerald-200 inline-block">
              ℹ️ Current Phase: Admin Portal active. This role module will activate in the next phase!
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center gap-3">
            <button
              onClick={logout}
              className="px-5 py-2 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Sign out & Return to Login
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
