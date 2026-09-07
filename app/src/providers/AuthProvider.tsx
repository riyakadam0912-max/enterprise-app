import { createContext, useContext, useEffect, useState } from 'react';
import { currentUser, login as loginRequest, logout as logoutRequest } from '@/src/api/auth';
import { contextStore, setSessionExpiredHandler, tokenStore } from '@/src/api/client';
import type { Session } from '@/src/types/auth';

type AuthContextValue = { session: Session | null; loading: boolean; login: (email: string, password: string) => Promise<Session>; logout: () => Promise<void>; };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setSessionExpiredHandler(() => { setSession(null); void contextStore.setOrg(null); void contextStore.setBU(null); });
    tokenStore.getAccess().then((token) => token ? currentUser().then(setSession).catch(async () => { await tokenStore.clear(); await contextStore.setOrg(null); await contextStore.setBU(null); }) : undefined).finally(() => setLoading(false));
    return () => setSessionExpiredHandler(null);
  }, []);
  const value = {
    session, loading,
    login: async (email: string, password: string) => { const next = await loginRequest(email, password); await contextStore.setOrg(next.organizationId); await contextStore.setBU(null); setSession(next); return next; },
    logout: async () => { await logoutRequest(); await contextStore.setOrg(null); await contextStore.setBU(null); setSession(null); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
