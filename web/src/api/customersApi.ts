import { apiClient } from './apiClient';

export type CustomerType = 'BUSINESS' | 'INDIVIDUAL';

export interface Customer {
  id: number;
  customerName: string;
  shortName: string | null;
  customerType: CustomerType;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipCode: string | null;
  webAddress: string | null;
  email: string | null;
  phoneNumber: string | null;
  status: string;
  _count?: { projects: number; clientProfiles: number };
}

export type CustomerInput = Pick<Customer, 'customerName'> &
  Partial<Omit<Customer, 'id' | 'customerName' | 'status' | '_count'>>;

export type CustomerUpdateInput = Partial<CustomerInput>;

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
