import { apiClient } from './apiClient';
import type { TaskTimerSession } from './tasksApi';

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
  organization?: { id: number; name: string };
  owners?: Array<{ id: number; name: string; email: string; role: string }>;
  createdById?: number | null;
  createdBy?: { id: number; name: string; email: string } | null;
  managerAssignedById?: number | null;
  managerAssignedBy?: { id: number; name: string; email: string } | null;
  clientName?: string | null;
  taskType?: 'GENERAL' | 'SHOOT';
  category?: string | null;
  projectType?: string | null;
  specificTask?: string | null;
  priority?: string | null;
  remarks?: string | null;
  finalDeliverablesLink?: string | null;
  driveLink?: string | null;
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
  customerId?: number | null;
  customer?: { id: number; customerName: string; customerType?: string } | null;
  tags?: string[];
  tasksCount?: number;
  phasesCount?: number;
  issuesCount?: number;
  _count?: { tasks: number; clientAccess?: number };
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
    organization?: { id: number; name: string };
  }>;
  messages?: ProjectMessage[];
  tasks?: Array<{
    id: number;
    taskName: string;
    assignedToId?: number | null;
    assignedToUserId?: number | null;
    assignedToUser?: { id: number; name: string; email: string } | null;
    assignedByUser?: { id: number; name: string; email: string } | null;
    status: string;
    taskType?: 'GENERAL' | 'SHOOT';
    category?: string | null;
    description?: string | null;
    links?: string | null;
    dueDate: string | null;
    startDate?: string | null;
    priority: string | null;
    estimatedHours?: number | null;
    completionPercent?: number | null;
    actualHours?: number | null;
    timerSessions?: TaskTimerSession[];
    legacyTimerTotalSeconds?: number;
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

export interface ProjectAssignmentUser {
  id: number;
  name: string;
  email: string;
  role: string;
  organization: { id: number; name: string } | null;
}

export interface ProjectMessage {
  id: string;
  projectId: number;
  senderId: number;
  content: string;
  mentions?: ProjectMessageMention[] | null;
  createdAt: string;
  sender: {
    id: number;
    name: string;
    email: string;
  };
}

export interface ProjectMessageMention {
  type: 'user' | 'task';
  id: number;
  label: string;
  start: number;
  end: number;
}

export interface ProjectMessageMentionOptions {
  users: Array<{ id: number; name: string; email: string; role: string }>;
  tasks: Array<{ id: number; name: string; status: string }>;
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
  ownerIds?: number[];
  status?: string;
  budget?: number;
  description?: string;
  client?: string;
  clientName?: string;
  category?: string;
  projectType?: string;
  specificTask?: string;
  priority?: string;
  remarks?: string;
  finalDeliverablesLink?: string;
  driveLink?: string;
  projectLead?: string;
  customerId?: number | null;
  tags?: string[];
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
  plannedHours: number;
  actualHours: number;
  remainingHours: number;
  milestoneRollups: Record<string, { totalTasks: number; completedTasks: number; progressPercent: number }>;
  taskListRollups: Record<string, { totalTasks: number; completedTasks: number; progressPercent: number }>;
}

export interface ProjectCriticalPath {
  projectId: number;
  taskIds: number[];
  durationHours: number;
  tasks: Array<{ id: number; taskName: string; status: string; startDate: string | null; dueDate: string | null; estimatedHours: number | null; completionPercent: number; assignedToUser: { id: number; name: string } | null }>;
  dependencies: Array<{ predecessorId: number; successorId: number; dependencyType: string; lagDays: number }>;
}

export interface ProjectWorkload {
  projectId: number;
  members: Array<{ user: { id: number; name: string; email: string } | null; taskCount: number; openTasks: number; estimatedHours: number; actualHours: number; remainingHours: number }>;
}

export interface ProjectBaseline {
  id: number;
  projectId: number;
  name: string;
  snapshotAt: string;
  createdAt: string;
  createdBy: { id: number; name: string; email: string };
}

export interface ProjectQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  managerId?: number;
  startFrom?: string;
  endTo?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface ProjectQueryResult {
  items: Project[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProjectWorkspace {
  project: { id: number; projectName: string; status: string; organizationId: number };
  milestones: Array<{ id: number; name: string; description: string | null; startDate: string | null; dueDate: string | null; status: string; sortOrder: number }>;
  taskLists: Array<{ id: number; name: string; description: string | null; sortOrder: number }>;
  tasks: Array<{
    id: number;
    taskName: string;
    status: string;
    priority: string | null;
    startDate: string | null;
    dueDate: string | null;
    completionPercent: number;
    milestoneId: number | null;
    taskListId: number | null;
    parentTaskId: number | null;
    assignedToUser: { id: number; name: string; email: string } | null;
  }>;
  issues: Array<{
    id: number;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    severity: string | null;
    dueDate: string | null;
    reportedBy: { id: number; name: string; email: string };
    assignedTo: { id: number; name: string; email: string } | null;
  }>;
}

export interface ProjectMilestone {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: string;
  sortOrder: number;
}

export interface ProjectTaskList {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface ProjectIssue {
  id: number;
  projectId: number;
  taskId?: number | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  severity: string | null;
  assignedToId?: number | null;
  dueDate: string | null;
}

export interface CreateMilestonePayload {
  name: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  status?: string;
  sortOrder?: number;
}

export interface CreateTaskListPayload {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface CreateTaskDependencyPayload {
  predecessorId: number;
  successorId: number;
  dependencyType?: 'FINISH_TO_START' | 'START_TO_START' | 'FINISH_TO_FINISH' | 'START_TO_FINISH';
  lagDays?: number;
}

export interface CreateProjectIssuePayload {
  title: string;
  description?: string;
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  severity?: string;
  taskId?: number;
  assignedToId?: number;
  dueDate?: string;
}

export async function getProjects(): Promise<Project[]> {
  return apiClient<Project[]>('/projects');
}

export async function queryProjects(query: ProjectQuery = {}): Promise<ProjectQueryResult> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiClient<ProjectQueryResult>(`/projects/query${suffix}`);
}

export async function getProject(id: number): Promise<Project> {
  return apiClient<Project>(`/projects/${id}`);
}

export async function getProjectWorkspace(id: number): Promise<ProjectWorkspace> {
  return apiClient<ProjectWorkspace>(`/projects/${id}/workspace`);
}

export async function createProjectMilestone(projectId: number, payload: CreateMilestonePayload): Promise<ProjectMilestone> {
  return apiClient<ProjectMilestone>(`/projects/${projectId}/milestones`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateProjectMilestone(projectId: number, milestoneId: number, payload: Partial<CreateMilestonePayload>): Promise<ProjectMilestone> {
  return apiClient<ProjectMilestone>(`/projects/${projectId}/milestones/${milestoneId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteProjectMilestone(projectId: number, milestoneId: number): Promise<void> {
  await apiClient<void>(`/projects/${projectId}/milestones/${milestoneId}`, { method: 'DELETE' });
}

export async function createProjectTaskList(projectId: number, payload: CreateTaskListPayload): Promise<ProjectTaskList> {
  return apiClient<ProjectTaskList>(`/projects/${projectId}/task-lists`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateProjectTaskList(projectId: number, taskListId: number, payload: Partial<CreateTaskListPayload>): Promise<ProjectTaskList> {
  return apiClient<ProjectTaskList>(`/projects/${projectId}/task-lists/${taskListId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteProjectTaskList(projectId: number, taskListId: number): Promise<void> {
  await apiClient<void>(`/projects/${projectId}/task-lists/${taskListId}`, { method: 'DELETE' });
}

export async function createTaskDependency(projectId: number, payload: CreateTaskDependencyPayload) {
  return apiClient<{ id: number; predecessorId: number; successorId: number; dependencyType: string; lagDays: number }>(`/projects/${projectId}/dependencies`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function deleteTaskDependency(projectId: number, dependencyId: number): Promise<void> {
  await apiClient<void>(`/projects/${projectId}/dependencies/${dependencyId}`, { method: 'DELETE' });
}

export async function createProjectIssue(projectId: number, payload: CreateProjectIssuePayload): Promise<ProjectIssue> {
  return apiClient<ProjectIssue>(`/projects/${projectId}/issues`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateProjectIssue(projectId: number, issueId: number, payload: Partial<CreateProjectIssuePayload>): Promise<ProjectIssue> {
  return apiClient<ProjectIssue>(`/projects/${projectId}/issues/${issueId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteProjectIssue(projectId: number, issueId: number): Promise<void> {
  await apiClient<void>(`/projects/${projectId}/issues/${issueId}`, { method: 'DELETE' });
}

export async function getEligibleProjectAssignees(projectId?: number): Promise<ProjectAssignmentUser[]> {
  const query = projectId == null ? '' : `?projectId=${projectId}`;
  return apiClient<ProjectAssignmentUser[]>(`/projects/eligible-managers${query}`);
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

export async function assignEmployee(projectId: number, employeeId: number, driveLink?: string): Promise<Project> {
  return apiClient<Project>(`/projects/${projectId}/employees`, {
    method: 'POST',
    body: JSON.stringify({ employeeId, driveLink: driveLink || undefined }),
  });
}

export async function removeEmployee(projectId: number, employeeId: number): Promise<Project> {
  return apiClient<Project>(`/projects/${projectId}/employees/${employeeId}`, {
    method: 'DELETE',
  });
}

export async function updateProjectStatus(id: number, status: string): Promise<Project> {
  return apiClient<Project>(`/projects/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getProjectProgress(id: number): Promise<ProjectProgress> {
  return apiClient<ProjectProgress>(`/projects/${id}/progress`);
}

export async function getProjectCriticalPath(id: number): Promise<ProjectCriticalPath> {
  return apiClient<ProjectCriticalPath>(`/projects/${id}/critical-path`);
}

export async function getProjectWorkload(id: number): Promise<ProjectWorkload> {
  return apiClient<ProjectWorkload>(`/projects/${id}/workload`);
}

export async function createProjectBaseline(id: number, name?: string): Promise<ProjectBaseline> {
  return apiClient<ProjectBaseline>(`/projects/${id}/baselines`, { method: 'POST', body: JSON.stringify(name ? { name } : {}) });
}

export async function getProjectBaselines(id: number): Promise<ProjectBaseline[]> {
  return apiClient<ProjectBaseline[]>(`/projects/${id}/baselines`);
}

export async function getProjectBaselineVariance(id: number, baselineId: number) {
  return apiClient<{ baselineId: number; projectId: number; baselineName: string; taskVariance: Array<{ taskId: number; statusChanged: boolean; completionDelta: number; dueDateDeltaDays: number | null; missing: boolean }>; addedTasks: number[] }>(`/projects/${id}/baselines/${baselineId}/variance`);
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

export async function getMessageMentionOptions(projectId: number): Promise<ProjectMessageMentionOptions> {
  return apiClient<ProjectMessageMentionOptions>(`/projects/${projectId}/message-mention-options`);
}

export async function sendMessage(
  projectId: number,
  content: string,
  mentions: ProjectMessageMention[] = [],
): Promise<ProjectMessage> {
  return apiClient<ProjectMessage>(`/projects/${projectId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, mentions }),
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
