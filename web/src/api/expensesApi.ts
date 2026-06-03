import { apiClient } from './apiClient';

export interface Expense {
  id: number;
  expenseDate: string | null;
  category: string | null;
  description: string | null;
  amount: number | null;
  currency: string | null;
  receiptImage: string | null;
  approvedBy: string | null;
  status: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  managerApprovalByUserId?: number | null;
  hrApprovalByUserId?: number | null;
  approvalTrail?: {
    action: 'SUBMITTED' | 'MANAGER_APPROVED' | 'HR_APPROVED' | 'REJECTED';
    at: string;
    byUserId: number;
    reason: string | null;
  }[] | null;
  employee?: {
    id: number;
    name: string;
    email?: string | null;
  } | null;
  submittedByUser?: {
    id: number;
    name: string;
    email: string;
    managerId?: number | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpensePayload {
  expenseDate?: string;
  category?: string;
  description?: string;
  amount?: number;
  currency?: string;
  receiptImage?: string;
  approvedBy?: string;
  status?: string;
}

export async function getExpenses(): Promise<Expense[]> {
  return apiClient<Expense[]>('/expenses');
}

export async function getExpense(id: number): Promise<Expense> {
  return apiClient<Expense>(`/expenses/${id}`);
}

export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  return apiClient<Expense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateExpense(id: number, payload: Partial<CreateExpensePayload>): Promise<Expense> {
  return apiClient<Expense>(`/expenses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteExpense(id: number): Promise<void> {
  await apiClient<void>(`/expenses/${id}`, { method: 'DELETE' });
}

export async function managerApproveExpense(id: number): Promise<Expense> {
  return apiClient<Expense>(`/expenses/${id}/manager-approve`, {
    method: 'PATCH',
  });
}

export async function hrApproveExpense(id: number): Promise<Expense> {
  return apiClient<Expense>(`/expenses/${id}/hr-approve`, {
    method: 'PATCH',
  });
}

export async function rejectExpense(id: number, reason?: string): Promise<Expense> {
  return apiClient<Expense>(`/expenses/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export async function getExpensesByCategory(): Promise<Record<string, Expense[]>> {
  return apiClient<Record<string, Expense[]>>('/expenses/by-category');
}
