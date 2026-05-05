import { apiClient } from './apiClient';

export interface Contact {
  id: number;
  contactName: string;
  email: string | null;
  phoneNumber: string | null;
  company: string | null;
  jobTitle: string | null;
  leadSource: string | null;
  address: string | null;
  website: string | null;
  linkedin: string | null;
  contactStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getContacts(): Promise<Contact[]> {
  return apiClient<Contact[]>('/contacts');
}

export async function getContact(id: number): Promise<Contact> {
  return apiClient<Contact>(`/contacts/${id}`);
}

export async function createContact(data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
  return apiClient<Contact>('/contacts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateContact(id: number, data: Partial<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Contact> {
  return apiClient<Contact>(`/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteContact(id: number): Promise<void> {
  await apiClient<void>(`/contacts/${id}`, { method: 'DELETE' });
}

export async function getContactsByStatus(): Promise<Record<string, Contact[]>> {
  return apiClient<Record<string, Contact[]>>('/contacts/by-status');
}
