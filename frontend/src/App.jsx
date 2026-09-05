import React, { useState, useEffect } from 'react';
import { 
  Settings, ShoppingCart, ShieldCheck, UserCheck, Warehouse, 
  Receipt, BarChart3, RotateCcw, Database, Sparkles, Play, LogOut, User, Check
} from 'lucide-react';

import { AuthProvider, useAuth, GOOGLE_PERSONAS } from './context/AuthContext';
import LoginView from './components/LoginView';
import JudgeStepper from './components/JudgeStepper';
import AdminView from './components/AdminView';
import SalesRepCPQView from './components/SalesRepCPQView';
import ApprovalInboxView from './components/ApprovalInboxView';
import CustomerPortalView from './components/CustomerPortalView';
import WarehouseFulfillmentView from './components/WarehouseFulfillmentView';
import BillingCheckoutView from './components/BillingCheckoutView';
import DashboardView from './components/DashboardView';

function DealFlowApp() {
  const { user, isAuthenticated, isLoading, logout, switchRole, personas } = useAuth();
  const [activeTab, setActiveTab] = useState('sales');
  const [currentJudgeStep, setCurrentJudgeStep] = useState(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [prefillExcessive, setPrefillExcessive] = useState(false);

  // Sync activeTab when user logs in or switches role
  useEffect(() => {
    if (user?.tab) {
      setActiveTab(user.tab);
    }
  }, [user?.role]);

  // Fetch health & db status on load
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => {
        if (d.database) setDbStatus(d.database);
      })
      .catch(err => console.error('Health check failed:', err));
  }, []);

  const handleRoleSwitch = async (roleObj) => {
    await switchRole(roleObj);
    setActiveTab(roleObj.tab);
  };

  // Map 15-step ID to active view tab & role
  const activateStep = (stepId) => {
    setCurrentJudgeStep(stepId);
    switch (stepId) {
      case 1:
      case 2:
        handleRoleSwitch(personas[0]); // Admin
        setActiveTab('admin');
        break;
      case 3:
        handleRoleSwitch(personas[1]); // Sales Rep
        setActiveTab('sales');
        setPrefillExcessive(false);
        break;
      case 4:
      case 5:
        handleRoleSwitch(personas[1]); // Sales Rep
        setActiveTab('sales');
        setPrefillExcessive(true);
        break;
      case 6:
        handleRoleSwitch(personas[2]); // Manager
        setActiveTab('manager');
        break;
      case 7:
        handleRoleSwitch(personas[1]); // Sales Rep
        setActiveTab('sales');
        break;
      case 8:
        handleRoleSwitch(personas[3]); // Operations
        setActiveTab('operations');
        break;
      case 9:
        handleRoleSwitch(personas[3]); // Finance
        setActiveTab('billing');
        break;
      case 10:
      case 11:
        handleRoleSwitch(personas[4]); // Customer
        setActiveTab('customer');
        break;
      case 12:
        handleRoleSwitch(personas[2]); // Manager
        setActiveTab('manager');
        break;
      case 13:
        handleRoleSwitch(personas[4]); // Customer
        setActiveTab('customer');
        break;
      case 14:
        handleRoleSwitch(personas[3]); // Finance
        setActiveTab('billing');
        break;
      case 15:
        setActiveTab('dashboard');
        break;
      default:
        setActiveTab('sales');
    }
  };

  const handleNextStep = () => {
    const next = currentJudgeStep < 15 ? currentJudgeStep + 1 : 1;
    activateStep(next);
  };

  // Auto-play timer
  useEffect(() => {
    let timer;
    if (isAutoPlaying) {
      timer = setInterval(() => {
        setCurrentJudgeStep(prev => {
          const next = prev < 15 ? prev + 1 : 1;
          activateStep(next);
          if (next === 15) {
            setIsAutoPlaying(false);
          }
          return next;
        });
      }, 4000);
    }
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const handleResetDemo = async () => {
    try {
      await fetch('/api/admin/reset', { method: 'POST' });
      setActiveQuoteId(null);
      setCurrentJudgeStep(1);
      setActiveTab('sales');
      window.location.reload();
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  // Loading Splash Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-semibold uppercase tracking-wider">Verifying Enterprise Session...</span>
      </div>
    );
  }

  // Unauthenticated Gate: Show Google Auth Login View
  if (!isAuthenticated || !user) {
    return <LoginView onLoginSuccess={(tab) => { if (tab) setActiveTab(tab); }} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Enterprise Header */}
      <header className="sticky top-0 z-50 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-xl px-4 md:px-6 py-2.5 flex items-center justify-between shadow-lg">
        {/* Brand Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent leading-none">
                DealFlow360
              </h1>
              <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 font-bold uppercase">
                Enterprise
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Smart Self-Governing Deal Management Engine
            </span>
          </div>
        </div>

        {/* 5 User Roles Bar (Section 2 & 45) */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2">
            Persona:
          </span>
          {personas.map(r => {
            const isCurrent = user.role === r.role;
            return (
              <button
                key={r.role}
                onClick={() => handleRoleSwitch(r)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isCurrent 
                    ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
                title={`Switch to ${r.name} (${r.title})`}
              >
                <img src={r.avatar} alt={r.name} className="w-4 h-4 rounded-full object-cover" />
                <span>{r.badge}</span>
              </button>
            );
          })}
        </div>

        {/* User Profile & Actions */}
        <div className="flex items-center gap-3">
          {/* Current Authenticated User Chip */}
          <div className="flex items-center gap-2.5 bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <img 
              src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} 
              alt={user.name} 
              className="w-6 h-6 rounded-full object-cover border border-indigo-400/50"
            />
            <div className="text-left hidden md:block">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 leading-none">
                <span>{user.name.split(' ')[0]}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold uppercase">
                  {user.badge || user.role}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 leading-none">{user.email}</span>
            </div>
          </div>

          {/* Database indicator */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/40 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
            <Database size={13} className="text-emerald-400" />
            <span className="font-mono text-[11px]">{dbStatus?.engine || 'PostgreSQL'}</span>
          </div>

          {/* Reset Demo Button */}
          <button 
            onClick={handleResetDemo}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 rounded-lg border border-slate-700/50 transition-colors"
            title="Reset Scenario Demo Data"
          >
            <RotateCcw size={14} />
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-xl transition-colors shadow-sm"
            title="Sign out of DealFlow360"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* 🎯 15-Step Judge Stepper Bar */}
      <JudgeStepper 
        currentStep={currentJudgeStep}
        onSelectStep={activateStep}
        onRunNextStep={handleNextStep}
        isAutoPlaying={isAutoPlaying}
        onToggleAutoPlay={() => setIsAutoPlaying(!isAutoPlaying)}
      />

      {/* Navigation Sub-Tabs */}
      <div className="bg-slate-900/60 border-b border-slate-800/60 px-4 md:px-6 py-2 overflow-x-auto flex items-center gap-2">
        <button 
          onClick={() => { setActiveTab('admin'); setCurrentJudgeStep(1); }}
          className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
        >
          <Settings size={15} /> Admin Configuration
        </button>
        <button 
          onClick={() => { setActiveTab('sales'); setCurrentJudgeStep(3); }}
          className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
        >
          <ShoppingCart size={15} /> Sales CPQ Studio
        </button>
        <button 
          onClick={() => { setActiveTab('manager'); setCurrentJudgeStep(6); }}
          className={`tab-btn ${activeTab === 'manager' ? 'active' : ''}`}
        >
          <ShieldCheck size={15} /> Manager Approval Queue
        </button>
        <button 
          onClick={() => { setActiveTab('operations'); setCurrentJudgeStep(8); }}
          className={`tab-btn ${activeTab === 'operations' ? 'active' : ''}`}
        >
          <Warehouse size={15} /> Warehouse & Split Stock
        </button>
        <button 
          onClick={() => { setActiveTab('customer'); setCurrentJudgeStep(10); }}
          className={`tab-btn ${activeTab === 'customer' ? 'active' : ''}`}
        >
          <UserCheck size={15} /> Customer Deal Room
        </button>
        <button 
          onClick={() => { setActiveTab('billing'); setCurrentJudgeStep(9); }}
          className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
        >
          <Receipt size={15} /> Hybrid Billing & Invoicing
        </button>
        <button 
          onClick={() => { setActiveTab('dashboard'); setCurrentJudgeStep(15); }}
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          <BarChart3 size={15} /> Deal Health Dashboard
        </button>
      </div>

      {/* Main View Workspace Area */}
      <main className="flex-1 p-4 md:p-6 max-w-[1440px] mx-auto w-full">
        {activeTab === 'admin' && (
          <AdminView onRulesUpdated={() => activateStep(3)} />
        )}

        {activeTab === 'sales' && (
          <SalesRepCPQView 
            prefillExcessiveDiscount={prefillExcessive}
            onQuoteCreated={(quote) => {
              setActiveQuoteId(quote.id);
              if (quote.status === 'PENDING_APPROVAL' || quote.approval_status === 'PENDING_APPROVAL' || quote.approval_status === 'PENDING_MANAGER') {
                activateStep(6); // Route to manager
              } else {
                activateStep(8); // Direct to warehouse
              }
            }}
          />
        )}

        {activeTab === 'manager' && (
          <ApprovalInboxView 
            onApproved={(quote) => {
              setActiveQuoteId(quote.id);
              if (currentJudgeStep >= 10) {
                activateStep(13); // Customer confirms
              } else {
                activateStep(7); // Upsell offer
              }
            }}
          />
        )}

        {activeTab === 'operations' && (
          <WarehouseFulfillmentView quoteId={activeQuoteId} />
        )}

        {activeTab === 'customer' && (
          <CustomerPortalView 
            quoteId={activeQuoteId}
            onCounterOfferSubmitted={() => activateStep(11)}
            onQuoteConfirmed={() => activateStep(14)}
          />
        )}

        {activeTab === 'billing' && (
          <BillingCheckoutView 
            quoteId={activeQuoteId}
            onPaymentCompleted={() => activateStep(15)}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView />
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
