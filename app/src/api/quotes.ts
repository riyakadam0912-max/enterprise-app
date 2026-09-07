import { api, unwrap } from "./client";

export type QuoteItem = {
  id?: number;
  name: string;
  quantity: number;
  price: number;
};
export type Quote = {
  id: number;
  dealId: number;
  contactId: number;
  total: number;
  status: string;
  validTill: string;
  notes?: string | null;
  deal?: { title?: string | null } | null;
  contact?: { contactName?: string | null; company?: string | null } | null;
  items: QuoteItem[];
};
export type CreateQuotePayload = {
  dealId: number;
  contactId: number;
  status?: string;
  validTill: string;
  notes?: string;
  items: Array<{ name: string; quantity: number; price: number }>;
};
export async function quotes(): Promise<Quote[]> {
  const payload = unwrap<unknown>((await api.get("/quotes")).data);
  return Array.isArray(payload) ? (payload as Quote[]) : [];
}
export async function quote(id: number): Promise<Quote> {
  return unwrap<Quote>((await api.get(`/quotes/${id}`)).data);
}
export async function createQuote(payload: CreateQuotePayload) {
  return unwrap<Quote>((await api.post("/quotes", payload)).data);
}
export async function convertQuoteToInvoice(
  id: number,
): Promise<{ id: number; invoiceNo: string }> {
  return unwrap<{ id: number; invoiceNo: string }>(
    (await api.post(`/quotes/${id}/convert-to-invoice`)).data,
  );
}
