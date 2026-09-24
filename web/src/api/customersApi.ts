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

export type CustomerInput = Omit<Customer, 'id' | 'status' | '_count'>;

export function getCustomers(): Promise<Customer[]> {
  return apiClient<Customer[]>('/customers');
}

export function createCustomer(data: CustomerInput): Promise<Customer> {
  return apiClient<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) });
}

export function updateCustomer(id: number, data: Partial<CustomerInput>): Promise<Customer> {
  return apiClient<Customer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteCustomer(id: number): Promise<void> {
  return apiClient<void>(`/customers/${id}`, { method: 'DELETE' });
}
