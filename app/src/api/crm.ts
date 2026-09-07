import { api, unwrap } from './client';

export type Deal = { id: number; title: string; value: number; stage: string; probability?: number | null; closeDate?: string | null; contact?: string | null; owner?: string | null; pipeline?: string | null; lead?: { name?: string | null; company?: string | null } | null; linkedContact?: { contactName?: string | null; company?: string | null } | null };
export type DealPayload = { title: string; value: number; stage?: string; probability?: number; closeDate?: string; actualCloseDate?: string; contact?: string; owner?: string; pipeline?: string; leadId?: number; contactId?: number; employeeId?: number };
export type Contact = { id: number; contactName: string; email?: string | null; phoneNumber?: string | null; company?: string | null; jobTitle?: string | null; leadSource?: string | null; address?: string | null; website?: string | null; linkedin?: string | null; contactStatus?: string | null };
export type ContactPayload = Omit<Contact, 'id'>;
export async function deals(): Promise<Deal[]> { const payload = unwrap<unknown>((await api.get('/deals')).data); return Array.isArray(payload) ? payload as Deal[] : []; }
export async function deal(id: number): Promise<Deal> { return unwrap<Deal>((await api.get(`/deals/${id}`)).data); }
export async function createDeal(payload: DealPayload): Promise<Deal> { return unwrap<Deal>((await api.post('/deals', payload)).data); }
export async function updateDeal(id: number, payload: Partial<DealPayload>): Promise<Deal> { return unwrap<Deal>((await api.patch(`/deals/${id}`, payload)).data); }
export async function markDealWon(id: number): Promise<Deal> { return unwrap<Deal>((await api.post(`/deals/${id}/won`)).data); }
export async function removeDeal(id: number) { return unwrap<unknown>((await api.delete(`/deals/${id}`)).data); }
export async function contacts(): Promise<Contact[]> { const payload = unwrap<unknown>((await api.get('/contacts')).data); return Array.isArray(payload) ? payload as Contact[] : []; }
export async function contact(id: number): Promise<Contact> { return unwrap<Contact>((await api.get(`/contacts/${id}`)).data); }
export async function createContact(payload: Partial<ContactPayload> & Pick<ContactPayload, 'contactName'>): Promise<Contact> { return unwrap<Contact>((await api.post('/contacts', payload)).data); }
export async function updateContact(id: number, payload: Partial<ContactPayload>): Promise<Contact> { return unwrap<Contact>((await api.patch(`/contacts/${id}`, payload)).data); }
export async function removeContact(id: number) { return unwrap<unknown>((await api.delete(`/contacts/${id}`)).data); }
