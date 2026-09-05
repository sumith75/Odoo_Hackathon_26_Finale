import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// Role → default tab mapping
const ROLE_TAB = {
  ADMIN:           'admin',
  SALES_REP:       'sales',
  SALES_MANAGER:   'manager',
  FINANCE_MANAGER: 'billing',
  CUSTOMER:        'customer',
};

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem('df360_token') || null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const savedUser  = localStorage.getItem('df360_user');
    const savedToken = localStorage.getItem('df360_token');

    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser({ ...parsed, tab: ROLE_TAB[parsed.role] || 'sales' });
        setToken(savedToken);
      } catch {
        localStorage.removeItem('df360_user');
        localStorage.removeItem('df360_token');
      }
    }
    setIsLoading(false);
  }, []);

  // ── Login (all roles) ──────────────────────────────────────────────────────
  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed');
      }

      const fullUser = { ...data.user, tab: ROLE_TAB[data.user.role] || 'sales' };
      setUser(fullUser);
      setToken(data.token);
      localStorage.setItem('df360_user', JSON.stringify(fullUser));
      localStorage.setItem('df360_token', data.token);
      return { success: true, user: fullUser };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // ── Register Admin ─────────────────────────────────────────────────────────
  const registerAdmin = async ({ name, email, password, orgName, businessType }) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, orgName, businessType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Registration failed');

      const fullUser = { ...data.user, tab: 'admin' };
      setUser(fullUser);
      setToken(data.token);
      localStorage.setItem('df360_user', JSON.stringify(fullUser));
      localStorage.setItem('df360_token', data.token);
      return { success: true, user: fullUser };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // ── Register Customer ──────────────────────────────────────────────────────
  const registerCustomer = async ({ name, email, password, companyName }) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, companyName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Registration failed');

      const fullUser = { ...data.user, tab: 'customer' };
      setUser(fullUser);
      setToken(data.token);
      localStorage.setItem('df360_user', JSON.stringify(fullUser));
      localStorage.setItem('df360_token', data.token);
      return { success: true, user: fullUser };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // ── Add Team Member (Admin only) ───────────────────────────────────────────
  const addTeamMember = async ({ name, email, role, password }) => {
    try {
      const res = await fetch('/api/auth/team/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, role, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to add member');
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    setUser(null);
    setToken(null);
    localStorage.removeItem('df360_user');
    localStorage.removeItem('df360_token');
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      registerAdmin,
      registerCustomer,
      addTeamMember,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
