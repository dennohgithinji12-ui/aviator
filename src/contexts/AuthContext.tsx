'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  phone: string;
  username?: string;
  demoBalance: number;
  realBalance: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password?: string) => Promise<void>;
  signup: (phone: string, username?: string, password?: string) => Promise<void>;
  logout: () => void;
  updateBalance: (realBalance: number, demoBalance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load token and user from localStorage on mount
    const savedToken = localStorage.getItem('shiftstack_auth_token');
    const savedUser = localStorage.getItem('shiftstack_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (phone: string, password?: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Login failed');
    }

    setToken(data.token);
    setUser(data.user);

    localStorage.setItem('shiftstack_auth_token', data.token);
    localStorage.setItem('shiftstack_user', JSON.stringify(data.user));
  };

  const signup = async (phone: string, username?: string, password?: string) => {
    const response = await fetch('/api/auth/phone-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, username, passwordHash: password })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Signup failed');
    }

    setToken(data.token);
    setUser(data.user);

    localStorage.setItem('shiftstack_auth_token', data.token);
    localStorage.setItem('shiftstack_user', JSON.stringify(data.user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('shiftstack_auth_token');
    localStorage.removeItem('shiftstack_user');
  };

  const updateBalance = (realBalance: number, demoBalance: number) => {
    if (user) {
      const updatedUser = { ...user, realBalance, demoBalance };
      setUser(updatedUser);
      localStorage.setItem('shiftstack_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        updateBalance
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
