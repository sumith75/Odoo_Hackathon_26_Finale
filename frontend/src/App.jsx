import React, { useState, useEffect } from 'react';
import { 
  Settings, ShoppingCart, ShieldCheck, UserCheck, Warehouse, 
  Receipt, BarChart3, RotateCcw, Database, Sparkles, Play, LogIn, User
} from 'lucide-react';

import JudgeStepper from './components/JudgeStepper';
import AdminView from './components/AdminView';
import SalesRepCPQView from './components/SalesRepCPQView';
import ApprovalInboxView from './components/ApprovalInboxView';
import CustomerPortalView from './components/CustomerPortalView';
import WarehouseFulfillmentView from './components/WarehouseFulfillmentView';
import BillingCheckoutView from './components/BillingCheckoutView';
import DashboardView from './components/DashboardView';

export const DEMO_ROLES = [
  { role: 'ADMIN', name: 'Admin', email: 'admin@dealflow360.com', tab: 'admin', icon: Settings, label: 'Admin (Rules & Catalog)' },
  { role: 'SALES_REP', name: 'Sales Rep', email: 'sales@dealflow360.com', tab: 'sales', icon: ShoppingCart, label: 'Sales Rep (CPQ Studio)' },
  { role: 'SALES_MANAGER', name: 'Sales Manager', email: 'manager@dealflow360.com', tab: 'manager', icon: ShieldCheck, label: 'Manager (Approvals)' },
  { role: 'FINANCE_OPERATIONS', name: 'Finance / Ops', email: 'finance@dealflow360.com', tab: 'operations', icon: Warehouse, label: 'Finance / Ops (Warehouse & Billing)' },
  { role: 'CUSTOMER', name: 'Customer (Acme)', email: 'customer@acme.com', tab: 'customer', icon: UserCheck, label: 'Customer (Deal Room)' }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(DEMO_ROLES[1]); // Default to Sales Rep
  const [activeTab, setActiveTab] = useState('sales');
  const [currentJudgeStep, setCurrentJudgeStep] = useState(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [prefillExcessive, setPrefillExcessive] = useState(false);

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
    setCurrentUser(roleObj);
    setActiveTab(roleObj.tab);
    try {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleObj.role })
      });
    } catch (e) {
      console.error('Auth sync error:', e);
    }
  };

  // Map 15-step ID to active view tab & role
  const activateStep = (stepId) => {
    setCurrentJudgeStep(stepId);
    switch (stepId) {
      case 1:
        handleRoleSwitch(DEMO_ROLES[0]); // Admin
        setActiveTab('admin');
        break;
      case 2:
        handleRoleSwitch(DEMO_ROLES[0]); // Admin
        setActiveTab('admin');
        break;
      case 3:
        handleRoleSwitch(DEMO_ROLES[1]); // Sales Rep
        setActiveTab('sales');
        setPrefillExcessive(false);
        break;
      case 4:
        handleRoleSwitch(DEMO_ROLES[1]); // Sales Rep
        setActiveTab('sales');
        setPrefillExcessive(true);
        break;
      case 5:
        handleRoleSwitch(DEMO_ROLES[1]); // Sales Rep
        setActiveTab('sales');
        setPrefillExcessive(true);
        break;
      case 6:
        handleRoleSwitch(DEMO_ROLES[2]); // Manager
        setActiveTab('manager');
        break;
      case 7:
        handleRoleSwitch(DEMO_ROLES[1]); // Sales Rep
        setActiveTab('sales');
        break;
      case 8:
        handleRoleSwitch(DEMO_ROLES[3]); // Operations
        setActiveTab('operations');
        break;
      case 9:
        handleRoleSwitch(DEMO_ROLES[3]); // Finance
        setActiveTab('billing');
        break;
      case 10:
        handleRoleSwitch(DEMO_ROLES[4]); // Customer
        setActiveTab('customer');
        break;
      case 11:
        handleRoleSwitch(DEMO_ROLES[4]); // Customer
        setActiveTab('customer');
        break;
      case 12:
        handleRoleSwitch(DEMO_ROLES[2]); // Manager
        setActiveTab('manager');
        break;
      case 13:
        handleRoleSwitch(DEMO_ROLES[4]); // Customer
        setActiveTab('customer');
        break;
      case 14:
        handleRoleSwitch(DEMO_ROLES[3]); // Finance
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

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="brand-badge">
          <div className="brand-icon">
            <Sparkles size={22} style={{ color: 'white' }} />
          </div>
          <div>
            <h1 className="brand-title">DealFlow360</h1>
            <span className="brand-subtitle">Smart Self-Governing Deal Management Engine</span>
          </div>
        </div>

        {/* 5 User Roles Bar (Section 2 & 45) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0,0,0,0.3)', padding: '0.3rem 0.6rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginRight: '0.3rem' }}>
            Role:
          </span>
          {DEMO_ROLES.map(r => {
            const isCurrent = currentUser.role === r.role;
            const Icon = r.icon;
            return (
              <button
                key={r.role}
                onClick={() => handleRoleSwitch(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  border: isCurrent ? '1px solid #6366f1' : '1px solid transparent',
                  background: isCurrent ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                  color: isCurrent ? '#c7d2fe' : '#94a3b8',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={`Switch to ${r.label}`}
              >
                <Icon size={13} />
                {r.name}
              </button>
            );
          })}
        </div>

        {/* Database Status & Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#94a3b8' }}>
            <Database size={14} style={{ color: '#10b981' }} />
            <span>{dbStatus?.engine || 'PostgreSQL'}</span>
          </div>
          <button onClick={handleResetDemo} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
            <RotateCcw size={13} /> Reset Demo
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
      <div style={{ background: 'rgba(10, 15, 26, 0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0.4rem 1.5rem', display: 'flex', gap: '0.5rem' }}>
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

      {/* Main View Area */}
      <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
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
