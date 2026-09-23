'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { reportError } from '@/lib/error-handling';
import { useRouter } from 'next/navigation';
import {
  addCoManager,
  assignProjectManager,
  assignEmployee,
  getProject,
  getProjectProgress,
  getProjects,
  getMessages,
  type Project,
  type ProjectMessage,
  type ProjectProgress,
  removeCoManager,
  removeEmployee,
  sendMessage,
  updateProjectStatus,
  updateProject,
} from '@/api/projectsApi';
import { createTask, getTaskMessages, reviewTask, sendTaskMessage, submitTaskWork, updateTask, updateTaskStatus } from '@/api/tasksApi';
import { apiClient } from '@/api/apiClient';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { SuccessFeedback } from '@/components/feedback/SuccessFeedback';
import { canAccessUsers } from '@/utils/auth/permissions';
import { useStableNow } from '@/hooks/useStableNow';
import { useAuthSession } from '@/stores/auth-store';

type DashboardRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
type ProjectTab = 'overview' | 'tasks' | 'chat' | 'team';

type TaskPanelData = {
  id: number;
  taskName: string;
  status: string;
  priority?: string | null;
  category?: string | null;
  description?: string | null;
  links?: string | null;
  driveLink?: string | null;
  assignee?: string | null;
  assignedToUserId?: number | null;
  assignedToUser?: { id: number; name: string; email: string } | null;
  assignedByUser?: { id: number; name: string; email: string } | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  notes?: string | null;
  submissionLink?: string | null;
  submissionNotes?: string | null;
  reviewComment?: string | null;
  reviewedAt?: string | null;
  reviewedByUser?: { id: number; name: string; email: string } | null;
};

const tabs: Array<{ id: ProjectTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'chat', label: 'Chat' },
  { id: 'team', label: 'Team' },
];

const taskStatusClass: Record<string, string> = {
  PENDING: 'bg-slate-200 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
};

const taskPriorityClass: Record<string, string> = {
  LOW: 'bg-slate-200 text-slate-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-rose-100 text-rose-700',
};

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusBadgeClass(status: string) {
  return status === 'COMPLETED'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-orange-100 text-orange-700';
}

function progressColorClass(progressPercent?: number | null) {
  if (progressPercent === null || progressPercent === undefined) {
    return 'bg-gray-300';
  }
  if (progressPercent >= 75) return 'bg-emerald-500';
  if (progressPercent >= 40) return 'bg-amber-400';
  return 'bg-rose-500';
}

