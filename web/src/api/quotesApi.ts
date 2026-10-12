import { apiClient } from './apiClient';
import type { QuoteStatus } from '@/utils/finance';

// ── Types ────────────────────────────────────────────────────────────────────

export interface QuoteItem {
  id:       number;
  quoteId:  number;
  name:     string;
  productId?: number | null;
  description?: string | null;
  quantity: number;
  price:    number;
  discountAmount?: number;
  taxRate?: number | null;
}

export interface Quote {
  id:        number;
  dealId:    number | null;
  contactId: number | null;
  customerId?: number | null;
  name?: string | null;
  quoteDate?: string;
  customerAddress?: string | null;
  total:     number;
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  adjustmentAmount?: number;
  status:    QuoteStatus;
  validTill: string;
  notes:     string | null;
  termsAndConditions?: string | null;
  templateKey?: string;
  deal:      { id: number; title: string; value: number; stage: string } | null;
  contact:   { id: number; contactName: string; email: string | null; company: string | null } | null;
  items:     QuoteItem[];
  statusHistory?: Array<{ status: QuoteStatus | string; at: string; note?: string | null }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotePayload {
  dealId?:   number;
  contactId?: number;
  customerId?: number;
  name?: string;
  quoteDate?: string;
  customerAddress?: string;
  status?:   QuoteStatus;
  validTill: string;
  notes?:    string;
  termsAndConditions?: string;
  templateKey?: string;
  discountAmount?: number;
  taxAmount?: number;
  adjustmentAmount?: number;
  items: {
    name:     string;
    productId?: number;
    description?: string;
    quantity: number;
    price:    number;
    discountAmount?: number;
    taxRate?: number;
  }[];
}

export type UpdateQuotePayload = Partial<CreateQuotePayload>;

// ── API functions ─────────────────────────────────────────────────────────────

export function getQuotes(): Promise<Quote[]> {
  return apiClient<Quote[]>('/quotes');
}

export function getQuote(id: number): Promise<Quote> {
  return apiClient<Quote>(`/quotes/${id}`);
}

export function createQuote(data: CreateQuotePayload): Promise<Quote> {
  return apiClient<Quote>('/quotes', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function updateQuote(id: number, data: UpdateQuotePayload): Promise<Quote> {
  return apiClient<Quote>(`/quotes/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(data),
  });
}

export function deleteQuote(id: number): Promise<void> {
  return apiClient<void>(`/quotes/${id}`, { method: 'DELETE' });
}

export function convertQuoteToInvoice(id: number): Promise<{ id: number; invoiceNo: string }> {
  return apiClient<{ id: number; invoiceNo: string }>(`/quotes/${id}/convert-to-invoice`, {
    method: 'POST',
  });
}
