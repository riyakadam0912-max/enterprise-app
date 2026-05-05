import { apiClient } from './apiClient';

export type FormSubmissionStatus = 'SUBMITTED' | 'REJECTED' | 'PROCESSED';

export interface FormSubmission {
  id:             number;
  form:           string;
  submittedBy:    string | null;
  submissionDate: string | null;
  data:           string | null;
  status:         FormSubmissionStatus;
  reviewer:       string | null;
  reviewDate:     string | null;
  createdAt:      string;
  updatedAt:      string;
}

export interface CreateFormSubmissionPayload {
  form:            string;
  submittedBy?:    string;
  submissionDate?: string;
  data?:           string;
  status?:         FormSubmissionStatus;
  reviewer?:       string;
  reviewDate?:     string;
}

export type UpdateFormSubmissionPayload = Partial<CreateFormSubmissionPayload>;

export function getFormSubmissions(): Promise<FormSubmission[]> {
  return apiClient<FormSubmission[]>('/form-submissions');
}

export function getFormSubmission(id: number): Promise<FormSubmission> {
  return apiClient<FormSubmission>(`/form-submissions/${id}`);
}

export function createFormSubmission(data: CreateFormSubmissionPayload): Promise<FormSubmission> {
  return apiClient<FormSubmission>('/form-submissions', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function updateFormSubmission(id: number, data: UpdateFormSubmissionPayload): Promise<FormSubmission> {
  return apiClient<FormSubmission>(`/form-submissions/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(data),
  });
}

export function deleteFormSubmission(id: number): Promise<void> {
  return apiClient<void>(`/form-submissions/${id}`, { method: 'DELETE' });
}

export function getFormSubmissionsByStatus(): Promise<Record<FormSubmissionStatus, FormSubmission[]>> {
  return apiClient<Record<FormSubmissionStatus, FormSubmission[]>>('/form-submissions/by-status');
}
