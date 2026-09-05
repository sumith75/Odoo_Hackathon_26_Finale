import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// Role mappings
export const ROLE_DEFAULT_VIEW = {
  ADMIN: 'admin',
  SALES_REP: 'sales_rep',
  SALES_MANAGER: 'sales_manager',
  FINANCE_OPERATIONS: 'finance_operations',
  CUSTOMER: 'customer',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('df360_token') || null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('df360_token');
      if (savedToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          const data = await res.json();
          if (res.ok && data.success && data.user) {
            setUser(data.user);
            setToken(savedToken);
          } else {
            localStorage.removeItem('df360_token');
            localStorage.removeItem('df360_user');
            setUser(null);
            setToken(null);
          }
        } catch {
          const savedUser = localStorage.getItem('df360_user');
          if (savedUser) {
            try {
              setUser(JSON.parse(savedUser));
            } catch {}
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
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

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('df360_user', JSON.stringify(data.user));
      localStorage.setItem('df360_token', data.token);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // ── Register Organization (Admin) ──────────────────────────────────────────
  const registerOrganization = async (formData) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Registration failed');
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('df360_user', JSON.stringify(data.user));
      localStorage.setItem('df360_token', data.token);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // ── Register Customer ──────────────────────────────────────────────────────
  const registerCustomer = async (formData) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || 'Customer registration failed');
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('df360_user', JSON.stringify(data.user));
      localStorage.setItem('df360_token', data.token);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // ── Refresh user profile ───────────────────────────────────────────────────
  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('df360_user', JSON.stringify(data.user));
      }
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
    setUser(null);
    setToken(null);
    localStorage.removeItem('df360_user');
    localStorage.removeItem('df360_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        login,
        registerOrganization,
        registerCustomer,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
