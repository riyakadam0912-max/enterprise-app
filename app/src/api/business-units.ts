import { api, unwrap } from './client';
import type { BusinessUnit } from '@/src/types/auth';
export type BusinessUnitContext = { units: BusinessUnit[]; canSelectAll: boolean; assignedUnitId: number | null };
export async function accessibleBusinessUnits() { return unwrap<BusinessUnitContext>((await api.get('/me/business-units')).data); }
export async function switchBusinessUnit(businessUnitId: number | null) { return unwrap<{ businessUnitId: number | null; allBusinessUnits: boolean }>((await api.post('/me/business-units/switch', { businessUnitId })).data); }
