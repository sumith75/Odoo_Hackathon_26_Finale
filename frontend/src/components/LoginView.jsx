import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Building2, User, ArrowLeft, Loader2, ShieldCheck, CheckCircle2, UserCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Field({ label, type = 'text', value, onChange, placeholder, required, helperText }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          type={isPassword ? (show ? 'text' : 'password') : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 pr-10 bg-white"
          required={required}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {helperText && <p className="text-[11px] text-slate-400 mt-1">{helperText}</p>}
    </div>
  );
}

function HeroPanel() {
  return (
    <div className="hidden lg:flex w-5/12 bg-green-800 flex-col justify-between p-12 text-white flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-green-800 font-black text-xl shadow-xs">
          D
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight">DealFlow360</span>
          <span className="block text-[11px] font-semibold text-emerald-200 tracking-wider uppercase">
            Deal & CPQ Platform
          </span>
        </div>
      </div>

      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-700/60 border border-green-600 text-xs font-semibold text-emerald-100 mb-4">
          <ShieldCheck size={14} className="text-emerald-300" /> Multi-Tenant B2B Architecture
        </div>
        <h1 className="text-3xl font-extrabold leading-snug mb-4">
          CPQ Studio, Dynamic Pricing<br />& Approval Governance
        </h1>
        <p className="text-emerald-100 text-xs leading-relaxed max-w-sm">
          Autonomous deal configuration, real-time discount ceilings, instant margin telemetry, and secure multi-role portal access.
        </p>

        <ul className="mt-8 space-y-3">
          {[
            'Dedicated Tenant Isolation by Organization',
            'CPQ Studio with Real-Time Risk Engine',
            'Direct Self-Signup for Customers & Buyers',
            'Direct Provisioning for Sales & Finance Team',
            'Multi-Level Approval Chain (Manager & Finance)',
            'Immutable Audit Trail for Security & Compliance',
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-2.5 text-xs text-emerald-50">
              <span className="w-4 h-4 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                ✓
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="text-emerald-300/80 text-[11px] flex items-center justify-between">
        <span>© 2026 DealFlow360 Enterprise Engine</span>
        <span>v2.5.0 Multi-Tenant</span>
      </div>
    </div>
  );
}

function LoginForm({ onSwitchToRegisterOrg, onSwitchToRegisterCustomer }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('sales@techworld.com');
  const [password, setPassword] = useState('Sales@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) setError(result.message);
  };

  const handleQuickFill = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Sign in to your account</h2>
        <p className="text-xs text-slate-500 mt-1">
          Access your multi-tenant DealFlow360 workspace
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="sales@techworld.com"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          required
        />

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Authenticating...' : 'Sign in to Workspace'}
        </button>
      </form>

      {/* Demo Credentials Quick Switcher */}
      <div className="mt-6 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        <p className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-green-700" />
          Seeded Organization Demo Accounts (TechWorld Solutions):
        </p>
        <div className="space-y-1.5 font-mono text-[11px]">
          <div
            onClick={() => handleQuickFill('sales@techworld.com', 'Sales@123')}
            className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded hover:border-green-600 cursor-pointer transition-colors"
          >
            <div>
              <span className="font-bold text-blue-700 font-sans mr-2">[SALES REP]</span>
              sales@techworld.com
            </div>
            <span className="text-slate-400">Sales@123</span>
          </div>

          <div
            onClick={() => handleQuickFill('customer@acme.com', 'Customer@123')}
            className="flex items-center justify-between p-1.5 bg-white border border-emerald-300 rounded hover:border-green-600 cursor-pointer transition-colors bg-emerald-50/30"
          >
            <div>
              <span className="font-bold text-emerald-800 font-sans mr-2">[CUSTOMER]</span>
              customer@acme.com
            </div>
            <span className="text-slate-400">Customer@123</span>
          </div>

          <div
            onClick={() => handleQuickFill('admin@techworld.com', 'Admin@123')}
            className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded hover:border-green-600 cursor-pointer transition-colors"
          >
            <div>
              <span className="font-bold text-purple-700 font-sans mr-2">[ADMIN]</span>
              admin@techworld.com
            </div>
            <span className="text-slate-400">Admin@123</span>
          </div>

          <div
            onClick={() => handleQuickFill('arjun@techworld.com', 'Arjun@123')}
            className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded hover:border-green-600 cursor-pointer transition-colors"
          >
            <div>
              <span className="font-bold text-amber-700 font-sans mr-2">[SALES MGR]</span>
              arjun@techworld.com
            </div>
            <span className="text-slate-400">Arjun@123</span>
          </div>

          <div
            onClick={() => handleQuickFill('priya@techworld.com', 'Priya@123')}
            className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded hover:border-green-600 cursor-pointer transition-colors"
          >
            <div>
              <span className="font-bold text-teal-700 font-sans mr-2">[FINANCE]</span>
              priya@techworld.com
            </div>
            <span className="text-slate-400">Priya@123</span>
          </div>
        </div>
      </div>

      {/* Registration Entry Points */}
      <div className="mt-6 pt-4 border-t border-slate-200 space-y-2.5">
        <div>
          <p className="text-xs text-slate-500 mb-1.5 font-medium">Are you a buyer or client?</p>
          <button
            type="button"
            onClick={onSwitchToRegisterCustomer}
            className="w-full py-2.5 bg-green-50 hover:bg-green-100 text-green-800 border border-green-300 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <UserCheck size={15} className="text-green-700" />
            Sign Up as Customer
          </button>
        </div>

        <div>
          <p className="text-xs text-slate-500 mb-1.5 font-medium">Want to set up a new company?</p>
          <button
            type="button"
            onClick={onSwitchToRegisterOrg}
            className="w-full py-2.5 bg-white border border-slate-300 hover:border-green-700 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Building2 size={15} className="text-green-700" />
            Register New Organization (Admin)
          </button>
        </div>
      </div>
    </div>
  );
}

function RegisterCustomerForm({ onBack }) {
  const { registerCustomer } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    const result = await registerCustomer(form);
    setLoading(false);
    if (!result.success) setError(result.message);
  };

  return (
    <div className="w-full max-w-md">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-5 transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} /> Back to sign in
      </button>

      <div className="mb-5">
        <div className="w-10 h-10 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center mb-2">
          <UserCheck size={20} className="text-green-700" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Create Customer Account</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Sign up to review quotations, accept commercial proposals, and track orders
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <Field
          label="Full Name"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          placeholder="e.g. Rachel Green"
          required
        />

        <Field
          label="Work / Business Email"
          type="email"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
          placeholder="rachel@acme.com"
          required
        />

        <Field
          label="Password"
          type="password"
          value={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
          placeholder="Min 6 characters"
          required
          helperText="Must be at least 6 characters long"
        />

        <Field
          label="Company / Business Name"
          value={form.companyName}
          onChange={(v) => setForm({ ...form, companyName: v })}
          placeholder="Acme Corporation"
          required
          helperText="Your organization name — appears on quotations and invoices"
        />

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Creating Account...' : 'Create Customer Account'}
        </button>
      </form>

      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <Sparkles size={11} className="inline text-amber-500 mr-1" />
          <strong>How it works:</strong> After signing up, your Sales Representative will create a quotation for you. 
          You'll see it in your Deal Room where you can review, negotiate, and confirm.
        </p>
      </div>

      <div className="mt-5 text-center text-xs text-slate-500">
        Already have a customer account?{' '}
        <button
          type="button"
          onClick={onBack}
          className="text-green-700 font-bold hover:underline cursor-pointer"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}

function RegisterOrgForm({ onBack }) {
  const { registerOrganization } = useAuth();
  const [form, setForm] = useState({
    organizationName: '',
    adminName: '',
    email: '',
    password: '',
    currency: 'INR',
    industry: 'Technology & Software',
    timezone: 'Asia/Kolkata',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await registerOrganization(form);
    setLoading(false);
    if (!result.success) setError(result.message);
  };

  return (
    <div className="w-full max-w-md">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-5 transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} /> Back to sign in
      </button>

      <div className="mb-5">
        <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center mb-2">
          <Building2 size={20} className="text-green-700" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Register New Organization</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Creates your dedicated tenant database boundary and Admin master account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <Field
          label="Organization / Company Name"
          value={form.organizationName}
          onChange={(v) => setForm({ ...form, organizationName: v })}
          placeholder="e.g. Apex Industrial Systems"
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Admin Full Name"
            value={form.adminName}
            onChange={(v) => setForm({ ...form, adminName: v })}
            placeholder="Sneha Reddy"
            required
          />
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Base Currency <span className="text-red-500">*</span>
            </label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AED">AED</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Industry Domain
          </label>
          <select
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600"
          >
            <option value="Technology & Software">Technology & Software</option>
            <option value="Hardware & Electronics">Hardware & Electronics</option>
            <option value="Manufacturing & Industrial">Manufacturing & Industrial</option>
            <option value="Financial Services">Financial Services</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <Field
          label="Admin Work Email"
          type="email"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
          placeholder="admin@apexsystems.com"
          required
        />

        <Field
          label="Admin Master Password"
          type="password"
          value={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
          placeholder="Min 6 characters"
          required
        />

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Creating Organization...' : 'Create Admin Account & Launch'}
        </button>
      </form>
    </div>
  );
}

export default function LoginView({ defaultView = 'login' }) {
  const navigate = useNavigate();
  const [view, setView] = useState(defaultView);

  useEffect(() => {
    if (defaultView) {
      setView(defaultView);
    }
  }, [defaultView]);

  const handleSwitchTab = (newView) => {
    setView(newView);
    if (newView === 'login') {
      navigate('/login');
    } else if (newView === 'register-customer') {
      navigate('/signup');
    } else if (newView === 'register-org') {
      navigate('/register-organization');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <HeroPanel />

      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12">
        <div className="lg:hidden flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-xs">
            D
          </div>
          <span className="text-base font-bold text-slate-900">DealFlow360</span>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="w-full max-w-md flex bg-slate-200/70 p-1 rounded-xl mb-6 border border-slate-200">
          <button
            type="button"
            onClick={() => handleSwitchTab('login')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              view === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('register-customer')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              view === 'register-customer'
                ? 'bg-green-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-green-700'
            }`}
          >
            <UserCheck size={13} />
            Customer Sign Up
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('register-org')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              view === 'register-org'
                ? 'bg-green-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-green-700'
            }`}
          >
            New Org (Admin)
          </button>
        </div>

        {view === 'login' && (
          <LoginForm
            onSwitchToRegisterOrg={() => handleSwitchTab('register-org')}
            onSwitchToRegisterCustomer={() => handleSwitchTab('register-customer')}
          />
        )}
        {view === 'register-customer' && (
          <RegisterCustomerForm onBack={() => handleSwitchTab('login')} />
        )}
        {view === 'register-org' && (
          <RegisterOrgForm onBack={() => handleSwitchTab('login')} />
        )}
      </div>
    </div>
  );
}
