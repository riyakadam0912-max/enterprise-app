import { api, unwrap } from './client';

export type DynamicForm = { id: number; formName: string; formCode?: string | null; description?: string | null; status?: string | null; formType?: string | null; targetModule?: string | null };
export type FormSubmissionStatus = 'SUBMITTED' | 'PROCESSED' | 'REJECTED';
export type FormSubmission = { id: number; form: string; submittedBy?: string | null; submissionDate?: string | null; data?: string | null; status: FormSubmissionStatus; reviewer?: string | null; reviewDate?: string | null };
export async function dynamicForms(): Promise<DynamicForm[]> { const payload = unwrap<unknown>((await api.get('/dynamic-forms')).data); return Array.isArray(payload) ? payload as DynamicForm[] : []; }
export async function dynamicForm(id: number): Promise<DynamicForm> { return unwrap<DynamicForm>((await api.get(`/dynamic-forms/${id}`)).data); }
export async function createDynamicForm(payload: Partial<DynamicForm> & Pick<DynamicForm, 'formName'>) { return unwrap<DynamicForm>((await api.post('/dynamic-forms', payload)).data); }
export async function updateDynamicForm(id: number, payload: Partial<DynamicForm>) { return unwrap<DynamicForm>((await api.patch(`/dynamic-forms/${id}`, payload)).data); }
export async function removeDynamicForm(id: number) { return unwrap<unknown>((await api.delete(`/dynamic-forms/${id}`)).data); }
export async function formSubmissions(): Promise<FormSubmission[]> { const payload = unwrap<unknown>((await api.get('/form-submissions')).data); return Array.isArray(payload) ? payload as FormSubmission[] : []; }
export async function formSubmission(id: number): Promise<FormSubmission> { return unwrap<FormSubmission>((await api.get(`/form-submissions/${id}`)).data); }
export async function updateFormSubmission(id: number, payload: Partial<Pick<FormSubmission, 'form' | 'submissionDate' | 'data' | 'status'>>) { return unwrap<FormSubmission>((await api.patch(`/form-submissions/${id}`, payload)).data); }
export async function deleteFormSubmission(id: number) { return unwrap<unknown>((await api.delete(`/form-submissions/${id}`)).data); }
export async function submitForm(payload: { form: string; submissionDate?: string; data?: string }) { return unwrap<FormSubmission>((await api.post('/form-submissions', payload)).data); }
