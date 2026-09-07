import { api, unwrap } from './client';
export type Task = { id: number; taskName: string; description?: string | null; status?: string; priority?: string; assignee?: string | null; assignedToUserId?: number | null; assignedToId?: number | null; dueDate?: string | null; submissionLink?: string | null; submissionNotes?: string | null; reviewComment?: string | null };
export type CreateTaskPayload = { taskName: string; project?: string | null; projectId?: number; dueDate?: string | null; priority?: string | null; status?: string; notes?: string | null; description?: string | null; driveLink?: string | null; assignedToUserId?: number };
export async function tasks(params?: Record<string, string | number>) {
	const value = unwrap<unknown>((await api.get('/tasks', { params })).data);
	if (Array.isArray(value)) return value as Task[];
	if (value && typeof value === 'object' && 'items' in value && Array.isArray((value as { items: unknown[] }).items)) return (value as { items: Task[] }).items;
	return [];
}
export async function createTask(payload: CreateTaskPayload) { return unwrap<Task>((await api.post('/tasks', payload)).data); }
export async function task(id: number) { return unwrap<Task>((await api.get(`/tasks/${id}`)).data); }
export async function updateTaskStatus(id: number, status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED') { return unwrap<Task>((await api.patch(`/tasks/${id}/status`, { status })).data); }
export async function submitTaskWork(id: number, payload: { submissionLink: string; note: string }) { return unwrap<Task>((await api.post(`/tasks/${id}/submit-work`, payload)).data); }
export async function reviewTask(id: number, decision: 'APPROVED' | 'REJECTED', remarks = '') { return unwrap<Task>((await api.patch(`/tasks/${id}/review`, { decision, remarks })).data); }
