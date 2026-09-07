import { api, unwrap } from './client';

export type Expense = {
	id: number;
	expenseDate?: string | null;
	category?: string | null;
	description?: string | null;
	amount?: number | string | null;
	currency?: string | null;
	status?: string | null;
	receiptImage?: string | null;
	employee?: { name?: string | null } | null;
};

export type CreateExpensePayload = {
	expenseDate?: string;
	category?: string;
	description?: string;
	amount: number;
	currency: string;
	receiptImage?: string;
};

export async function expenses() { return unwrap<Expense[]>((await api.get('/expenses')).data); }
export async function expense(id: number) { return unwrap<Expense>((await api.get(`/expenses/${id}`)).data); }
export async function createExpense(data: CreateExpensePayload) { return unwrap<Expense>((await api.post('/expenses', data)).data); }
export async function updateExpense(id: number, data: Partial<CreateExpensePayload>) { return unwrap<Expense>((await api.patch(`/expenses/${id}`, data)).data); }
export async function approveExpense(id: number, stage: 'manager' | 'hr') { return unwrap<Expense>((await api.patch(`/expenses/${id}/${stage}-approve`)).data); }
export async function rejectExpense(id: number, reason: string) { return unwrap<Expense>((await api.patch(`/expenses/${id}/reject`, { reason })).data); }
export async function removeExpense(id: number) { return unwrap<Expense>((await api.delete(`/expenses/${id}`)).data); }
