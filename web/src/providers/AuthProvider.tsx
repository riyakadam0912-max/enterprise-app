'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearAuthSession, setAuthSession, useAuthSession } from '@/stores/auth-store';
import { getCurrentUser, loginUser, logoutUser } from '@/api/authApi';
import type { AuthSession, AuthUser } from '@/stores/auth-store';

export type AuthStatus = {
  session: AuthSession;
  authenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthStatus | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useAuthSession();
  const [loading, setLoading] = useState(true);

  const authenticated = session.user !== null;

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      try {
        const current = await getCurrentUser();
        setAuthSession({
          role: current.role,
          user: current.user,
          employeeId: current.employeeId,
        });
      } catch {
        clearAuthSession();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginUser(email, password);
    setAuthSession({
      role: data.role,
      user: data.user,
      employeeId: data.employeeId,
    });
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    clearAuthSession();
  }, []);

  const value = useMemo(
    () => ({
      session,
      authenticated,
      loading,
      login,
      logout,
    }),
    [session, authenticated, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
