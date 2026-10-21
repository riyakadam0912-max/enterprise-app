import { apiClient } from "./apiClient";
import { axiosClient } from "./axiosClient";
import type { InvoiceStatus } from "@/utils/finance";

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
  name?: string | null;
  issueDate: string | null;
  dueDate: string | null;
  status: InvoiceStatus | string;
  customer: string | null;
  customerId?: number | null;
  customerAddress?: string | null;
  customerRecord?: {
    id: number;
    customerName: string;
    email: string | null;
    phoneNumber: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    zipCode: string | null;
  } | null;
  clientEmail: string | null;
  totalAmount: number;
  subtotal?: number;
  taxAmount: number;
  discount: number;
  discountType?: "AMOUNT" | "PERCENTAGE";
  discountRate?: number;
  adjustmentAmount?: number;
  adjustmentType?: "AMOUNT" | "PERCENTAGE";
  adjustmentRate?: number;
  tdsEnabled?: boolean;
  tdsRate?: number;
  tdsAmount?: number;
  tcsEnabled?: boolean;
  tcsRate?: number;
  tcsAmount?: number;
  paymentMethod: string | null;
  notes: string | null;
  termsAndConditions?: string | null;
  templateKey?: string;
  items?: InvoiceItem[];
  userId: number;
  user?: { id: number; name: string; email: string };
  payments?: InvoicePaymentSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  name: string;
  productId?: number | null;
  description?: string | null;
  unit: string;
  type: "GOODS" | "SERVICE" | string;
  quantity: number;
  price: number;
  discountAmount: number;
  taxRate?: number | null;
}

export interface InvoiceItemPayload {
  name: string;
  productId?: number;
  description?: string;
  unit?: string;
  type?: "GOODS" | "SERVICE";
  quantity: number;
  price: number;
  discountAmount?: number;
  taxRate?: number;
}

export interface CreateInvoicePayload {
  invoiceNo: string;
  name?: string;
  customerId?: number;
  customerAddress?: string;
  issueDate?: string;
  dueDate?: string;
  status?: string;
  customer?: string;
  clientEmail?: string;
  totalAmount?: number;
  taxAmount?: number;
  discount?: number;
  paymentMethod?: string;
  notes?: string;
  termsAndConditions?: string;
  templateKey?: string;
  discountAmount?: number;
  discountType?: "AMOUNT" | "PERCENTAGE";
  discountRate?: number;
  adjustmentAmount?: number;
  adjustmentType?: "AMOUNT" | "PERCENTAGE";
  adjustmentRate?: number;
  tdsEnabled?: boolean;
  tdsRate?: number;
  tcsEnabled?: boolean;
  tcsRate?: number;
  items?: InvoiceItemPayload[];
}

export function getInvoices(): Promise<Invoice[]> {
  return apiClient<Invoice[]>("/invoices");
}

export function getInvoice(id: number): Promise<Invoice> {
  return apiClient<Invoice>(`/invoices/${id}`);
}

export function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  return apiClient<Invoice>("/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateInvoice(
  id: number,
  payload: Partial<CreateInvoicePayload>,
): Promise<Invoice> {
  return apiClient<Invoice>(`/invoices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteInvoice(id: number): Promise<void> {
  return apiClient<void>(`/invoices/${id}`, { method: "DELETE" });
}

export function getInvoicesByStatus(): Promise<Record<string, Invoice[]>> {
  return apiClient<Record<string, Invoice[]>>("/invoices/by-status");
}

export interface SendInvoiceDto {
  to?: string;
  cc?: string[];
  bcc?: string[];
  subject?: string;
  senderEmail?: string;
  message?: string;
  attachmentTypes?: string[];
  paymentInstructions?: string;
  terms?: string;
  notes?: string;
  companyName?: string;
}

export function sendInvoice(
  id: number,
  payload: SendInvoiceDto,
): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(
    `/invoices/${id}/send`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function downloadInvoicePdf(id: number): Promise<Blob> {
  const response = await axiosClient.get<Blob>(`/invoices/${id}/pdf`, {
    responseType: "blob",
  });
  return response.data;
}
