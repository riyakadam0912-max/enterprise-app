import { apiClient } from './apiClient';
import { axiosClient } from './axiosClient';
import type { QuoteStatus } from '@/utils/finance';

// ── Types ────────────────────────────────────────────────────────────────────

export interface QuoteItem {
  id:       number;
  quoteId:  number;
  name:     string;
  productId?: number | null;
  description?: string | null;
  unit?: string;
  type?: 'GOODS' | 'SERVICE';
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
  customer?: {
    id: number;
    customerName: string;
    email: string | null;
    phoneNumber: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  } | null;
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
    unit?: string;
    type?: 'GOODS' | 'SERVICE';
    quantity: number;
    price:    number;
    discountAmount?: number;
    taxRate?: number;
  }[];
}

export type UpdateQuotePayload = Partial<CreateQuotePayload>;

export interface PublicQuote {
  id: number;
  quoteNumber: string;
  name: string | null;
  quoteDate: string;
  validTill: string;
  customerAddress: string | null;
  total: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  adjustmentAmount: number;
  status: string;
  termsAndConditions: string | null;
  customer: { customerName: string; email: string | null; phoneNumber: string | null; address: string } | null;
  items: Array<{ name: string; description: string | null; quantity: number; price: number; discountAmount: number; taxRate: number | null }>;
  company: { name: string; logoUrl: string | null; currency: string };
  statusHistory: Array<{ status: string; source: string; comment: string | null; createdAt: string }>;
  linkExpiresAt: string;
}

// ── API functions ─────────────────────────────────────────────────────────────

export function getQuotes(): Promise<Quote[]> {
  return apiClient<Quote[]>('/quotes');
}

export function getQuote(id: number): Promise<Quote> {
  return apiClient<Quote>(`/quotes/${id}`);
}

export function createQuotePublicLink(id: number): Promise<{ publicQuoteUrl: string; expiresAt: string }> {
  return apiClient(`/quotes/${id}/public-link`, { method: 'POST' });
}

export function sendQuoteEmail(id: number, data: { recipient: string; subject?: string; message?: string }): Promise<{ success: boolean; messageId?: string; recipient: string }> {
  return apiClient(`/quotes/${id}/send`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getPublicQuote(token: string): Promise<PublicQuote> {
  return apiClient<PublicQuote>(`/public/quotes/${encodeURIComponent(token)}`);
}

export function decidePublicQuote(token: string, decision: 'accept' | 'reject', comment?: string): Promise<PublicQuote> {
  return apiClient<PublicQuote>(`/public/quotes/${encodeURIComponent(token)}/${decision}`, {
    method: 'POST',
    body: JSON.stringify({ comment: comment?.trim() || undefined }),
  });
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

export async function downloadQuotePdf(id: number): Promise<Blob> {
  const response = await axiosClient.get<Blob>(`/quotes/${id}/pdf`, {
    responseType: 'blob',
  });
  return response.data;
}
