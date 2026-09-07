import { api, unwrap } from './client';

export type Employee = { id: number; name: string; email?: string | null; phoneNumber?: string | null; department?: string | null; designation?: string | null; hireDate?: string | null; status?: string | null; shift?: { id: number; name: string } | null; businessUnit?: { id: number; name: string } | null; };
export type CreateEmployeePayload = { name: string; email?: string; phoneNumber?: string; department?: string; designation?: string; hireDate?: string; manager?: string; leaveBalance?: number; status?: string; password?: string; role?: 'EMPLOYEE' | 'MANAGER' | 'HR'; managerId?: number; managerIds?: number[]; shiftId?: number; businessUnitId?: number; };

export async function employees(): Promise<Employee[]> { const payload = unwrap<unknown>((await api.get('/employees')).data); return Array.isArray(payload) ? payload as Employee[] : []; }
export async function employee(id: number): Promise<Employee> { return unwrap<Employee>((await api.get(`/employees/${id}`)).data); }
export async function createEmployee(data: CreateEmployeePayload): Promise<Employee> { return unwrap<Employee>((await api.post('/employees', data)).data); }
export async function updateEmployee(id: number, data: Partial<CreateEmployeePayload>): Promise<Employee> { return unwrap<Employee>((await api.patch(`/employees/${id}`, data)).data); }
export async function removeEmployee(id: number): Promise<Employee> { return unwrap<Employee>((await api.delete(`/employees/${id}`)).data); }