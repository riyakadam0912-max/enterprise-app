import { apiClient } from './apiClient';
import type { InvoiceStatus } from '@/utils/finance';

export interface InvoicePaymentSummary {
  id: number;
  invoiceId: number;
  amount: number;
  paymentMethod: string;
  transactionId: string | null;
  paymentDate: string;
  status: string;
  createdAt: string;
}

export interface Invoice {
  id: number;
  invoiceNo: string;
  issueDate: string | null;
  dueDate: string | null;
  status: InvoiceStatus | string;
  customer: string | null;
  totalAmount: number;
  taxAmount: number;
  discount: number;
  paymentMethod: string | null;
  notes: string | null;
  userId: number;
  user?: { id: number; name: string; email: string };
  payments?: InvoicePaymentSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoicePayload {
  invoiceNo: string;
  issueDate?: string;
  dueDate?: string;
  status?: string;
  customer?: string;
  totalAmount?: number;
  taxAmount?: number;
  discount?: number;
  paymentMethod?: string;
  notes?: string;
}

export function getInvoices(): Promise<Invoice[]> {
  return apiClient<Invoice[]>('/invoices');
}

export function getInvoice(id: number): Promise<Invoice> {
  return apiClient<Invoice>(`/invoices/${id}`);
}

export function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  return apiClient<Invoice>('/invoices', {
    method: 'POST',
    body:   JSON.stringify(payload),
  });
}

export function updateInvoice(id: number, payload: Partial<CreateInvoicePayload>): Promise<Invoice> {
  return apiClient<Invoice>(`/invoices/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(payload),
  });
}

export function deleteInvoice(id: number): Promise<void> {
  return apiClient<void>(`/invoices/${id}`, { method: 'DELETE' });
}

export function getInvoicesByStatus(): Promise<Record<string, Invoice[]>> {
  return apiClient<Record<string, Invoice[]>>('/invoices/by-status');
}
