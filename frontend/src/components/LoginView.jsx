import React, { useState } from 'react';
import { Sparkles, Shield, User, ChevronRight, X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth, GOOGLE_PERSONAS } from '../context/AuthContext';

export default function LoginView({ onLoginSuccess }) {
  const { loginWithGoogle, isLoading } = useAuth();
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [signingInRole, setSigningInRole] = useState(null);

  const handleSelectAccount = async (persona) => {
    setSigningInRole(persona.role);
    await loginWithGoogle(persona);
    setSigningInRole(null);
    setShowGoogleModal(false);
    if (onLoginSuccess) {
      onLoginSuccess(persona.tab);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wide uppercase mb-4 shadow-sm">
          <Sparkles size={14} className="text-indigo-400 animate-pulse" />
          <span>Autonomous Deal Lifecycle & Governance Engine</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
          DealFlow360
        </h1>
        <p className="text-slate-400 text-sm md:text-base mt-2 max-w-md mx-auto">
          Autonomous deal lifecycle governance: Real-time risk intelligence, multi-warehouse splitting, and closed-loop negotiations.
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl relative z-10">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-white">Enterprise Access</h2>
          <p className="text-xs text-slate-400 mt-1">Sign in with your authorized corporate Google Workspace account</p>
        </div>

        {/* Primary Google Auth Button */}
        <button
          onClick={() => setShowGoogleModal(true)}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-xl shadow-lg hover:shadow-indigo-500/10 transition-all duration-200 active:scale-[0.99] border border-slate-200"
        >
          {/* Official Google G Logo SVG */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Sign in with Google Workspace</span>
        </button>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <span className="relative px-3 bg-slate-900/90 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Or Choose 1-Click Role Persona (Section 45)
          </span>
        </div>

        {/* 1-Click Persona Access List */}
        <div className="space-y-2">
          {GOOGLE_PERSONAS.map((persona) => {
            const isSelected = signingInRole === persona.role;
            return (
              <button
                key={persona.role}
                onClick={() => handleSelectAccount(persona)}
                disabled={isLoading}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 hover:border-indigo-500/40 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={persona.avatar}
                    alt={persona.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-600"
                  />
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                      <span>{persona.name}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-700/60 text-slate-300">
                        {persona.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                      {persona.email}
                    </div>
                  </div>
                </div>
                <div className="text-slate-500 group-hover:text-indigo-400 transition-colors pr-1">
                  {isSelected ? (
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800/60 text-center">
          <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <Shield size={12} className="text-emerald-400" />
            <span>5-Role Strict RBAC Security & Audit Governance Active</span>
          </div>
        </div>
      </div>

      {/* Google Account Selector Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowGoogleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Google Modal Header */}
            <div className="flex items-center gap-3 mb-5">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <div>
                <h3 className="text-base font-bold text-white">Choose an account</h3>
                <p className="text-xs text-slate-400">to continue to DealFlow360 Enterprise</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-3 font-medium">
              Select one of the 5 authorized Google Enterprise profiles:
            </p>

            {/* Google Accounts List */}
            <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden mb-4">
              {GOOGLE_PERSONAS.map((persona) => (
                <button
                  key={persona.email}
                  onClick={() => handleSelectAccount(persona)}
                  className="w-full flex items-center gap-3.5 p-3.5 bg-slate-900/90 hover:bg-slate-800/70 transition-colors text-left"
                >
                  <img
                    src={persona.avatar}
                    alt={persona.name}
                    className="w-9 h-9 rounded-full object-cover border border-slate-700"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">{persona.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 font-bold">
                        {persona.badge}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate">{persona.googleEmail}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{persona.title}</div>
                  </div>
                  <ArrowRight size={16} className="text-slate-600 group-hover:text-white" />
                </button>
              ))}
            </div>

            <div className="text-center text-[11px] text-slate-500">
              To proceed with Google OAuth, DealFlow360 verifies your enterprise domain credentials.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
