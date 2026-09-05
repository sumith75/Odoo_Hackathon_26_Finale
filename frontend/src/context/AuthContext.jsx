import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const GOOGLE_PERSONAS = [
  {
    role: 'ADMIN',
    name: 'Admin',
    email: 'admin@dealflow360.com',
    googleEmail: 'admin@dealflow360.com',
    title: 'System & Governance Administrator',
    tab: 'admin',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    color: '#ec4899',
    badge: 'Admin'
  },
  {
    role: 'SALES_REP',
    name: 'Sales Rep',
    email: 'sales@dealflow360.com',
    googleEmail: 'sales@dealflow360.com',
    title: 'Sales Representative',
    tab: 'sales',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    color: '#6366f1',
    badge: 'Sales Rep'
  },
  {
    role: 'SALES_MANAGER',
    name: 'Sales Manager',
    email: 'manager@dealflow360.com',
    googleEmail: 'manager@dealflow360.com',
    title: 'Sales Manager & Approver',
    tab: 'manager',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    color: '#f59e0b',
    badge: 'Sales Manager'
  },
  {
    role: 'FINANCE_OPERATIONS',
    name: 'Finance / Operations',
    email: 'finance@dealflow360.com',
    googleEmail: 'finance@dealflow360.com',
    title: 'Finance & Operations User',
    tab: 'operations',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    color: '#10b981',
    badge: 'Finance / Ops'
  },
  {
    role: 'CUSTOMER',
    name: 'Customer',
    email: 'customer@acme.com',
    googleEmail: 'customer@acme.com',
    title: 'Acme Corporation',
    tab: 'customer',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    color: '#06b6d4',
    badge: 'Customer (Acme)'
  }
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('df360_token') || null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on initial mount
  useEffect(() => {
    const savedUser = localStorage.getItem('df360_user');
    const savedToken = localStorage.getItem('df360_token');

    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser);
        // Enrich with persona details if available
        const matched = GOOGLE_PERSONAS.find(p => p.role === parsed.role);
        setUser(matched ? { ...matched, ...parsed } : parsed);
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    }
    setIsLoading(false);
  }, []);

  const loginWithGoogle = async (personaOrEmail) => {
    setIsLoading(true);
    try {
      const persona = typeof personaOrEmail === 'object' 
        ? personaOrEmail 
        : GOOGLE_PERSONAS.find(p => p.email.toLowerCase() === personaOrEmail.toLowerCase()) || { email: personaOrEmail, role: 'CUSTOMER' };

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: persona.email || persona.googleEmail,
          name: persona.name,
          role: persona.role,
          avatar: persona.avatar,
          authProvider: 'google'
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        const fullUser = { ...persona, ...data.user };
        setUser(fullUser);
        setToken(data.token);
        localStorage.setItem('df360_user', JSON.stringify(fullUser));
        localStorage.setItem('df360_token', data.token);
        return fullUser;
      }
    } catch (err) {
      console.error('Google Auth Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithRole = async (role) => {
    const persona = GOOGLE_PERSONAS.find(p => p.role === role) || GOOGLE_PERSONAS[1];
    return loginWithGoogle(persona);
  };

  const switchRole = async (roleObj) => {
    return loginWithGoogle(roleObj);
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (e) {
      console.error('Logout sync error:', e);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('df360_user');
      localStorage.removeItem('df360_token');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: Boolean(user),
      isLoading,
      loginWithGoogle,
      loginWithRole,
      switchRole,
      logout,
      personas: GOOGLE_PERSONAS
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
