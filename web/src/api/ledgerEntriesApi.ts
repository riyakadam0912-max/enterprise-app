import { apiClient } from './apiClient';

export interface LedgerEntry {
  id: number;
  date: string | null;
  description: string | null;
  debit: number;
  credit: number;
  account: string | null;
  invoice: string | null;
  expense: string | null;
  balance: number;
  reference: string | null;
  userId: number;
  user?: { id: number; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateLedgerEntryPayload {
  date?: string;
  description?: string;
  debit?: number;
  credit?: number;
  account?: string;
  invoice?: string;
  expense?: string;
  balance?: number;
  reference?: string;
}

export function getLedgerEntries(): Promise<LedgerEntry[]> {
  return apiClient<LedgerEntry[]>('/ledger-entries');
}

export function getLedgerEntry(id: number): Promise<LedgerEntry> {
  return apiClient<LedgerEntry>(`/ledger-entries/${id}`);
}

export function createLedgerEntry(payload: CreateLedgerEntryPayload): Promise<LedgerEntry> {
  return apiClient<LedgerEntry>('/ledger-entries', {
    method: 'POST',
    body:   JSON.stringify(payload),
  });
}

export function updateLedgerEntry(id: number, payload: Partial<CreateLedgerEntryPayload>): Promise<LedgerEntry> {
  return apiClient<LedgerEntry>(`/ledger-entries/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(payload),
  });
}

export function deleteLedgerEntry(id: number): Promise<void> {
  return apiClient<void>(`/ledger-entries/${id}`, { method: 'DELETE' });
}
