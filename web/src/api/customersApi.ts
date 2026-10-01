import { apiClient } from './apiClient';

export type CustomerType = 'BUSINESS' | 'INDIVIDUAL';

export interface Customer {
  id: number;
  customerName: string;
  customerType: CustomerType;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  webAddress: string | null;
  email: string | null;
  phoneNumber: string | null;
  status: string;
  _count?: { projects: number; clientProfiles: number };
}

export type CustomerInput = Omit<Customer, 'id' | 'status' | '_count' | 'webAddress'> & {
  webAddress?: string | null;
};

export type CustomerUpdateInput = Partial<Omit<CustomerInput, 'webAddress'>> & {
  webAddress?: string | null;
};

export function getCustomers(): Promise<Customer[]> {
  return apiClient<Customer[]>('/customers');
}

export function createCustomer(data: CustomerInput): Promise<Customer> {
  const payload = { ...data, webAddress: data.webAddress?.trim() || null };
  return apiClient<Customer>('/customers', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateCustomer(id: number, data: CustomerUpdateInput): Promise<Customer> {
  return apiClient<Customer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteCustomer(id: number): Promise<void> {
  return apiClient<void>(`/customers/${id}`, { method: 'DELETE' });
}
