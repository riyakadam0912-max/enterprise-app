import { createContext, useContext, useEffect, useState } from 'react';
import { contextStore } from '@/src/api/client';
import type { Session } from '@/src/types/auth';

type OrganizationContextValue = { organizationId: number | null; organizationName: string | null; selectOrganization: (id: number, name: string) => Promise<void>; clearOrganization: () => Promise<void>; };
const OrganizationContext = createContext<OrganizationContextValue | null>(null);
export function OrganizationProvider({ session, children }: { session: Session | null; children: React.ReactNode }) {
  const [organizationId, setId] = useState(session?.organizationId ?? null);
  const [organizationName, setName] = useState(session?.organizationName ?? null);
  useEffect(() => { setId(session?.organizationId ?? null); setName(session?.organizationName ?? null); }, [session?.organizationId, session?.organizationName]);
  const selectOrganization = async (id: number, name: string) => { await contextStore.setOrg(id); await contextStore.setBU(null); setId(id); setName(name); };
  const clearOrganization = async () => { await contextStore.setOrg(null); await contextStore.setBU(null); setId(null); setName(null); };
  return <OrganizationContext.Provider value={{ organizationId, organizationName, selectOrganization, clearOrganization }}>{children}</OrganizationContext.Provider>;
}
export function useOrganization() { const value = useContext(OrganizationContext); if (!value) throw new Error('useOrganization must be inside OrganizationProvider'); return value; }
