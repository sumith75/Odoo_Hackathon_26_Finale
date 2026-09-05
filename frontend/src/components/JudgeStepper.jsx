import React from 'react';
import { 
  Play, CheckCircle2, ArrowRight, ShieldCheck, 
  Sparkles, Warehouse, Receipt, Scale, CreditCard, BarChart3, UserCheck, Settings, ShoppingCart
} from 'lucide-react';

export const STEPS = [
  { id: 1, title: '1. Multi-Tenant Auth', role: 'admin', path: '/admin/organization', desc: 'Tenant isolation & RBAC governance in PostgreSQL' },
  { id: 2, title: '2. Admin Catalog & Rules', role: 'admin', path: '/admin/products', desc: 'Hardware, Services, Subscriptions & Discount Rules' },
  { id: 3, title: '3. CPQ Deal Studio', role: 'sales', path: '/sales/cpq', desc: 'Live pricing, margin & risk calculation from DB' },
  { id: 4, title: '4. Manager Approvals', role: 'manager', path: '/manager/approvals', desc: 'Review deal margins & audit compliance' },
  { id: 5, title: '5. Customer Deal Room', role: 'customer', path: '/customer', desc: 'Counter-offer negotiation & e-signing' },
  { id: 6, title: '6. Finance & Fulfillment', role: 'finance', path: '/finance/dashboard', desc: 'Automated warehouse dispatch & invoicing' }
];

export default function JudgeStepper({ currentStep, onSelectStep, onRunNextStep, isAutoPlaying, onToggleAutoPlay }) {
  return (
    <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-md">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider text-white">
            Live Database Mode
          </div>
          <span className="text-xs text-slate-400">
            Powered by Neon PostgreSQL & Redis:
          </span>
        </div>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={onToggleAutoPlay}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center gap-1"
          >
            <Play size={11} /> {isAutoPlaying ? 'Pause' : 'Tour'}
          </button>
          <button 
            type="button"
            onClick={onRunNextStep}
            className="px-3 py-1 text-xs font-semibold bg-green-700 hover:bg-green-600 text-white rounded flex items-center gap-1 shadow-xs"
          >
            Next <ArrowRight size={11} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {STEPS.map((step) => {
          const isActive = currentStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelectStep && onSelectStep(step)}
              className={`p-2 rounded-lg text-left text-xs transition-all border ${
                isActive
                  ? 'bg-green-950/80 border-green-600 text-white shadow-xs'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="font-bold text-[11px] truncate">{step.title}</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">{step.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
