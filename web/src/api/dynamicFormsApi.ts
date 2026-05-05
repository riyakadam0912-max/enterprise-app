import { apiClient } from './apiClient';

export interface DynamicForm {
  id: number;
  formName: string;
  formCode?: string;
  description?: string;
  createdBy?: string;
  status?: string;
  formType?: string;
  targetModule?: string;
  createdOn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDynamicFormPayload {
  formName: string;
  formCode?: string;
  description?: string;
  createdBy?: string;
  status?: string;
  formType?: string;
  targetModule?: string;
  createdOn?: string;
}

export type UpdateDynamicFormPayload = Partial<CreateDynamicFormPayload>;

export function getDynamicForms(): Promise<DynamicForm[]> {
  return apiClient<DynamicForm[]>('/dynamic-forms');
}

export function getDynamicForm(id: number): Promise<DynamicForm> {
  return apiClient<DynamicForm>(`/dynamic-forms/${id}`);
}

export function getDynamicFormsByTargetModule(): Promise<Record<string, DynamicForm[]>> {
  return apiClient<Record<string, DynamicForm[]>>('/dynamic-forms/by-target-module');
}

export function createDynamicForm(data: CreateDynamicFormPayload): Promise<DynamicForm> {
  return apiClient<DynamicForm>('/dynamic-forms', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateDynamicForm(id: number, data: UpdateDynamicFormPayload): Promise<DynamicForm> {
  return apiClient<DynamicForm>(`/dynamic-forms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteDynamicForm(id: number): Promise<void> {
  return apiClient<void>(`/dynamic-forms/${id}`, { method: 'DELETE' });
}
