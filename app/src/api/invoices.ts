import { api, unwrap } from './client';

export type InvoicePayment = { id: number; amount: number; paymentMethod: string; transactionId?: string | null; paymentDate: string; status: string };
export type Invoice = { id: number; invoiceNo: string; issueDate?: string | null; dueDate?: string | null; status: string; customer?: string | null; clientEmail?: string | null; totalAmount: number; taxAmount: number; discount: number; paymentMethod?: string | null; notes?: string | null; payments?: InvoicePayment[] };

export async function invoices(): Promise<Invoice[]> { const payload = unwrap<unknown>((await api.get('/invoices')).data); return Array.isArray(payload) ? payload as Invoice[] : []; }
export async function invoice(id: number): Promise<Invoice> { return unwrap<Invoice>((await api.get(`/invoices/${id}`)).data); }
export type CreateInvoicePayload = { invoiceNo: string; issueDate?: string; dueDate?: string; status?: string; customer?: string; clientEmail?: string; totalAmount?: number; taxAmount?: number; discount?: number; paymentMethod?: string; notes?: string };
export async function createInvoice(payload: CreateInvoicePayload) { return unwrap<Invoice>((await api.post('/invoices', payload)).data); }
export async function updateInvoice(id: number, payload: Partial<CreateInvoicePayload>) { return unwrap<Invoice>((await api.patch(`/invoices/${id}`, payload)).data); }
export async function sendInvoice(id: number, payload: Record<string, unknown> = {}) { return unwrap<unknown>((await api.post(`/invoices/${id}/send`, payload)).data); }
export async function deleteInvoice(id: number) { return unwrap<unknown>((await api.delete(`/invoices/${id}`)).data); }
