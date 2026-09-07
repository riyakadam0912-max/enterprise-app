import { api, unwrap } from './client';

export type LedgerEntry = { id: number; date?: string | null; description?: string | null; debit: number; credit: number; account?: string | null; invoice?: string | null; expense?: string | null; balance: number; reference?: string | null };
export async function ledgerEntries(): Promise<LedgerEntry[]> { const payload = unwrap<unknown>((await api.get('/ledger-entries')).data); return Array.isArray(payload) ? payload as LedgerEntry[] : []; }
export type CreateLedgerEntryPayload = { date?: string; description?: string; debit?: number; credit?: number; account?: string; invoice?: string; expense?: string; balance?: number; reference?: string };
export async function createLedgerEntry(payload: CreateLedgerEntryPayload) { return unwrap<LedgerEntry>((await api.post('/ledger-entries', payload)).data); }
