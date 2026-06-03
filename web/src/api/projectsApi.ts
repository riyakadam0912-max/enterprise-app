import { apiClient } from './apiClient';

export interface Project {
  id: number;
  projectName: string;
  name?: string;
  projectCode: string | null;
  startDate: string | null;
  endDate: string | null;
  deadline?: string | null;
  manager: string | null;
  managerId: number | null;
  managerUser?: {
    id: number;
    name: string;
    email: string;
  } | null;
  status: string;
  budget: number | null;
  description: string | null;
  client: string | null;
  projectLead: string | null;
  links?: ProjectLink[];
  coManagers?: Array<{
    id: number;
    name: string;
    email: string;
  }>;
  assignedEmployees?: Array<{
    id: number;
    name: string;
    email: string;
    department: string | null;
    designation: string | null;
  }>;
  messages?: ProjectMessage[];
  tasks?: Array<{
    id: number;
    taskName: string;
    assignedToUserId?: number | null;
    assignedToUser?: { id: number; name: string; email: string } | null;
    assignedByUser?: { id: number; name: string; email: string } | null;
    status: string;
    category?: string | null;
    description?: string | null;
    links?: string | null;
    dueDate: string | null;
    priority: string | null;
    createdAt?: string;
    updatedAt?: string;
    notes: string | null;
    submissionLink?: string | null;
    submissionNotes?: string | null;
    reviewComment?: string | null;
    reviewedAt?: string | null;
    reviewedByUser?: { id: number; name: string; email: string } | null;
  }>;
  teamMembers?: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    managerId: number | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMessage {
  id: string;
  projectId: number;
  senderId: number;
  content: string;
  createdAt: string;
  sender: {
    id: number;
    name: string;
    email: string;
  };
}

export interface ProjectLink {
  id: number;
  projectId: number;
  title: string;
  url: string;
  createdById: number;
  createdAt: string;
}

export interface CreateProjectPayload {
  name?: string;
  projectName: string;
  projectCode?: string;
  startDate?: string;
  endDate?: string;
  deadline?: string;
  manager?: string;
  managerId?: number;
  status?: string;
  budget?: number;
  description?: string;
  client?: string;
  projectLead?: string;
}

export interface CreateProjectLinkPayload {
  title: string;
  url: string;
}

export interface ProjectProgress {
  projectId: number;
  projectName: string;
  projectStatus: string;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  byStatus: Record<string, number>;
}

export async function getProjects(): Promise<Project[]> {
  return apiClient<Project[]>('/projects');
}

export async function getProject(id: number): Promise<Project> {
  return apiClient<Project>(`/projects/${id}`);
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  return apiClient<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProject(id: number, payload: Partial<CreateProjectPayload>): Promise<Project> {
  return apiClient<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function assignProjectManager(id: number, managerId: number): Promise<Project> {
  return apiClient<Project>(`/projects/${id}/assign-manager`, {
    method: 'PATCH',
    body: JSON.stringify({ managerId }),
  });
}

export async function addCoManager(projectId: number, userId: number): Promise<Project> {
  return apiClient<Project>(`/projects/${projectId}/co-managers`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function removeCoManager(projectId: number, userId: number): Promise<Project> {
  return apiClient<Project>(`/projects/${projectId}/co-managers/${userId}`, {
    method: 'DELETE',
  });
}

export async function assignEmployee(projectId: number, employeeId: number): Promise<Project> {
  return apiClient<Project>(`/projects/${projectId}/employees`, {
    method: 'POST',
    body: JSON.stringify({ employeeId }),
  });
}

export async function removeEmployee(projectId: number, employeeId: number): Promise<Project> {
  return apiClient<Project>(`/projects/${projectId}/employees/${employeeId}`, {
    method: 'DELETE',
  });
}

export async function updateProjectStatus(id: number, status: 'ACTIVE' | 'COMPLETED'): Promise<Project> {
  return apiClient<Project>(`/projects/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getProjectProgress(id: number): Promise<ProjectProgress> {
  return apiClient<ProjectProgress>(`/projects/${id}/progress`);
}

export async function deleteProject(id: number): Promise<void> {
  await apiClient<void>(`/projects/${id}`, { method: 'DELETE' });
}

export async function getProjectsByStatus(): Promise<Record<string, Project[]>> {
  return apiClient<Record<string, Project[]>>('/projects/by-status');
}

export async function getProjectLinks(projectId: number): Promise<ProjectLink[]> {
  return apiClient<ProjectLink[]>(`/projects/${projectId}/links`);
}

export async function getMessages(projectId: number): Promise<ProjectMessage[]> {
  return apiClient<ProjectMessage[]>(`/projects/${projectId}/messages`);
}

export async function sendMessage(projectId: number, content: string): Promise<ProjectMessage> {
  return apiClient<ProjectMessage>(`/projects/${projectId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function createProjectLink(projectId: number, payload: CreateProjectLinkPayload): Promise<ProjectLink> {
  return apiClient<ProjectLink>(`/projects/${projectId}/links`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteProjectLink(projectId: number, linkId: number): Promise<void> {
  await apiClient<void>(`/projects/${projectId}/links/${linkId}`, { method: 'DELETE' });
}
