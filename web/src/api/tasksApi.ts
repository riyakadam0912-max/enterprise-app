import { apiClient } from './apiClient';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiClient<T>(path, init);
}

export interface Task {
  id: number;
  title?: string;
  taskName: string;
  description?: string | null;
  project: string | null;
  projectId?: number | null;
  projectRef?: {
    id: number;
    projectName: string;
    managerId: number | null;
  } | null;
  assignee: string | null;
  assignedToUserId?: number | null;
  assignedByUserId?: number | null;
  assignedToUser?: {
    id: number;
    name: string;
    email: string;
  } | null;
  assignedByUser?: {
    id: number;
    name: string;
    email: string;
  } | null;
  dueDate: string | null;
  priority: string | null;
  status: string;
  submissionLink?: string | null;
  reviewComment?: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  notes: string | null;
  leadId: number | null;
  dealId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPayload {
  title?: string;
  taskName: string;
  description?: string | null;
  project?: string | null;
  projectId?: number;
  assignee?: string | null;
  assignedToUserId?: number;
  dueDate?: string | null;
  priority?: string | null;
  status?: string;
  submissionLink?: string | null;
  reviewComment?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  notes?: string | null;
  leadId?: number | null;
  dealId?: number | null;
}

export async function getTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks');
}

export async function getTask(id: number): Promise<Task> {
  return request<Task>(`/tasks/${id}`);
}

export async function createTask(data: TaskPayload): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTask(id: number, data: Partial<TaskPayload>): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateTaskStatus(
  id: number,
  status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED',
): Promise<Task> {
  return request<Task>(`/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function submitTaskWork(id: number, payload: { submissionLink: string; note: string }): Promise<Task> {
  return request<Task>(`/tasks/${id}/submit-work`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function reviewTask(
  id: number,
  payload: { decision: 'APPROVED' | 'REJECTED'; comment?: string },
): Promise<Task> {
  return request<Task>(`/tasks/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteTask(id: number): Promise<void> {
  await request<void>(`/tasks/${id}`, {
    method: 'DELETE',
  });
}

export async function getTasksByPriority(): Promise<Record<string, Task[]>> {
  return request<Record<string, Task[]>>('/tasks/by-priority');
}

export async function getUpcomingTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks/upcoming');
}

export async function getTasksByLead(id: number): Promise<Task[]> {
  return request<Task[]>(`/tasks/lead/${id}`);
}

export async function getTasksByDeal(id: number): Promise<Task[]> {
  return request<Task[]>(`/tasks/deal/${id}`);
}
