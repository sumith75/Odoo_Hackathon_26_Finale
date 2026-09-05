import React, { useState } from 'react';
import { Shield, ChevronRight, X, ArrowRight } from 'lucide-react';
import { useAuth, GOOGLE_PERSONAS } from '../context/AuthContext';

const GoogleIcon = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

const ROLE_COLORS = {
  ADMIN:              'bg-emerald-100 text-emerald-800',
  SALES_REP:          'bg-teal-100 text-teal-800',
  SALES_MANAGER:      'bg-lime-100 text-lime-800',
  FINANCE_OPERATIONS: 'bg-green-100 text-green-800',
  CUSTOMER:           'bg-emerald-50 text-emerald-700',
};

export default function LoginView({ onLoginSuccess }) {
  const { loginWithGoogle, isLoading } = useAuth();
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [signingInRole, setSigningInRole] = useState(null);

  const handleSelectAccount = async (persona) => {
    setSigningInRole(persona.role);
    await loginWithGoogle(persona);
    setSigningInRole(null);
    setShowGoogleModal(false);
    if (onLoginSuccess) onLoginSuccess(persona.tab);
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex">
      {/* ── Left Panel ─────────────────────────────── */}
      <div className="hidden lg:flex w-1/2 bg-green-700 flex-col justify-between p-12 text-white">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-md flex items-center justify-center text-green-700 font-black text-lg">
            D
          </div>
          <span className="text-xl font-bold tracking-tight">DealFlow360</span>
        </div>

        {/* Hero text */}
        <div>
          <h1 className="text-4xl font-bold leading-snug mb-4">
            Smart Deal Management,<br />From Quote to Cash
          </h1>
          <p className="text-green-200 text-base leading-relaxed max-w-sm">
            Automated risk detection, multi-level approvals, warehouse allocation, customer negotiations, and hybrid billing — all in one engine.
          </p>

          {/* Feature bullets */}
          <ul className="mt-8 space-y-3">
            {[
              'Real-time discount risk scoring',
              'Multi-level manager approval chain',
              'Customer negotiation portal',
              'Hybrid one-time + subscription billing',
              'Warehouse stock split & fulfillment',
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-green-100">
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-green-300 text-xs">© 2025 DealFlow360 · Enterprise Deal Lifecycle Engine</p>
      </div>

      {/* ── Right Panel ─────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-emerald-50">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-green-600 rounded-md flex items-center justify-center text-white font-black">
            D
          </div>
          <span className="text-lg font-bold text-gray-900">DealFlow360</span>
        </div>

        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Sign in to your account</h2>
            <p className="text-sm text-gray-500 mt-1">Access your role-based workspace</p>
          </div>

          {/* Google Sign-In Button */}
          <button
            onClick={() => setShowGoogleModal(true)}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-6"
          >
            <GoogleIcon />
            Sign in with Google Workspace
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-gray-50 text-xs text-gray-400 font-medium uppercase tracking-wider">
                Quick access — select persona
              </span>
            </div>
          </div>

          {/* Persona List */}
          <div className="space-y-2">
            {GOOGLE_PERSONAS.map((persona) => {
              const isSigningIn = signingInRole === persona.role;
              return (
                <button
                  key={persona.role}
                  onClick={() => handleSelectAccount(persona)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-md hover:border-green-400 hover:bg-green-50 transition-all text-left group"
                >
                  <img
                    src={persona.avatar}
                    alt={persona.name}
                    className="w-9 h-9 rounded-full object-cover border border-gray-200 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 group-hover:text-green-800">
                        {persona.name}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${ROLE_COLORS[persona.role]}`}>
                        {persona.badge}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 truncate">{persona.email}</div>
                  </div>
                  <div className="text-gray-400 group-hover:text-green-600 transition-colors flex-shrink-0">
                    {isSigningIn ? (
                      <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Shield size={12} className="text-green-500" />
            <span>Role-based access control · Audit trail enabled</span>
          </div>
        </div>
      </div>

      {/* ── Google Account Selector Modal ────────────── */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white border border-gray-200 rounded-lg max-w-sm w-full shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <GoogleIcon />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Choose an account</h3>
                  <p className="text-xs text-gray-500">to continue to DealFlow360</p>
                </div>
              </div>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md p-1 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Accounts list */}
            <div className="divide-y divide-gray-100">
              {GOOGLE_PERSONAS.map((persona) => (
                <button
                  key={persona.email}
                  onClick={() => handleSelectAccount(persona)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <img
                    src={persona.avatar}
                    alt={persona.name}
                    className="w-9 h-9 rounded-full object-cover border border-gray-200 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{persona.name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${ROLE_COLORS[persona.role]}`}>
                        {persona.badge}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">{persona.googleEmail}</div>
                  </div>
                  <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>

            <div className="px-5 py-3 bg-gray-50 rounded-b-lg border-t border-gray-100">
              <p className="text-xs text-center text-gray-400">
                Secured by Google OAuth · DealFlow360 Enterprise
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
