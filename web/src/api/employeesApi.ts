import { apiClient } from './apiClient';
import type { Employee } from '@/types/entities';

export type { Employee };

export interface CreateEmployeePayload {
  name: string;
  email?: string;
  phoneNumber?: string;
  department?: string;
  designation?: string;
  hireDate?: string;
  manager?: string;
  leaveBalance?: number;
  status?: string;
}

export type UpdateEmployeePayload = Partial<CreateEmployeePayload>;

export function getEmployees(): Promise<Employee[]> {
  return apiClient<Employee[]>('/employees');
}

export function getEmployee(id: number): Promise<Employee> {
  return apiClient<Employee>(`/employees/${id}`);
}

export function getEmployeesByDepartment(): Promise<Record<string, Employee[]>> {
  return apiClient<Record<string, Employee[]>>('/employees/by-department');
}

export function createEmployee(data: CreateEmployeePayload): Promise<Employee> {
  return apiClient<Employee>('/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateEmployee(id: number, data: UpdateEmployeePayload): Promise<Employee> {
  return apiClient<Employee>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteEmployee(id: number): Promise<void> {
  return apiClient<void>(`/employees/${id}`, { method: 'DELETE' });
}
