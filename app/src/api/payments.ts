import { api, unwrap } from './client';

export type Payment = { id: number; invoiceId: number; amount: number; paymentMethod: string; transactionId?: string | null; paymentDate: string; status: string; invoice?: { invoiceNo?: string | null; customer?: string | null } | null };
export async function payments(): Promise<Payment[]> { const payload = unwrap<unknown>((await api.get('/payments')).data); return Array.isArray(payload) ? payload as Payment[] : []; }
export async function paymentsByInvoice(invoiceId: number): Promise<Payment[]> { const payload = unwrap<unknown>((await api.get(`/payments/invoice/${invoiceId}`)).data); return Array.isArray(payload) ? payload as Payment[] : []; }
export type CreatePaymentPayload = { invoiceId: number; amount: number; paymentMethod: string; transactionId?: string; paymentDate: string; status: string };
export async function createPayment(payload: CreatePaymentPayload) { return unwrap<Payment>((await api.post('/payments', payload)).data); }
export async function updatePayment(id: number, payload: Partial<CreatePaymentPayload>) { return unwrap<Payment>((await api.patch(`/payments/${id}`, payload)).data); }