function formatBudget(value?: number | null) {
  if (!value) {
    return 'Not set';
  }

  return `₹${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export default function ProjectsWorkflowPage() {
  const router = useRouter();
  const session = useAuthSession();
  const role = session.role;
  const userId = session.user?.id ?? null;
  const employeeId = session.employeeId;
  const currentTime = useStableNow();
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectDetails, setProjectDetails] = useState<Project | null>(null);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showProjectEdit, setShowProjectEdit] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [projectStartDateDraft, setProjectStartDateDraft] = useState('');
  const [projectEndDateDraft, setProjectEndDateDraft] = useState('');
  const [projectClientNameDraft, setProjectClientNameDraft] = useState('');
  const [projectCategoryDraft, setProjectCategoryDraft] = useState('');
  const [projectTypeDraft, setProjectTypeDraft] = useState('');
  const [projectSpecificTaskDraft, setProjectSpecificTaskDraft] = useState('');
  const [projectPriorityDraft, setProjectPriorityDraft] = useState('');
  const [projectBudgetDraft, setProjectBudgetDraft] = useState('');
  const [projectRemarksDraft, setProjectRemarksDraft] = useState('');
  const [projectFinalDeliverablesDraft, setProjectFinalDeliverablesDraft] = useState('');
  const [projectClientDraft, setProjectClientDraft] = useState('');
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState('');
  const [projectDriveLinkDraft, setProjectDriveLinkDraft] = useState('');

  const [managers, setManagers] = useState<Array<{ id: number; name: string; role: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: number; userId: number | null; name: string; email: string | null; department: string | null; designation: string | null }>>([]);
  const [managerSelection, setManagerSelection] = useState('');
  const [showCoManagerPicker, setShowCoManagerPicker] = useState(false);
  const [coManagerSelection, setCoManagerSelection] = useState('');
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [projectDriveLink, setProjectDriveLink] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskForm, setTaskForm] = useState({
    taskName: '',
    category: '',
    description: '',
    links: '',
    driveLink: '',
    assignedEmployeeId: '',
    dueDate: '',
    priority: 'MEDIUM',
  });
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  const canLoadDirectoryData = canAccessUsers(role);
  const primaryManagerId = projectDetails?.managerId ?? null;
  const coManagers = useMemo(() => projectDetails?.coManagers ?? [], [projectDetails?.coManagers]);
  const assignedEmployees = useMemo(() => projectDetails?.assignedEmployees ?? [], [projectDetails?.assignedEmployees]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const coManagerIds = new Set((projectDetails?.coManagers ?? []).map((manager) => manager.id));
  const isPrimaryManager = isManager && projectDetails?.managerId === userId;
  const isCoManager = isManager && userId != null && coManagerIds.has(userId);
  const canManageProject = isAdmin || isPrimaryManager || isCoManager;
  const canEditTeam = isAdmin || isPrimaryManager || isCoManager;
  const canEditCoManagers = isAdmin || isPrimaryManager;
  const isAssignedEmployee = employeeId != null && (projectDetails?.assignedEmployees ?? []).some((employee) => employee.id === employeeId);
  const hasAssignedTask = userId != null && (projectDetails?.tasks ?? []).some((task) => task.assignedToUserId === userId);
  const canViewChat = isAdmin || isManager || isAssignedEmployee || hasAssignedTask;



  async function loadProjectDetails(projectId: number) {
    setProgress(null);
    setMessages([]);
    const details = await getProject(projectId);
    setProjectDetails(details);
    setProjectNameDraft(details.projectName ?? '');
    setProjectStartDateDraft(details.startDate?.slice(0, 10) ?? '');
    setProjectEndDateDraft((details.endDate ?? details.deadline)?.slice(0, 10) ?? '');
    setProjectClientNameDraft(details.clientName ?? '');
    setProjectCategoryDraft(details.category ?? '');
    setProjectTypeDraft(details.projectType ?? '');
    setProjectSpecificTaskDraft(details.specificTask ?? '');
    setProjectPriorityDraft(details.priority ?? '');
    setProjectBudgetDraft(details.budget == null ? '' : String(details.budget));
    setProjectRemarksDraft(details.remarks ?? '');
    setProjectFinalDeliverablesDraft(details.finalDeliverablesLink ?? '');
    setProjectClientDraft(details.client ?? '');
    setProjectDescriptionDraft(details.description ?? '');
    setProjectDriveLinkDraft(details.driveLink ?? '');
    setManagerSelection(details.managerId ? String(details.managerId) : '');
    if (canManageProject) {
      try {
        const pg = await getProjectProgress(projectId);
        setProgress(pg);
      } catch {
        setProgress(null);
      }
    } else {
      setProgress(null);
    }
  }

  async function loadMessages(projectId: number) {
    if (!canViewChat) {
      setMessages([]);
      return;
    }

    try {
      const list = await getMessages(projectId);
      setMessages(list);
    } catch {
      setMessages([]);
    }
  }

  async function refreshProjects(initialProjectId?: number) {
    const list = await getProjects();
    setProjects(list);

    const targetId = initialProjectId ?? selectedProjectId ?? list[0]?.id ?? null;
    setSelectedProjectId(targetId);
    if (targetId) {
      await loadProjectDetails(targetId);
      if (activeTab === 'chat') {
        await loadMessages(targetId);
      }
    } else {
      setProjectDetails(null);
      setProgress(null);
      setMessages([]);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      const usersPromise = canLoadDirectoryData
        ? apiClient<Array<{ id: number; name: string; role: string; employeeId?: number | null }>>('/users')
        : Promise.resolve([] as Array<{ id: number; name: string; role: string; employeeId?: number | null }>);
      const employeesPromise = canLoadDirectoryData
        ? apiClient<Array<{ id: number; name: string; email: string | null; department: string | null; designation: string | null }>>('/employees')
        : Promise.resolve([] as Array<{ id: number; name: string; email: string | null; department: string | null; designation: string | null }>);

      const [usersResult, employeesResult] = await Promise.allSettled([usersPromise, employeesPromise]);

      if (cancelled) return;

      if (usersResult.status === 'fulfilled') {
        setManagers(usersResult.value.filter((u) => u.role === 'MANAGER'));
      } else {
        setManagers([]);
        if (canLoadDirectoryData) {
          console.error('Failed to load users', usersResult.reason);
        }
      }

      if (employeesResult.status === 'fulfilled') {
        const users = usersResult.status === 'fulfilled' ? usersResult.value : [];
        setEmployees(employeesResult.value.map((employee) => {
          const linkedUser = users.find((user) => user.employeeId === employee.id);
          return { ...employee, userId: linkedUser?.id ?? null };
        }));
      } else {
        setEmployees([]);
        if (canLoadDirectoryData) {
          console.error('Failed to load employees', employeesResult.reason);
        }
      }

      await refreshProjects();
      if (!cancelled) {
        setLoading(false);
      }
    }

    void loadInitialData().catch((error) => {
      reportError(error, 'Unable to initialize projects');
      if (!cancelled) {
        setError('Failed to load projects module');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadDirectoryData]);

  useEffect(() => {
    if (activeTab === 'chat' && selectedProjectId && canViewChat) {
      void loadMessages(selectedProjectId);
      const interval = window.setInterval(() => {
        void loadMessages(selectedProjectId);
      }, 10000);

      return () => window.clearInterval(interval);
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedProjectId, canViewChat]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const visibleTasks = useMemo(() => {
    const all = projectDetails?.tasks ?? [];
    if (isEmployee && userId) {
      return all.filter((task) => task.assignedToUserId === userId);
    }
    return all;
  }, [projectDetails?.tasks, isEmployee, userId]);

  const selectedTask = useMemo(
    () => visibleTasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, visibleTasks],
  );

  const taskAssigneeOptions = useMemo(() => employees, [employees]);

  const availableCoManagerOptions = useMemo(() => {
    const existingIds = new Set(coManagers.map((manager) => manager.id));
    return managers.filter((manager) => manager.id !== primaryManagerId && manager.id !== userId && !existingIds.has(manager.id));
  }, [coManagers, managers, primaryManagerId, userId]);

  const availableEmployeeOptions = useMemo(() => {
    const existingIds = new Set(assignedEmployees.map((employee) => employee.id));
    return employees.filter((employee) => !existingIds.has(employee.id));
  }, [assignedEmployees, employees]);

  const filteredEmployeeOptions = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    return availableEmployeeOptions.filter((employee) => {
      const haystack = [employee.name, employee.department ?? '', employee.designation ?? '', employee.email ?? '']
        .join(' ')
        .toLowerCase();
      return !term || haystack.includes(term);
    });
  }, [availableEmployeeOptions, employeeSearch]);

  async function onProjectSelect(projectId: number) {
    setSelectedProjectId(projectId);
    setSelectedTaskId(null);
    await loadProjectDetails(projectId);
  }

  async function onAssignManager() {
    if (!selectedProjectId || !managerSelection) return;
    if (Number(managerSelection) === projectDetails?.managerId) {
      setActionFeedback({ type: 'error', message: 'Selected manager is already assigned to this project.' });
      return;
    }
    setBusy(true);
    setActionFeedback(null);
    try {
      await assignProjectManager(selectedProjectId, Number(managerSelection));
      await refreshProjects(selectedProjectId);
      setActionFeedback({ type: 'success', message: 'Project manager updated successfully.' });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to assign manager' });
    } finally {
      setBusy(false);
    }
  }

  async function onUpdateProjectStatus(status: string) {
    if (!selectedProjectId) return;
    setBusy(true);
    setActionFeedback(null);
    try {
      await updateProjectStatus(selectedProjectId, status);
      await refreshProjects(selectedProjectId);
      setActionFeedback({ type: 'success', message: `Project status updated to ${status}.` });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update project status' });
    } finally {
      setBusy(false);
    }
  }

  async function onSaveProjectEdit() {
    if (!selectedProjectId) return;
    setBusy(true);
    try {
      await updateProject(selectedProjectId, {
        projectName: projectNameDraft.trim(),
        startDate: projectStartDateDraft || undefined,
        endDate: projectEndDateDraft || undefined,
        clientName: projectClientNameDraft.trim() || undefined,
        category: projectCategoryDraft.trim() || undefined,
        projectType: projectTypeDraft || undefined,
        specificTask: projectSpecificTaskDraft.trim() || undefined,
        priority: projectPriorityDraft.trim() || undefined,
        budget: projectBudgetDraft === '' ? undefined : Number(projectBudgetDraft),
        remarks: projectRemarksDraft.trim() || undefined,
        finalDeliverablesLink: projectFinalDeliverablesDraft.trim() || undefined,
        client: projectClientDraft.trim() || undefined,
        description: projectDescriptionDraft,
        driveLink: projectDriveLinkDraft || undefined,
      });
      await refreshProjects(selectedProjectId);
      setShowProjectEdit(false);
      setActionFeedback({ type: 'success', message: 'Project details updated successfully.' });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update project' });
    } finally {
      setBusy(false);
    }
  }

  async function onEditTask(taskId: number, payload: {
    taskName: string;
    category: string;
    description: string;
    links: string;
    driveLink: string;
    priority: string;
    dueDate: string | null;
  }) {
    await updateTask(taskId, {
      ...payload,
      driveLink: payload.driveLink || undefined,
    });
    if (selectedProjectId) await loadProjectDetails(selectedProjectId);
  }

  async function onLoadTaskMessages(taskId: number) {
    const messages = await getTaskMessages(taskId);
    return messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender.name,
      content: message.content,
      createdAt: message.createdAt,
    }));
  }

  async function onSendTaskMessage(taskId: number, content: string) {
    const message = await sendTaskMessage(taskId, content);
    return {
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender.name,
      content: message.content,
      createdAt: message.createdAt,
    };
  }

  async function onMarkAsComplete() {
    if (!selectedProjectId) return;
    setBusy(true);
    setActionFeedback(null);
    try {
      await updateProjectStatus(selectedProjectId, 'COMPLETED');
      await refreshProjects(selectedProjectId);
      setActionFeedback({ type: 'success', message: 'Project marked as complete.' });
      if (typeof window !== 'undefined') {
        window.alert('Project marked as complete.');
      }
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update project status' });
    } finally {
      setBusy(false);
    }
  }

  async function onAssignTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId || !taskForm.taskName.trim() || !taskForm.assignedEmployeeId) return;

    const selectedEmployee = employees.find((employee) => String(employee.id) === taskForm.assignedEmployeeId);
    if (!selectedEmployee?.userId) {
      setError('Selected employee does not have a linked user account.');
      return;
    }

    setTaskSubmitting(true);
    try {
      await createTask({
        title: taskForm.taskName.trim(),
        taskName: taskForm.taskName.trim(),
        category: taskForm.category.trim() || null,
        description: taskForm.description.trim() || null,
        links: taskForm.links.trim() || null,
        driveLink: taskForm.driveLink.trim() || undefined,
        projectId: selectedProjectId,
        assignedToUserId: selectedEmployee.userId,
        employeeId: Number(taskForm.assignedEmployeeId),
        dueDate: taskForm.dueDate || null,
        priority: taskForm.priority,
        status: 'PENDING',
      });
      setTaskForm({
        taskName: '',
        category: '',
        description: '',
        links: '',
        driveLink: '',
        assignedEmployeeId: '',
        dueDate: '',
        priority: 'MEDIUM',
      });
      await loadProjectDetails(selectedProjectId);
      setShowTaskForm(false);
    } finally {
      setTaskSubmitting(false);
    }
  }

  async function onSubmitTask(taskId: number, payload: { submissionLink: string; note: string }) {
    if (!payload?.note) return;

    setBusy(true);
    try {
      await submitTaskWork(taskId, {
        submissionLink: payload.submissionLink,
        note: payload.note,
      });
      if (selectedProjectId) {
        await loadProjectDetails(selectedProjectId);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onReviewTask(
    taskId: number,
    decisionOrPayload: 'APPROVED' | 'REJECTED' | { status: 'APPROVED' | 'REJECTED'; remarks?: string },
  ) {
    const decision = typeof decisionOrPayload === 'string' ? decisionOrPayload : decisionOrPayload.status;
    const remarks = typeof decisionOrPayload === 'string' ? undefined : decisionOrPayload.remarks?.trim() || undefined;
    setBusy(true);
    try {
      await reviewTask(taskId, {
        status: decision,
        remarks,
      });
      if (selectedProjectId) {
        await loadProjectDetails(selectedProjectId);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onAddCoManager() {
    if (!selectedProjectId || !coManagerSelection) return;
    setBusy(true);
    setActionFeedback(null);
    try {
      await addCoManager(selectedProjectId, Number(coManagerSelection));
      await refreshProjects(selectedProjectId);
      setShowCoManagerPicker(false);
      setCoManagerSelection('');
      setActionFeedback({ type: 'success', message: 'Co-manager added successfully.' });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to add co-manager' });
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveCoManager(userIdToRemove: number) {
    if (!selectedProjectId) return;
    setBusy(true);
    setActionFeedback(null);
    try {
      await removeCoManager(selectedProjectId, userIdToRemove);
      await refreshProjects(selectedProjectId);
      setActionFeedback({ type: 'success', message: 'Co-manager removed successfully.' });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to remove co-manager' });
    } finally {
      setBusy(false);
    }
  }

  async function onAddEmployee() {
    if (!selectedProjectId || !selectedEmployeeId) return;
    setBusy(true);
    setActionFeedback(null);
    try {
      await assignEmployee(
        selectedProjectId,
        Number(selectedEmployeeId),
        projectDriveLink.trim() || undefined,
      );
      await refreshProjects(selectedProjectId);
      setShowEmployeePicker(false);
      setEmployeeSearch('');
      setSelectedEmployeeId('');
      setProjectDriveLink('');
      setActionFeedback({ type: 'success', message: 'Team member added successfully.' });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to add employee' });
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveEmployee(employeeIdToRemove: number) {
    if (!selectedProjectId) return;
    setBusy(true);
    setActionFeedback(null);
    try {
      await removeEmployee(selectedProjectId, employeeIdToRemove);
      await refreshProjects(selectedProjectId);
      setActionFeedback({ type: 'success', message: 'Team member removed successfully.' });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to remove employee' });
    } finally {
      setBusy(false);
    }
  }

  async function onSendMessage() {
    if (!selectedProjectId || !chatDraft.trim()) return;
    setChatLoading(true);
    try {
      const sent = await sendMessage(selectedProjectId, chatDraft.trim());
      setMessages((prev) => [...prev, sent]);
      setChatDraft('');
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to send message' });
    } finally {
      setChatLoading(false);
    }
  }

  async function onTaskStatusChange(taskId: number, status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED') {
    setBusy(true);
    try {
      await updateTaskStatus(taskId, status);
      if (selectedProjectId) {
        await loadProjectDetails(selectedProjectId);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading project workflow...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-rose-600">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects Workflow</h1>
          <p className="text-sm text-slate-500">
            {isAdmin && 'Create Project -> Assign Manager -> Assign Tasks -> Review -> Monitor All Progress'}
            {isManager && 'My Projects -> Resources -> Assign Tasks -> Review Work -> Update Status'}
            {isEmployee && "Manager's Projects -> Resources -> My Tasks -> Submit Work"}
          </p>
        </div>
        {(isAdmin || isManager) && (
          <button
            onClick={() => router.push('/dashboard/projects/add')}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            + Create Project
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => onProjectSelect(project.id)}
            className={`group rounded-xl border p-4 text-left shadow-sm transition ${
              selectedProjectId === project.id
                ? 'border-orange-400 bg-orange-50/60'
                : 'border-slate-200 bg-white hover:border-orange-200'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{project.projectName}</p>
                {project.projectCode && <p className="text-xs text-slate-400">Code: {project.projectCode}</p>}
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(project.status)}`}>
                {project.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">Manager: {project.managerUser?.name ?? project.manager ?? 'Unassigned'}</p>
            <p className="text-xs text-slate-500">Deadline: {formatDate(project.deadline ?? project.endDate)}</p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full ${
                  selectedProjectId === project.id && progress
                    ? progressColorClass(progress.progressPercent)
                    : 'bg-gray-300'
                }`}
                style={{
                  width:
                    selectedProjectId === project.id && progress
                      ? `${Math.max(4, Math.min(100, progress.progressPercent))}%`
                      : '100%',
                }}
              />
            </div>
          </button>
        ))}
      </div>

      {actionFeedback?.type === 'success' && <SuccessFeedback title={actionFeedback.message} />}
      {actionFeedback?.type === 'error' && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {actionFeedback.message}
        </div>
      )}

      {projectDetails && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{projectDetails.projectName}</h2>
              <p className="text-sm text-slate-500">Project details and execution controls</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManageProject && (
                <button
                  type="button"
                  onClick={() => setShowProjectEdit(true)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Edit project
                </button>
              )}
              {isAdmin && (
                <>
                  <select
                    value={managerSelection}
                    onChange={(e) => setManagerSelection(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Assign manager</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={onAssignManager}
                    disabled={busy || !managerSelection || Number(managerSelection) === projectDetails.managerId}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Assign Manager
                  </button>
                </>
              )}

              {canManageProject && projectDetails.status !== 'COMPLETED' && (
                <button
                  onClick={onMarkAsComplete}
                  disabled={busy}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Mark as Complete
                </button>
              )}

              {canManageProject && (
                <select
                  value={projectDetails.status}
                  onChange={(e) => onUpdateProjectStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="NOT_STARTED">NOT STARTED</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="IN_APPROVAL">IN APPROVAL</option>
                  <option value="BLOCKED_CANCELLED">BLOCKED/CANCELLED</option>
                  <option value="POSTPONED">POSTPONED</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              )}
            </div>
          </div>

          {projectDetails.status === 'COMPLETED' && (
            <SuccessFeedback
              className="mb-4"
              title="Project completed successfully"
              description="All project work has been marked complete."
            />
          )}

          <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-100 pb-3">
            {tabs
              .filter((tab) => !(tab.id === 'chat' && !canViewChat))
              .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-4">
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-600">Overall completion</span>
                  <span className="font-semibold text-slate-900">{progress ? `${progress.progressPercent}%` : 'N/A'}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${progress ? Math.max(0, Math.min(100, progress.progressPercent)) : 0}%` }}
                  />
                </div>
                {progress && (
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
                    <p>PENDING: {progress.byStatus.PENDING ?? 0}</p>
                    <p>IN_PROGRESS: {progress.byStatus.IN_PROGRESS ?? 0}</p>
                    <p>SUBMITTED: {progress.byStatus.SUBMITTED ?? 0}</p>
                    <p>APPROVED: {progress.byStatus.APPROVED ?? 0}</p>
                    <p>REJECTED: {progress.byStatus.REJECTED ?? 0}</p>
                  </div>
                )}
              </article>

              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Summary</p>
                    {canManageProject && !showProjectEdit && (
                      <button type="button" onClick={() => setShowProjectEdit(true)} className="text-sm font-semibold text-blue-600 hover:underline">Edit</button>
                    )}
                  </div>
                  {showProjectEdit ? (
                    <div className="space-y-3">
                      <input value={projectNameDraft} onChange={(event) => setProjectNameDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Project name" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input type="date" value={projectStartDateDraft} onChange={(event) => setProjectStartDateDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                        <input type="date" value={projectEndDateDraft} onChange={(event) => setProjectEndDateDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input value={projectClientNameDraft} onChange={(event) => setProjectClientNameDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Client name" />
                        <input value={projectCategoryDraft} onChange={(event) => setProjectCategoryDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Category" />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input value={projectSpecificTaskDraft} onChange={(event) => setProjectSpecificTaskDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Primary project task" />
                        <input value={projectClientDraft} onChange={(event) => setProjectClientDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Client reference" />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select value={projectTypeDraft} onChange={(event) => setProjectTypeDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <option value="">Project type</option>
                          <option value="EVENT_MANAGEMENT">EVENT MANAGEMENT</option>
                          <option value="PRODUCTION_EM">PRODUCTION EM</option>
                          <option value="DIGITAL_MARKETING">DIGITAL MARKETING</option>
                          <option value="PRODUCTION_DM">PRODUCTION DM</option>
                          <option value="PRODUCTION_OTHER">PRODUCTION OTHER</option>
                          <option value="TECH_PROJECTS">TECH PROJECTS</option>
                        </select>
                        <select value={projectPriorityDraft} onChange={(event) => setProjectPriorityDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <option value="">Priority</option>
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                        </select>
                      </div>
                      <input type="number" min="0" value={projectBudgetDraft} onChange={(event) => setProjectBudgetDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Budget" />
                      <textarea value={projectDescriptionDraft} onChange={(event) => setProjectDescriptionDraft(event.target.value)} rows={5} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Project summary and description" />
                      <textarea value={projectRemarksDraft} onChange={(event) => setProjectRemarksDraft(event.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Remarks" />
                      <input value={projectDriveLinkDraft} onChange={(event) => setProjectDriveLinkDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Google Drive link" />
                      <input value={projectFinalDeliverablesDraft} onChange={(event) => setProjectFinalDeliverablesDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Final deliverables link" />
                      <div className="flex gap-2">
                        <button type="button" disabled={busy} onClick={onSaveProjectEdit} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save changes</button>
                        <button type="button" onClick={() => setShowProjectEdit(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                      </div>
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap wrap-break-word text-sm text-slate-700">{projectDetails.description ?? 'No description available.'}</p>
                  <div className="mt-4 space-y-1 text-sm text-slate-600">
                    <p>Start: {formatDate(projectDetails.startDate)}</p>
                    <p>Deadline: {formatDate(projectDetails.deadline ?? projectDetails.endDate)}</p>
                    <p>Status: {projectDetails.status}</p>
                    <p>Budget: {formatBudget(projectDetails.budget)}</p>
                    {projectDetails.clientName && <p>Client: {projectDetails.clientName}</p>}
                    {projectDetails.category && <p>Category: {projectDetails.category}</p>}
                    {projectDetails.projectType && <p>Type: {projectDetails.projectType}</p>}
                    {projectDetails.priority && <p>Priority: {projectDetails.priority}</p>}
                    {projectDetails.specificTask && <p>Task: {projectDetails.specificTask}</p>}
                    {projectDetails.owner && <p>Owner: {projectDetails.owner.name}</p>}
                    {projectDetails.remarks && <p>Remarks: {projectDetails.remarks}</p>}
                    {projectDetails.finalDeliverablesLink && (
                      <p>
                        Deliverables:{' '}
                        <a href={projectDetails.finalDeliverablesLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          View
                        </a>
                      </p>
                    )}
                    {projectDetails.driveLink && (
                      <p className="text-blue-600">
                        Drive:{' '}
                        <a href={projectDetails.driveLink} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
                          Open
                        </a>
                      </p>
                    )}
                    {projectDetails.links && projectDetails.links.length > 0 && (
                      <div className="space-y-1 pt-2">
                        <p className="font-medium text-slate-700">Reference links:</p>
                        {projectDetails.links.map((link) => (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block break-all text-blue-600 hover:underline"
                          >
                            {link.title || link.url}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Progress Summary</p>
                  {progress ? (
                    <div className="space-y-1 text-sm text-slate-600">
                      <p>Total Tasks: {progress.totalTasks}</p>
                      <p>Completed Tasks: {progress.completedTasks}</p>
                      <p>Project Status: {progress.projectStatus}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Progress is available to manager and admin only.</p>
                  )}
                </article>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">Create tasks and track submissions within this project.</p>
                {canManageProject && (
                  <button
                    onClick={() => setShowTaskForm((prev) => !prev)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {showTaskForm ? 'Close Form' : 'Create New Task'}
                  </button>
                )}
              </div>

              {canManageProject && showTaskForm && (
                <form onSubmit={onAssignTask} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      required
                      value={taskForm.taskName}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, taskName: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Task title"
                    />
                    <select
                      required
                      value={taskForm.assignedEmployeeId}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, assignedEmployeeId: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Assign to employee</option>
                      {taskAssigneeOptions.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}{employee.department ? ` · ${employee.department}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <select
                    value={taskForm.category}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Category</option>
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Testing">Testing</option>
                    <option value="Review">Review</option>
                    <option value="Documentation">Documentation</option>
                    <option value="Other">Other</option>
                  </select>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    placeholder="Describe what the employee needs to do. Include steps, context, and any reference materials."
                    rows={4}
                  />
                  <input
                    value={taskForm.links}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, links: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    placeholder="Paste URLs or document links here (comma separated)"
                  />
                  <input
                    type="url"
                    value={taskForm.driveLink}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, driveLink: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    placeholder="Google Drive link (optional)"
                  />
                  <div className="grid gap-3 md:grid-cols-3">
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                    </select>
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      disabled={taskSubmitting}
                      className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {taskSubmitting ? 'Saving…' : 'Assign Task'}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {visibleTasks.length === 0 && (
                  <div className="flex min-h-40 items-center justify-center px-4 py-10 text-center">
                    <div>
                      <div className="mb-2 text-2xl">📋</div>
                      <p className="text-sm text-slate-500">No tasks here</p>
                    </div>
                  </div>
                )}
                {visibleTasks.map((task) => {
                  const status = task.status?.toUpperCase() ?? 'PENDING';
                  const priority = (task.priority?.toUpperCase() ?? 'LOW') as keyof typeof taskPriorityClass;
                  const taskDue = task.dueDate ? new Date(task.dueDate) : null;
                  const isPastDue = Boolean(taskDue && taskDue.getTime() < currentTime && status !== 'APPROVED');
                  return (
                    <article key={task.id} onClick={() => setSelectedTaskId(task.id)} className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-orange-200">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{task.taskName}</p>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${taskStatusClass[status] ?? 'bg-slate-200 text-slate-700'}`}>
                          {status}
                        </span>
                      </div>
                      <p className={`text-xs ${isPastDue ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>
                        {priority} · {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                      </p>
                      <div className="mt-3 h-0.75 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${taskPriorityClass[priority] ?? taskPriorityClass.LOW}`}
                          style={{ width: `${status === 'APPROVED' ? 100 : status === 'SUBMITTED' ? 80 : status === 'IN_PROGRESS' ? 55 : 20}%` }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>

              <TaskDetailPanel
                key={selectedTask?.id ?? 'none'}
                task={selectedTask as TaskPanelData | null}
                open={Boolean(selectedTask)}
                role={(role as DashboardRole)}
                currentUserId={userId}
                onClose={() => setSelectedTaskId(null)}
                onStartTask={(taskId) => onTaskStatusChange(taskId, 'IN_PROGRESS')}
                onSubmitTask={(taskId, payload) => {
                  return onSubmitTask(taskId, payload);
                }}
                onReviewTask={(taskId, payload) => onReviewTask(taskId, payload)}
                onEditTask={onEditTask}
                onLoadMessages={onLoadTaskMessages}
                onSendMessage={onSendTaskMessage}
                onUpdateStatus={onTaskStatusChange}
                busy={busy}
              />
            </div>
          )}

          {activeTab === 'chat' && canViewChat && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="h-112 overflow-y-auto rounded-lg bg-white p-4 shadow-inner space-y-3">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    No messages yet. Start the project conversation.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMine = message.sender.id === userId;
                    return (
                      <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${isMine ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                          <p className={`text-xs font-semibold ${isMine ? 'text-blue-100' : 'text-slate-700'}`}>
                            {message.sender.name}
                          </p>
                          <p className="mt-1 text-sm leading-6">{message.content}</p>
                          <p className={`mt-2 text-[11px] ${isMine ? 'text-blue-100' : 'text-slate-500'}`}>
                            {new Date(message.createdAt).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Write a message to the project team"
                />
                <button
                  onClick={onSendMessage}
                  disabled={chatLoading || !chatDraft.trim()}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {chatLoading ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-6">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Co-Managers</h3>
                    <p className="text-sm text-slate-500">Extra managers who can help run this project.</p>
                  </div>
                  {canEditCoManagers && (
                    <button
                      onClick={() => setShowCoManagerPicker((prev) => !prev)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      {showCoManagerPicker ? 'Close' : 'Add Co-Manager'}
                    </button>
                  )}
                </div>

                {canEditCoManagers && showCoManagerPicker && (
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={coManagerSelection}
                      onChange={(e) => setCoManagerSelection(e.target.value)}
                      className="min-w-55 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Select a manager</option>
                      {availableCoManagerOptions.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={onAddCoManager}
                      disabled={!coManagerSelection || busy}
                      className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {coManagers.length === 0 && (
                    <p className="text-sm text-slate-500">No co-managers assigned yet.</p>
                  )}
                  {coManagers.map((manager) => (
                    <div key={manager.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{manager.name}</p>
                        <p className="text-xs text-slate-500">{manager.email}</p>
                      </div>
                      {canEditCoManagers && (
                        <button
                          onClick={() => onRemoveCoManager(manager.id)}
                          className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Assigned Team Members</h3>
                    <p className="text-sm text-slate-500">Employees assigned specifically to this project.</p>
                  </div>
                  {canEditTeam && (
                    <button
                      onClick={() => setShowEmployeePicker((prev) => !prev)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      {showEmployeePicker ? 'Close' : 'Add Team Member'}
                    </button>
                  )}
                </div>

                {canEditTeam && showEmployeePicker && (
                  <div className="space-y-2">
                    <input
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Search employee by name, department, or designation"
                    />
                    <input
                      type="url"
                      value={projectDriveLink}
                      onChange={(e) => setProjectDriveLink(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Google Drive link (optional)"
                    />
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                      {filteredEmployeeOptions.length === 0 ? (
                        <p className="p-3 text-sm text-slate-400">No matching employees</p>
                      ) : (
                        filteredEmployeeOptions.map((employee) => (
                          <button
                            key={employee.id}
                            type="button"
                            onClick={() => setSelectedEmployeeId(String(employee.id))}
                            className={`w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 ${selectedEmployeeId === String(employee.id) ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                          >
                            <p className="text-sm font-medium text-slate-900">{employee.name}</p>
                            <p className="text-xs text-slate-500">
                              {[employee.department, employee.designation].filter(Boolean).join(' · ') || employee.email || 'Employee'}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={onAddEmployee}
                        disabled={!selectedEmployeeId || busy}
                        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Add Selected Employee
                      </button>
                      <button
                        onClick={() => {
                          setEmployeeSearch('');
                          setSelectedEmployeeId('');
                        }}
                        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {assignedEmployees.length === 0 && (
                    <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
                      <div>
                        <div className="mb-2 text-2xl">📋</div>
                        <p className="text-sm font-medium text-slate-500">No team members assigned yet. Add employees to get started.</p>
                      </div>
                    </div>
                  )}
                  {assignedEmployees.map((employee) => (
                    <div key={employee.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{employee.name}</p>
                        <p className="text-xs text-slate-500">
                          {employee.department ?? 'No department'}{employee.designation ? ` · ${employee.designation}` : ''}
                        </p>
                      </div>
                      {canEditTeam && (
                        <button
                          onClick={() => onRemoveEmployee(employee.id)}
                          className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                        >
                          Remove from Project
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Manager Team</h3>
                  <p className="text-sm text-slate-500">Employees still linked through the primary manager.</p>
                </div>
                {(projectDetails.teamMembers ?? []).length === 0 && (
                  <p className="text-sm text-slate-500">No manager-linked team members found.</p>
                )}
                {(projectDetails.teamMembers ?? []).map((member) => (
                  <div key={member.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </div>
                ))}
              </section>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
