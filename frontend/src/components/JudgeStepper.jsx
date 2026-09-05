import React from 'react';
import { 
  Play, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, 
  Sparkles, Warehouse, Receipt, Scale, CreditCard, BarChart3, UserCheck, Settings, ShoppingCart
} from 'lucide-react';

export const STEPS = [
  { id: 1, title: '1. Google Login', role: 'admin', desc: 'Google Workspace Sign-In & 5 Roles' },
  { id: 2, title: '2. Admin Config', role: 'admin', desc: 'Hardware 15%, Service 10%, Sub 5%' },
  { id: 3, title: '3. Create Quote', role: 'sales', desc: 'Acme: 10 Laptops, 1 Service, 10 Support' },
  { id: 4, title: '4. Apply 18% Disc', role: 'sales', desc: 'Service 18% exceeds 10% policy' },
  { id: 5, title: '5. Auto-Detect Risk', role: 'sales', desc: 'System flags HIGH RISK (82) & locks' },
  { id: 6, title: '6. Manager Approve', role: 'manager', desc: 'Manager reviews excess 8% & approves' },
  { id: 7, title: '7. Smart Upsell', role: 'sales', desc: 'System recommends add-on opportunities' },
  { id: 8, title: '8. Split Stock', role: 'warehouse', desc: 'Auto-allocates: Bangalore 8, Hyderabad 2' },
  { id: 9, title: '9. Customer Portal', role: 'customer', desc: 'Acme customer reviews official quote' },
  { id: 10, title: '10. Negotiate 20%', role: 'customer', desc: 'Customer counter-offers 20% discount' },
  { id: 11, title: '11. Re-Check Risk', role: 'customer', desc: '20% > 15% limit -> Re-locks for approval' },
  { id: 12, title: '12. Manager Concession', role: 'manager', desc: 'Manager approves counter-offer' },
  { id: 13, title: '13. Confirm Quote', role: 'customer', desc: 'Customer confirms (CUSTOMER_CONFIRMED)' },
  { id: 14, title: '14. Hybrid Invoice', role: 'billing', desc: 'Capex ₹6,56,400 + MRR ₹28,500/mo' },
  { id: 15, title: '15. Settle & Health', role: 'dashboard', desc: 'Payment PAID & Deal Health: HEALTHY' }
];

export default function JudgeStepper({ currentStep, onSelectStep, onRunNextStep, isAutoPlaying, onToggleAutoPlay }) {
  return (
    <div className="judge-stepper-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)', 
            padding: '2px 8px', 
            borderRadius: '4px', 
            fontSize: '0.7rem', 
            fontWeight: '800', 
            color: 'white' 
          }}>
            🎯 JUDGE DEMO MODE
          </div>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Click any step below or run the automatic walkthrough:
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={onToggleAutoPlay}
            className={`btn ${isAutoPlaying ? 'btn-danger' : 'btn-outline'}`}
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
          >
            <Play size={12} fill={isAutoPlaying ? 'currentColor' : 'none'} />
            {isAutoPlaying ? 'Pause Walkthrough' : 'Run Auto Walkthrough'}
          </button>
          <button 
            onClick={onRunNextStep}
            className="btn btn-primary"
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
          >
            Next Step <ArrowRight size={12} />
          </button>
        </div>
      </div>

      <div className="judge-stepper-wrapper">
        {STEPS.map((step) => {
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;

          return (
            <button
              key={step.id}
              onClick={() => onSelectStep(step.id)}
              className={`judge-step-btn ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}`}
              title={step.desc}
            >
              {isDone ? (
                <CheckCircle2 size={13} style={{ color: '#10b981' }} />
              ) : isActive ? (
                <span style={{ 
                  display: 'inline-block', 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: '#6366f1',
                  boxShadow: '0 0 8px #6366f1'
                }} />
              ) : (
                <span style={{ opacity: 0.5 }}>{step.id}.</span>
              )}
              <span>{step.title.split('. ')[1]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
