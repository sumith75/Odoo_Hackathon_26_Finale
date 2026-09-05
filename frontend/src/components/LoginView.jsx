import React, { useState } from 'react';
import { Eye, EyeOff, Building2, User, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Shared Input component ────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, required }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <div className="relative">
        <input
          type={isPassword ? (show ? 'text' : 'password') : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="form-input pr-10"
          required={required}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Left green hero panel ─────────────────────────────────────────────────────
function HeroPanel() {
  return (
    <div className="hidden lg:flex w-5/12 bg-green-700 flex-col justify-between p-12 text-white flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-white rounded-md flex items-center justify-center text-green-700 font-black text-lg">D</div>
        <span className="text-xl font-bold">DealFlow360</span>
      </div>

      <div>
        <h1 className="text-4xl font-bold leading-snug mb-4">
          Smart Deal Management,<br />From Quote to Cash
        </h1>
        <p className="text-green-200 text-sm leading-relaxed max-w-sm">
          Automated risk detection, multi-level approvals, warehouse allocation, customer negotiations, and hybrid billing — all in one engine.
        </p>
        <ul className="mt-8 space-y-3">
          {[
            'Real-time discount risk scoring',
            'Multi-level manager approval chain',
            'Customer negotiation portal',
            'Hybrid one-time + subscription billing',
            'Warehouse stock split & fulfillment',
          ].map(f => (
            <li key={f} className="flex items-center gap-3 text-sm text-green-100">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-xs font-bold">✓</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-green-300 text-xs">© 2025 DealFlow360 · Enterprise Deal Lifecycle Engine</p>
    </div>
  );
}

// ── LOGIN FORM ────────────────────────────────────────────────────────────────
function LoginForm({ onSwitchToAdminSignup, onSwitchToCustomerSignup }) {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) setError(result.message);
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
        <p className="text-sm text-gray-500 mt-1">Access your role-based workspace</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@company.com" required />
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5">
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {/* Demo credentials hint */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-500">
        <p className="font-semibold text-gray-600 mb-1">Demo credentials:</p>
        <p>Admin: <code>admin@dealflow360.com</code> / <code>admin123</code></p>
        <p>Sales Rep: <code>sales@dealflow360.com</code> / <code>password123</code></p>
        <p>Manager: <code>manager@dealflow360.com</code> / <code>password123</code></p>
        <p>Finance: <code>finance@dealflow360.com</code> / <code>password123</code></p>
        <p>Customer: <code>customer@acme.com</code> / <code>password123</code></p>
      </div>

      <div className="mt-6 space-y-2">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-gray-50 text-xs text-gray-400 font-medium">New to DealFlow360?</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            onClick={onSwitchToCustomerSignup}
            className="btn btn-secondary text-xs flex flex-col items-center gap-1 py-3 h-auto"
          >
            <User size={16} className="text-blue-500" />
            <span>Sign up as Customer</span>
          </button>
          <button
            onClick={onSwitchToAdminSignup}
            className="btn btn-secondary text-xs flex flex-col items-center gap-1 py-3 h-auto"
          >
            <Building2 size={16} className="text-green-600" />
            <span>Register Organisation</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN SIGN-UP FORM ────────────────────────────────────────────────────────
const BUSINESS_TYPES = [
  'Technology', 'Manufacturing', 'Retail / E-commerce', 'Healthcare',
  'Financial Services', 'Logistics & Supply Chain', 'Education',
  'Real Estate', 'Consulting & Professional Services', 'Other',
];

function AdminSignupForm({ onBack }) {
  const { registerAdmin } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', orgName: '', businessType: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.businessType) { setError('Please select your business type.'); return; }
    setLoading(true);
    const result = await registerAdmin(form);
    setLoading(false);
    if (!result.success) setError(result.message);
  };

  return (
    <div className="w-full max-w-md">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to sign in
      </button>

      <div className="mb-6">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
          <Building2 size={20} className="text-green-700" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Register your organisation</h2>
        <p className="text-sm text-gray-500 mt-1">Create an Admin account and set up your workspace</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Your full name" value={form.name} onChange={set('name')} placeholder="Sarah Johnson" required />
        <Field label="Work email" type="email" value={form.email} onChange={set('email')} placeholder="sarah@company.com" required />

        <div>
          <label className="form-label">Organisation name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.orgName}
            onChange={e => set('orgName')(e.target.value)}
            placeholder="Acme Corporation"
            className="form-input"
            required
          />
        </div>

        <div>
          <label className="form-label">Business type <span className="text-red-500">*</span></label>
          <select
            value={form.businessType}
            onChange={e => set('businessType')(e.target.value)}
            className="form-select"
            required
          >
            <option value="">Select your industry...</option>
            {BUSINESS_TYPES.map(bt => (
              <option key={bt} value={bt}>{bt}</option>
            ))}
          </select>
        </div>

        <Field label="Password" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 characters" required />

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5">
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Creating account...' : 'Create Admin Account'}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-4">
        After signing up, you can add your Sales Managers, Sales Reps, and Finance team from the Admin panel.
      </p>
    </div>
  );
}

// ── CUSTOMER SIGN-UP FORM ─────────────────────────────────────────────────────
function CustomerSignupForm({ onBack }) {
  const { registerCustomer } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await registerCustomer(form);
    setLoading(false);
    if (!result.success) setError(result.message);
  };

  return (
    <div className="w-full max-w-md">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to sign in
      </button>

      <div className="mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
          <User size={20} className="text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Create a customer account</h2>
        <p className="text-sm text-gray-500 mt-1">Sign up to view quotes and negotiate deals</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name" value={form.name} onChange={set('name')} placeholder="James Wilson" required />
        <Field label="Email address" type="email" value={form.email} onChange={set('email')} placeholder="james@acme.com" required />
        <Field label="Company name" value={form.companyName} onChange={set('companyName')} placeholder="Acme Corporation" />
        <Field label="Password" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 characters" required />

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5">
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Creating account...' : 'Create Customer Account'}
        </button>
      </form>
    </div>
  );
}

// ── Main LoginView ────────────────────────────────────────────────────────────
export default function LoginView() {
  const [view, setView] = useState('login'); // 'login' | 'admin-signup' | 'customer-signup'

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <HeroPanel />

      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-green-600 rounded-md flex items-center justify-center text-white font-black">D</div>
          <span className="text-lg font-bold text-gray-900">DealFlow360</span>
        </div>

        {view === 'login' && (
          <LoginForm
            onSwitchToAdminSignup={() => setView('admin-signup')}
            onSwitchToCustomerSignup={() => setView('customer-signup')}
          />
        )}
        {view === 'admin-signup' && (
          <AdminSignupForm onBack={() => setView('login')} />
        )}
        {view === 'customer-signup' && (
          <CustomerSignupForm onBack={() => setView('login')} />
        )}
      </div>
    </div>
  );
}
