import { apiClient } from './apiClient';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiClient<T>(path, init);
}

export interface Task {
  id: number;
  taskType: 'GENERAL' | 'SHOOT';
  shootClientName?: string | null;
  shootLocation?: string | null;
  shootDate?: string | null;
  shootReportingTime?: string | null;
  shootEstimatedHours?: number | null;
  shootCrew?: Array<{
    userId: number;
    user: { id: number; name: string; email: string; role: string };
  }>;
  organization?: { id: number; name: string };
  title?: string;
  taskName: string;
  description?: string | null;
  category?: string | null;
  links?: string | null;
  driveLink?: string | null;
  project: string | null;
  projectId?: number | null;
  parentTaskId?: number | null;
  projectRef?: {
    id: number;
    projectName: string;
    managerId: number | null;
  } | null;
  assignee: string | null;
  assignedToId?: number | null;
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
  startDate?: string | null;
  completionPercent?: number | null;
  milestoneId?: number | null;
  taskListId?: number | null;
  parentTask?: { id: number; taskName: string; status: string } | null;
  childTasks?: Array<{ id: number; taskName: string; status: string; completionPercent: number; dueDate: string | null }>;
  outgoingDependencies?: Array<{ id: number; dependencyType: string; lagDays: number; successor: { id: number; taskName: string; status: string } }>;
  incomingDependencies?: Array<{ id: number; dependencyType: string; lagDays: number; predecessor: { id: number; taskName: string; status: string } }>;
  projectIssues?: Array<{ id: number; title: string; status: string; priority: string; dueDate: string | null }>;
  checklistItems?: TaskChecklistItem[];
  watchers?: TaskWatcher[];
  priority: string | null;
  status: string;
  submissionLink?: string | null;
  submissionNotes?: string | null;
  reviewComment?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: number | null;
  reviewedByUser?: {
    id: number;
    name: string;
    email: string;
  } | null;
  estimatedHours: number | null;
  actualHours: number | null;
  timerSessions?: TaskTimerSession[];
  legacyTimerTotalSeconds?: number;
  notes: string | null;
  leadId: number | null;
  dealId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTimerSession {
  id: number;
  taskId: number;
  userId: number;
  organizationId: number;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  durationSeconds: number;
  remainingSeconds: number;
  startedAt: string | null;
  totalSeconds: number;
  createdAt: string;
  updatedAt: string;
  user: { id: number; name: string; email: string };
}

export interface TaskChecklistItem {
  id: number;
  taskId: number;
  title: string;
  completed: boolean;
  completedById: number | null;
  completedAt: string | null;
  sortOrder: number;
  completedBy?: { id: number; name: string; email: string } | null;
}

export interface TaskWatcher {
  taskId: number;
  userId: number;
  createdAt: string;
  user: { id: number; name: string; email: string; role: string };
}

export interface TaskPayload {
  taskType?: 'GENERAL' | 'SHOOT';
  shootClientName?: string | null;
  shootLocation?: string | null;
  shootDate?: string | null;
  shootReportingTime?: string | null;
  shootEstimatedHours?: number | null;
  shootCrewUserIds?: number[];
  title?: string;
  taskName: string;
  description?: string | null;
  category?: string | null;
  links?: string | null;
  driveLink?: string | null;
  project?: string | null;
  projectId?: number;
  parentTaskId?: number | null;
  assignee?: string | null;
  employeeId?: number | null;
  assignedToUserId?: number | null;
  dueDate?: string | null;
  startDate?: string | null;
  completionPercent?: number | null;
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

export interface TaskQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  projectId?: number;
  milestoneId?: number;
  taskListId?: number;
  status?: string;
  priority?: string;
  assignedToUserId?: number;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface TaskQueryResult {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TaskMessage {
  id: string;
  taskId: number;
  senderId: number;
  content: string;
  createdAt: string;
  sender: { id: number; name: string; email: string };
}

export async function getTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks');
}

export async function queryTasks(query: TaskQuery = {}): Promise<TaskQueryResult> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return request<TaskQueryResult>(`/tasks/query${suffix}`);
}

export async function getTask(id: number): Promise<Task> {
  return request<Task>(`/tasks/${id}`);
}

export async function getTaskMessages(id: number): Promise<TaskMessage[]> {
  return request<TaskMessage[]>(`/tasks/${id}/messages`);
}

export async function sendTaskMessage(id: number, content: string): Promise<TaskMessage> {
  return request<TaskMessage>(`/tasks/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function getTaskChecklist(id: number): Promise<TaskChecklistItem[]> {
  return request<TaskChecklistItem[]>(`/tasks/${id}/checklist`);
}

export async function createTaskChecklistItem(id: number, title: string, sortOrder?: number): Promise<TaskChecklistItem> {
  return request<TaskChecklistItem>(`/tasks/${id}/checklist`, { method: 'POST', body: JSON.stringify({ title, sortOrder }) });
}

export async function updateTaskChecklistItem(id: number, itemId: number, payload: { title?: string; completed?: boolean; sortOrder?: number }): Promise<TaskChecklistItem> {
  return request<TaskChecklistItem>(`/tasks/${id}/checklist/${itemId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteTaskChecklistItem(id: number, itemId: number): Promise<void> {
  await request<void>(`/tasks/${id}/checklist/${itemId}`, { method: 'DELETE' });
}

export async function getTaskWatchers(id: number): Promise<TaskWatcher[]> {
  return request<TaskWatcher[]>(`/tasks/${id}/watchers`);
}

export async function addTaskWatcher(id: number, userId?: number): Promise<TaskWatcher> {
  return request<TaskWatcher>(`/tasks/${id}/watchers`, { method: 'POST', body: JSON.stringify(userId == null ? {} : { userId }) });
}

export async function removeTaskWatcher(id: number, userId: number): Promise<void> {
  await request<void>(`/tasks/${id}/watchers/${userId}`, { method: 'DELETE' });
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
  status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED',
): Promise<Task> {
  return request<Task>(`/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export interface BulkTaskUpdatePayload {
  taskIds: number[];
  status?: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedToUserId?: number;
  dueDate?: string | null;
}

export async function bulkUpdateTasks(payload: BulkTaskUpdatePayload): Promise<{ updated: number; taskIds: number[] }> {
  return request<{ updated: number; taskIds: number[] }>('/tasks/bulk', { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function updateTaskTimer(
  id: number,
  action: 'start' | 'pause' | 'resume' | 'stop',
): Promise<Task> {
  return request<Task>(`/tasks/${id}/timer`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
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
  payload: { status?: 'APPROVED' | 'REJECTED'; decision?: 'APPROVED' | 'REJECTED'; remarks?: string; comment?: string },
): Promise<Task> {
  const finalPayload = {
    decision: (payload.decision ?? payload.status) as 'APPROVED' | 'REJECTED',
    remarks: payload.remarks ?? payload.comment ?? '',
  };

  return request<Task>(`/tasks/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify(finalPayload),
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
