import { createContext, useContext, useEffect, useState } from 'react';
import { accessibleBusinessUnits, switchBusinessUnit } from '@/src/api/business-units';
import { contextStore } from '@/src/api/client';
import type { BusinessUnit } from '@/src/types/auth';

type BUValue = { units: BusinessUnit[]; activeId: number | null; canSelectAll: boolean; loading: boolean; select: (id: number | null) => Promise<void>; };
const BUContext = createContext<BUValue | null>(null);
export function BusinessUnitProvider({ organizationId, children }: { organizationId: number | null; children: React.ReactNode }) {
  const [units, setUnits] = useState<BusinessUnit[]>([]); const [activeId, setActiveId] = useState<number | null>(null); const [canSelectAll, setCanSelectAll] = useState(false); const [loading, setLoading] = useState(false);
  useEffect(() => { if (organizationId == null) { setUnits([]); setActiveId(null); return; } setLoading(true); accessibleBusinessUnits().then((result) => { setUnits(result.units); setCanSelectAll(result.canSelectAll); setActiveId(result.assignedUnitId); }).finally(() => setLoading(false)); }, [organizationId]);
  const select = async (id: number | null) => { const result = await switchBusinessUnit(id); await contextStore.setBU(result.businessUnitId); setActiveId(result.businessUnitId); };
  return <BUContext.Provider value={{ units, activeId, canSelectAll, loading, select }}>{children}</BUContext.Provider>;
}
export function useBusinessUnit() { const value = useContext(BUContext); if (!value) throw new Error('useBusinessUnit must be inside BusinessUnitProvider'); return value; }
