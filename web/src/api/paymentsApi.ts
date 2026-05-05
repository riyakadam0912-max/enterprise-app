import { apiClient } from './apiClient';
import type { Invoice } from './invoicesApi';
import type { PaymentStatus } from '@/utils/finance';

export interface Payment {
  id:            number;
  invoiceId:     number;
  amount:        number;
  paymentMethod: string;
  transactionId: string | null;
  paymentDate:   string;
  status:        PaymentStatus | string;
  createdAt:     string;
  invoice:       Invoice;
  gatewayProvider?: string | null;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  gatewayReference?: string | null;
  gatewayPayload?: unknown;
}

export interface InvoicePaymentSummary {
  payments:        Payment[];
  totalAmount:     number;
  paidAmount:      number;
  remainingAmount: number;
}

export interface CreatePaymentPayload {
  invoiceId:      number;
  amount:         number;
  paymentMethod:  string;
  transactionId?: string;
  paymentDate:    string;
  status:         string;
}

export function getPayments(): Promise<Payment[]>                              { return apiClient<Payment[]>('/payments'); }
export function createPayment(data: CreatePaymentPayload): Promise<Payment>    { return apiClient<Payment>('/payments', { method: 'POST', body: JSON.stringify(data) }); }
export function getInvoicePayments(invoiceId: number): Promise<InvoicePaymentSummary> { return apiClient<InvoicePaymentSummary>(`/payments/invoice/${invoiceId}`); }
