'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { reportError } from '@/lib/error-handling';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCustomers, type Customer } from '@/api/customersApi';
import {
  addCoManager,
  assignProjectManager,
  assignEmployee,
  createProject,
  getProject,
  getProjectProgress,
  getProjects,
  getMessages,
  getMessageMentionOptions,
  type Project,
  type ProjectMessage,
  type ProjectMessageMention,
  type ProjectMessageMentionOptions,
  type ProjectProgress,
  removeCoManager,
  removeEmployee,
  sendMessage,
  updateProjectStatus,
  updateProject,
} from '@/api/projectsApi';
import { createTask, getTaskMessages, reviewTask, sendTaskMessage, submitTaskWork, updateTask, updateTaskStatus } from '@/api/tasksApi';
import { apiClient } from '@/api/apiClient';
import { createTimesheet, getTimesheetsReport } from '@/api/timesheetsApi';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { TaskTimerSessionsCell } from '@/components/tasks/TaskTimerSessionsCell';
import { SuccessFeedback } from '@/components/feedback/SuccessFeedback';
import { canAccessUsers } from '@/utils/auth/permissions';
import { useStableNow } from '@/hooks/useStableNow';
import { useAuthSession } from '@/stores/auth-store';
import { ProjectGrid } from '@/components/projects/ProjectGrid';
import { dateTimeLocalToIso, formatDateTime } from '@/utils/dateUtils';

type ProjectTab = 'overview' | 'tasks' | 'users' | 'reports' | 'issues' | 'timeLogs' | 'chat';

type TaskPanelData = {
  id: number;
  taskName: string;
  status: string;
  priority?: string | null;
  estimatedHours?: number | null;
  category?: string | null;
  description?: string | null;
  links?: string | null;
  driveLink?: string | null;
  assignee?: string | null;
  assignedToUserId?: number | null;
  assignedToUser?: { id: number; name: string; email: string } | null;
  assignedByUser?: { id: number; name: string; email: string } | null;
  startDate?: string | null;
  dueDate?: string | null;
  completionPercent?: number | null;
  actualHours?: number | null;
  timerSessions?: NonNullable<Project['tasks']>[number]['timerSessions'];
  legacyTimerTotalSeconds?: number;
  createdAt?: string;
  updatedAt?: string;
  notes?: string | null;
  submissionLink?: string | null;
  submissionNotes?: string | null;
  reviewComment?: string | null;
  reviewedAt?: string | null;
  reviewedByUser?: { id: number; name: string; email: string } | null;
};

type MentionSuggestion =
  | { type: 'user'; id: number; label: string; detail: string }
  | { type: 'task'; id: number; label: string; detail: string };

type MentionMenuState = {
  trigger: '@' | '#';
  query: string;
  start: number;
  end: number;
  activeIndex: number;
};

const tabs: Array<{ id: ProjectTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'chat', label: 'Chat' },
  { id: 'users', label: 'Users' },
  { id: 'reports', label: 'Reports' },
  { id: 'issues', label: 'Issues' },
  { id: 'timeLogs', label: 'Time Logs' },
];

const PROJECT_CATEGORY_OPTIONS = [
  'Video Editing',
  'Shoots',
  'Graphic',
  'Designing',
  'UI/UX Designing',
  'Photo Editing',
  'Motion Graphic Designing',
  'Content Writing',
  'Social Media Posting',
  'Reports',
  'Frontend Development',
  'Backend Development',
  'App Development',
  'Website Development',
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

function formatBudget(value?: number | null) {
  if (!value) {
    return 'Not set';
  }

  return `₹${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function getProjectOwnerNames(project?: Project | null) {
  const names = project?.owners?.map((owner) => owner.name) ?? [];
  if (project?.createdBy?.name && !names.includes(project.createdBy.name)) {
    names.unshift(project.createdBy.name);
  }
  if (!project?.createdBy?.name) names.unshift('Unknown (historical)');
  return [...new Set(names)].join(', ');
}

function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const applyCommand = (command: string, arg?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, arg);
    onChange(editor.innerHTML);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        {[
          { label: 'B', command: 'bold', className: 'font-bold' },
          { label: 'I', command: 'italic', className: 'italic' },
          { label: 'U', command: 'underline', className: 'underline' },
          { label: '• List', command: 'insertUnorderedList' },
          { label: '1. List', command: 'insertOrderedList' },
        ].map((tool) => (
          <button
            key={tool.label}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyCommand(tool.command)}
            className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 ${tool.className ?? ''}`}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={placeholder}
        onInput={(event) => onChange((event.currentTarget as HTMLDivElement).innerHTML)}
        className="min-h-30 px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none"
        data-placeholder={placeholder}
      />
    </div>
  );
}

function renderProjectMessageContent(
  message: ProjectMessage,
  onUserMention: (mention: ProjectMessageMention) => void,
  onTaskMention: (mention: ProjectMessageMention) => void,
) {
  const validMentions = (message.mentions ?? [])
    .filter((mention) => (
      Number.isInteger(mention.start) &&
      Number.isInteger(mention.end) &&
      mention.start >= 0 &&
      mention.end > mention.start &&
      mention.end <= message.content.length
    ))
    .sort((a, b) => a.start - b.start);
  const segments: React.ReactNode[] = [];
  let cursor = 0;

  validMentions.forEach((mention) => {
    if (mention.start < cursor) return;
    segments.push(message.content.slice(cursor, mention.start));
    const token = message.content.slice(mention.start, mention.end);
    const buttonClass = 'font-semibold underline decoration-current/60 underline-offset-2 hover:decoration-2';
    segments.push(mention.type === 'user' ? (
      <button key={`${mention.type}-${mention.id}-${mention.start}`} type="button" className={buttonClass} onClick={() => onUserMention(mention)}>
        {token}
      </button>
    ) : (
      <button key={`${mention.type}-${mention.id}-${mention.start}`} type="button" className={buttonClass} onClick={() => onTaskMention(mention)}>
        {token}
      </button>
    ));
    cursor = mention.end;
  });

  segments.push(message.content.slice(cursor));
  return segments;
}

export default function ProjectsWorkflowPage({ initialProjectId, dedicated = false }: { initialProjectId?: number; dedicated?: boolean } = {}) {
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
  const [showProjectCreate, setShowProjectCreate] = useState(false);
  const [showProjectEdit, setShowProjectEdit] = useState(false);
  const [projectCreateForm, setProjectCreateForm] = useState({
    projectName: '',
    startDate: '',
    endDate: '',
    clientName: '',
    category: '',
    projectType: '',
    specificTask: '',
    priority: 'MEDIUM',
    budget: '',
    remarks: '',
    finalDeliverablesLink: '',
    client: '',
    description: '',
    driveLink: '',
    managerId: role === 'MANAGER' && userId ? String(userId) : '',
    manager: role === 'MANAGER' && userId ? session.user?.name ?? '' : '',
    ownerIds: [] as string[],
    status: '',
    customerId: '',
    tags: '',
  });
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [createProjectBusy, setCreateProjectBusy] = useState(false);
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
  const [projectOwnerIdsDraft, setProjectOwnerIdsDraft] = useState<string[]>([]);

  const [managers, setManagers] = useState<Array<{ id: number; name: string; role: string }>>([]);
  const [ownerOptions, setOwnerOptions] = useState<Array<{ id: number; name: string; role: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: number; userId: number | null; name: string; email: string | null; department: string | null; designation: string | null; organization?: { id: number; name: string } }>>([]);
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
    estimatedHours: '',
  });
  const [showTimeLogEntry, setShowTimeLogEntry] = useState(false);
  const [timeLogEntries, setTimeLogEntries] = useState<Array<{
    id: number;
    employee: string;
    organization: string;
    date: string;
    task: string;
    hours: number;
    status: string;
    note: string | null;
  }>>([]);
  const [timeLogLoading, setTimeLogLoading] = useState(false);
  const [timeLogForm, setTimeLogForm] = useState({
    employee: '',
    date: new Date().toISOString().slice(0, 10),
    task: '',
    hours: '2',
    note: '',
    status: 'PENDING' as 'PENDING' | 'APPROVED' | 'REJECTED',
  });
  const [chatDraft, setChatDraft] = useState('');
  const [chatMentions, setChatMentions] = useState<ProjectMessageMention[]>([]);
  const [mentionOptions, setMentionOptions] = useState<ProjectMessageMentionOptions>({ users: [], tasks: [] });
  const [mentionMenu, setMentionMenu] = useState<MentionMenuState | null>(null);
  const [mentionedUserCard, setMentionedUserCard] = useState<MentionSuggestion | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [busy, setBusy] = useState(false);
  const searchParams = useSearchParams();
  const projectRequestId = useRef(0);

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
  const projectOwnerName = getProjectOwnerNames(projectDetails);
  const projectManagerName = projectDetails?.managerUser?.name || projectDetails?.manager || 'Unassigned';



  async function loadProjectDetails(projectId: number) {
    const requestId = ++projectRequestId.current;
    setProgress(null);
    setMessages([]);
    const details = await getProject(projectId);
    if (requestId !== projectRequestId.current) return;
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
    setProjectOwnerIdsDraft((details.owners ?? [])
      .filter((owner) => owner.id !== details.createdById)
      .map((owner) => String(owner.id)));
    setManagerSelection(details.managerId ? String(details.managerId) : '');
    if (canManageProject) {
      try {
        const pg = await getProjectProgress(projectId);
        if (requestId !== projectRequestId.current) return;
        setProgress(pg);
      } catch {
        if (requestId === projectRequestId.current) setProgress(null);
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

  useEffect(() => {
    if (!selectedProjectId || !canViewChat) {
      setMentionOptions({ users: [], tasks: [] });
      return;
    }
    let cancelled = false;
    getMessageMentionOptions(selectedProjectId)
      .then((options) => {
        if (!cancelled) setMentionOptions(options);
      })
      .catch((mentionError: unknown) => {
        if (!cancelled) {
          setMentionOptions({ users: [], tasks: [] });
          reportError(mentionError, 'Unable to load project chat mention options');
        }
      });
    return () => { cancelled = true; };
  }, [selectedProjectId, canViewChat]);

  async function refreshProjects(initialProjectId?: number | null) {
    const list = await getProjects();
    setProjects(list);

    const targetId = initialProjectId !== undefined
      ? initialProjectId
      : selectedProjectId ?? list[0]?.id ?? null;
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
    if (!dedicated || !selectedProjectId) return undefined;
    let cancelled = false;

    const refreshProjectTasks = async () => {
      try {
        const freshProject = await getProject(selectedProjectId);
        if (cancelled) return;
        setProjectDetails((current) => (
          current?.id === selectedProjectId
            ? { ...current, tasks: freshProject.tasks }
            : current
        ));
      } catch (refreshError) {
        reportError(refreshError, 'Unable to refresh project task timers');
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshProjectTasks();
    };

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [dedicated, selectedProjectId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      const usersPromise = canLoadDirectoryData
        ? apiClient<Array<{ id: number; name: string; role: string; employeeId?: number | null }>>('/users')
        : Promise.resolve([] as Array<{ id: number; name: string; role: string; employeeId?: number | null }>);
      const employeesPromise = canLoadDirectoryData
        ? apiClient<Array<{ id: number; name: string; email: string | null; department: string | null; designation: string | null; organization?: { id: number; name: string } }>>('/employees')
        : Promise.resolve([] as Array<{ id: number; name: string; email: string | null; department: string | null; designation: string | null; organization?: { id: number; name: string } }>);

      const [usersResult, employeesResult] = await Promise.allSettled([usersPromise, employeesPromise]);

      if (cancelled) return;

      if (usersResult.status === 'fulfilled') {
        setManagers(usersResult.value.filter((u) => u.role === 'MANAGER'));
        setOwnerOptions(usersResult.value.filter((u) => ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(u.role)));
      } else {
        setManagers([]);
        setOwnerOptions([]);
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

      await refreshProjects(initialProjectId);
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
  }, [canLoadDirectoryData, initialProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setTimeLogEntries([]);
      return;
    }

    void loadProjectTimeLogs(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowProjectCreate(true);
    }
  }, [searchParams]);

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
    const canLoadCustomers = ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER', 'HR', 'MANAGER'].includes(role ?? '');

    if (!canLoadCustomers) {
      setCustomerOptions([]);
      return;
    }

    getCustomers()
      .then(setCustomerOptions)
      .catch(() => setCustomerOptions([]));
  }, [role]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const visibleTasks = useMemo(() => {
    const all = projectDetails?.tasks ?? [];
    if (isEmployee && userId) {
      return all.filter((task) => (
        task.assignedToUserId === userId ||
        (employeeId != null && (
          task.assignedToId === employeeId ||
          assignedEmployees.some((employee) => employee.id === employeeId)
        ))
      ));
    }
    return all;
  }, [projectDetails?.tasks, isEmployee, userId, employeeId, assignedEmployees]);

  const selectedTask = useMemo(
    () => visibleTasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, visibleTasks],
  );

  const taskAssigneeOptions = useMemo(() => {
    const assignedEmployeeIds = new Set(assignedEmployees.map((employee) => employee.id));
    return employees.filter((employee) => assignedEmployeeIds.has(employee.id));
  }, [assignedEmployees, employees]);

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

  const timeLogSummary = useMemo(() => {
    const totalHours = timeLogEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    const approvedHours = timeLogEntries
      .filter((entry) => entry.status === 'APPROVED')
      .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    const pendingHours = timeLogEntries
      .filter((entry) => entry.status === 'PENDING')
      .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);

    return { totalHours, approvedHours, pendingHours };
  }, [timeLogEntries]);

  async function loadProjectTimeLogs(projectId: number) {
    setTimeLogLoading(true);
    try {
      const pageSize = 100;
      const firstPage = await getTimesheetsReport({ projectId, page: 1, limit: pageSize });
      const pages = await Promise.all(
        Array.from(
          { length: Math.max(0, Math.ceil(firstPage.total / pageSize) - 1) },
          (_, index) => getTimesheetsReport({ projectId, page: index + 2, limit: pageSize }),
        ),
      );
      const entries = [firstPage, ...pages].flatMap((response) => response.data);
      setTimeLogEntries(
        entries.map((entry) => ({
          id: entry.id,
          employee: entry.employee?.name ?? entry.createdByUser?.name ?? 'Unassigned',
          organization: entry.organization?.name ?? '—',
          date: entry.date,
          task: entry.task,
          hours: Number(entry.hours ?? 0),
          status: entry.status,
          note: entry.notes ?? '',
        })),
      );
    } catch (err) {
      reportError(err, 'Unable to load project time logs');
      setTimeLogEntries([]);
    } finally {
      setTimeLogLoading(false);
    }
  }

  async function onSaveTimeLogEntry() {
    if (!selectedProjectId) return;

    try {
      await createTimesheet({
        task: timeLogForm.task.trim() || selectedTask?.taskName || projectDetails?.projectName || 'Project work',
        project: projectDetails?.projectName ?? null,
        projectId: selectedProjectId,
        taskId: selectedTask?.id ?? null,
        date: timeLogForm.date,
        hours: Number(timeLogForm.hours || 0),
        status: timeLogForm.status,
        notes: timeLogForm.note.trim() || undefined,
      });

      setShowTimeLogEntry(false);
      setTimeLogForm({
        employee: '',
        date: new Date().toISOString().slice(0, 10),
        task: selectedTask?.taskName ?? '',
        hours: '2',
        note: '',
        status: 'PENDING',
      });
      await loadProjectTimeLogs(selectedProjectId);
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save time entry' });
    }
  }

  async function onProjectSelect(projectId: number) {
    if (!dedicated) {
      router.push(`/dashboard/projects/${projectId}`);
      return;
    }
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
        ownerIds: projectOwnerIdsDraft.map(Number),
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

  async function onCreateProject() {
    if (!((role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER'))) {
      setActionFeedback({ type: 'error', message: 'You do not have permission to create projects.' });
      return;
    }

    if (!projectCreateForm.projectName.trim()) {
      setActionFeedback({ type: 'error', message: 'Project name is required.' });
      return;
    }

    setCreateProjectBusy(true);
    setActionFeedback(null);

    try {
      const createdProject = await createProject({
        projectName: projectCreateForm.projectName.trim(),
        startDate: projectCreateForm.startDate || undefined,
        endDate: projectCreateForm.endDate || undefined,
        manager: projectCreateForm.manager.trim() || undefined,
        managerId: projectCreateForm.managerId ? Number(projectCreateForm.managerId) : undefined,
        ownerIds: projectCreateForm.ownerIds.map(Number),
        status: projectCreateForm.status || undefined,
        description: projectCreateForm.description.trim() || undefined,
        client: projectCreateForm.client.trim() || undefined,
        clientName: projectCreateForm.clientName.trim() || undefined,
        category: projectCreateForm.category.trim() || undefined,
        projectType: projectCreateForm.projectType || undefined,
        specificTask: projectCreateForm.specificTask.trim() || undefined,
        priority: projectCreateForm.priority || undefined,
        budget: projectCreateForm.budget ? Number(projectCreateForm.budget) : undefined,
        remarks: projectCreateForm.remarks.trim() || undefined,
        finalDeliverablesLink: projectCreateForm.finalDeliverablesLink.trim() || undefined,
        driveLink: projectCreateForm.driveLink.trim() || undefined,
        customerId: projectCreateForm.customerId ? Number(projectCreateForm.customerId) : null,
        tags: projectCreateForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });

      setProjectCreateForm({
        projectName: '',
        startDate: '',
        endDate: '',
        clientName: '',
        category: '',
        projectType: '',
        specificTask: '',
        priority: 'MEDIUM',
        budget: '',
        remarks: '',
        finalDeliverablesLink: '',
        client: '',
        description: '',
        driveLink: '',
        managerId: userId ? String(userId) : '',
        manager: isManager && userId ? session.user?.name ?? '' : '',
        ownerIds: [],
        status: '',
        customerId: '',
        tags: '',
      });

      setShowProjectCreate(false);
      await refreshProjects(createdProject.id);
      setActionFeedback({ type: 'success', message: 'Project created successfully.' });
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/dashboard/projects');
      }
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to create project.' });
    } finally {
      setCreateProjectBusy(false);
    }
  }

  async function onEditTask(taskId: number, payload: {
    taskName: string;
    category: string;
    description: string;
    links: string;
    driveLink: string;
    priority: string;
    estimatedHours: number | null;
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
      setTaskError('Selected employee does not have a linked user account.');
      return;
    }

    setTaskSubmitting(true);
    setTaskError('');
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
        dueDate: dateTimeLocalToIso(taskForm.dueDate),
        priority: taskForm.priority,
        estimatedHours: taskForm.estimatedHours ? Number(taskForm.estimatedHours) : null,
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
        estimatedHours: '',
      });
      await loadProjectDetails(selectedProjectId);
      setShowTaskForm(false);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Failed to create task.');
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

  function updateChatDraft(value: string, cursor: number) {
    const previous = chatDraft;
    let prefixLength = 0;
    while (
      prefixLength < previous.length &&
      prefixLength < value.length &&
      previous[prefixLength] === value[prefixLength]
    ) prefixLength += 1;
    let suffixLength = 0;
    while (
      suffixLength < previous.length - prefixLength &&
      suffixLength < value.length - prefixLength &&
      previous[previous.length - suffixLength - 1] === value[value.length - suffixLength - 1]
    ) suffixLength += 1;
    const oldChangeEnd = previous.length - suffixLength;
    const newChangeEnd = value.length - suffixLength;
    const delta = newChangeEnd - oldChangeEnd;
    setChatMentions((current) => current.flatMap((mention) => {
      if (mention.end <= prefixLength) return [mention];
      if (mention.start >= oldChangeEnd) {
        return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
      }
      return [];
    }));
    setChatDraft(value);

    const beforeCursor = value.slice(0, cursor);
    const match = /(^|\s)([@#])([^\s@#]*)$/.exec(beforeCursor);
    if (!match) {
      setMentionMenu(null);
      return;
    }
    const leadingSpaceLength = match[1].length;
    setMentionMenu({
      trigger: match[2] as '@' | '#',
      query: match[3],
      start: cursor - match[0].length + leadingSpaceLength,
      end: cursor,
      activeIndex: 0,
    });
  }

  const mentionSuggestions = useMemo<MentionSuggestion[]>(() => {
    if (!mentionMenu) return [];
    const query = mentionMenu.query.trim().toLocaleLowerCase();
    if (mentionMenu.trigger === '@') {
      return mentionOptions.users
        .filter((person) => !query || person.name.toLocaleLowerCase().includes(query) || person.email.toLocaleLowerCase().includes(query))
        .slice(0, 8)
        .map((person) => ({
          type: 'user',
          id: person.id,
          label: person.name,
          detail: `${person.role} · ${person.email}`,
        }));
    }
    return mentionOptions.tasks
      .filter((task) => !query || task.name.toLocaleLowerCase().includes(query))
      .slice(0, 8)
      .map((task) => ({
        type: 'task',
        id: task.id,
        label: task.name,
        detail: `Task #${task.id} · ${task.status.replaceAll('_', ' ')}`,
      }));
  }, [mentionMenu, mentionOptions]);

  function selectMention(suggestion: MentionSuggestion) {
    if (!mentionMenu) return;
    const marker = suggestion.type === 'user' ? '@' : '#';
    const token = `${marker}${suggestion.label}`;
    const nextDraft = `${chatDraft.slice(0, mentionMenu.start)}${token}${chatDraft.slice(mentionMenu.end)}`;
    const delta = token.length - (mentionMenu.end - mentionMenu.start);
    const shiftedMentions = chatMentions.flatMap((mention) => {
      if (mention.end <= mentionMenu.start) return [mention];
      if (mention.start >= mentionMenu.end) {
        return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
      }
      return [];
    });
    const nextMention: ProjectMessageMention = {
      type: suggestion.type,
      id: suggestion.id,
      label: suggestion.label,
      start: mentionMenu.start,
      end: mentionMenu.start + token.length,
    };
    setChatDraft(nextDraft);
    setChatMentions([...shiftedMentions, nextMention].sort((a, b) => a.start - b.start));
    setMentionMenu(null);
    requestAnimationFrame(() => {
      const input = chatInputRef.current;
      const caret = mentionMenu.start + token.length;
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  }

  function onChatInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionMenu && mentionSuggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setMentionMenu((menu) => menu ? {
          ...menu,
          activeIndex: (menu.activeIndex + direction + mentionSuggestions.length) % mentionSuggestions.length,
        } : menu);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        selectMention(mentionSuggestions[mentionMenu.activeIndex] ?? mentionSuggestions[0]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMentionMenu(null);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void onSendMessage();
    }
  }

  function onProjectUserMention(mention: ProjectMessageMention) {
    const person = mentionOptions.users.find((candidate) => candidate.id === mention.id);
    setMentionedUserCard({
      type: 'user',
      id: mention.id,
      label: person?.name ?? mention.label,
      detail: person ? `${person.role} · ${person.email}` : 'Project participant',
    });
  }

  function onProjectTaskMention(mention: ProjectMessageMention) {
    setMentionedUserCard(null);
    setSelectedTaskId(mention.id);
    setActiveTab('tasks');
  }

  async function onSendMessage() {
    if (!selectedProjectId || !chatDraft.trim()) return;
    setChatLoading(true);
    try {
      const leadingWhitespace = chatDraft.length - chatDraft.trimStart().length;
      const content = chatDraft.trim();
      const mentions = chatMentions
        .map((mention) => ({ ...mention, start: mention.start - leadingWhitespace, end: mention.end - leadingWhitespace }))
        .filter((mention) => mention.start >= 0 && mention.end <= content.length);
      const sent = await sendMessage(selectedProjectId, content, mentions);
      setMessages((prev) => [...prev, sent]);
      setChatDraft('');
      setChatMentions([]);
      setMentionMenu(null);
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
      {!dedicated && (
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
              onClick={() => setShowProjectCreate(true)}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              + Create Project
            </button>
          )}
        </div>
      )}

      {!dedicated && (
        <ProjectGrid
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelect={onProjectSelect}
          onDeleted={async (ids) => {
            const nextProjectId = projects.find((project) => !ids.includes(project.id))?.id ?? null;
            setProjects((current) => current.filter((project) => !ids.includes(project.id)));
            await refreshProjects(nextProjectId);
          }}
          onDeleteError={(message) => setActionFeedback({ type: 'error', message })}
        />
      )}

      {actionFeedback?.type === 'success' && <SuccessFeedback title={actionFeedback.message} />}
      {actionFeedback?.type === 'error' && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {actionFeedback.message}
        </div>
      )}

      {showProjectCreate && (
        <>
          <button
            type="button"
            aria-label="Close create project drawer"
            onClick={() => setShowProjectCreate(false)}
            className="fixed inset-0 z-40 cursor-default bg-slate-950/20"
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Project settings</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Create project</h2>
              </div>
              <button type="button" onClick={() => setShowProjectCreate(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-900" aria-label="Close create project drawer">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-7">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Identity</p>
                  <div className="space-y-3">
                    <input value={projectCreateForm.projectName} onChange={(event) => setProjectCreateForm((current) => ({ ...current, projectName: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Project name" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input value={projectCreateForm.clientName} onChange={(event) => setProjectCreateForm((current) => ({ ...current, clientName: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Client name" />
                      <select value={projectCreateForm.category} onChange={(event) => setProjectCreateForm((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                        <option value="">Category</option>
                        {PROJECT_CATEGORY_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select value={projectCreateForm.projectType} onChange={(event) => setProjectCreateForm((current) => ({ ...current, projectType: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                        <option value="">Project type</option>
                        <option value="EVENT_MANAGEMENT">Event management</option>
                        <option value="PRODUCTION_EM">Production EM</option>
                        <option value="DIGITAL_MARKETING">Digital marketing</option>
                        <option value="PRODUCTION_DM">Production DM</option>
                        <option value="PRODUCTION_OTHER">Production other</option>
                        <option value="TECH_PROJECTS">Tech projects</option>
                      </select>
                      <input value={projectCreateForm.client} onChange={(event) => setProjectCreateForm((current) => ({ ...current, client: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Client reference" />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Schedule and priority</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input type="date" value={projectCreateForm.startDate} onChange={(event) => setProjectCreateForm((current) => ({ ...current, startDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                    <input type="date" value={projectCreateForm.endDate} onChange={(event) => setProjectCreateForm((current) => ({ ...current, endDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                    <select value={projectCreateForm.priority} onChange={(event) => setProjectCreateForm((current) => ({ ...current, priority: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                    <input type="number" min="0" value={projectCreateForm.budget} onChange={(event) => setProjectCreateForm((current) => ({ ...current, budget: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Budget" />
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Ownership</p>
                  <div className="space-y-3">
                    <select value={projectCreateForm.managerId} onChange={(event) => setProjectCreateForm((current) => ({ ...current, managerId: event.target.value, manager: managers.find((manager) => String(manager.id) === event.target.value)?.name ?? current.manager }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                      <option value="">Assign manager</option>
                      {managers.map((manager) => (
                        <option key={manager.id} value={String(manager.id)}>{manager.name}</option>
                      ))}
                    </select>
                    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                      <span>Additional owners</span>
                      <select multiple value={projectCreateForm.ownerIds} onChange={(event) => {
                        const ownerIds = Array.from(event.currentTarget.selectedOptions, (option) => option.value);
                        setProjectCreateForm((current) => ({ ...current, ownerIds }));
                      }} className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                        {ownerOptions.map((owner) => (
                          <option key={owner.id} value={String(owner.id)}>{owner.name}</option>
                        ))}
                      </select>
                    </label>
                    <select value={projectCreateForm.customerId} onChange={(event) => setProjectCreateForm((current) => ({ ...current, customerId: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                      <option value="">No customer linked</option>
                      {customerOptions.map((customer) => (
                        <option key={customer.id} value={String(customer.id)}>{customer.customerName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Details</p>
                  <div className="space-y-3">
                    <input value={projectCreateForm.specificTask} onChange={(event) => setProjectCreateForm((current) => ({ ...current, specificTask: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Primary project task" />
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Project description</label>
                      <RichTextEditor value={projectCreateForm.description} onChange={(value) => setProjectCreateForm((current) => ({ ...current, description: value }))} placeholder="Project description" />
                    </div>
                    <textarea value={projectCreateForm.remarks} onChange={(event) => setProjectCreateForm((current) => ({ ...current, remarks: event.target.value }))} rows={3} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Remarks" />
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Links</p>
                  <div className="space-y-3">
                    <input value={projectCreateForm.driveLink} onChange={(event) => setProjectCreateForm((current) => ({ ...current, driveLink: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Google Drive link" />
                    <input value={projectCreateForm.finalDeliverablesLink} onChange={(event) => setProjectCreateForm((current) => ({ ...current, finalDeliverablesLink: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Final deliverables link" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={() => setShowProjectCreate(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="button" disabled={createProjectBusy} onClick={onCreateProject} className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{createProjectBusy ? 'Creating...' : 'Create project'}</button>
            </div>
          </aside>
        </>
      )}

      {showTimeLogEntry && (
        <>
          <button
            type="button"
            aria-label="Close time log drawer"
            onClick={() => setShowTimeLogEntry(false)}
            className="fixed inset-0 z-40 cursor-default bg-slate-950/20"
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Timesheet</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Add time entry</h2>
              </div>
              <button type="button" onClick={() => setShowTimeLogEntry(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-900" aria-label="Close time log drawer">×</button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Employee</label>
                <select
                  value={timeLogForm.employee}
                  onChange={(event) => setTimeLogForm((current) => ({ ...current, employee: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.name}>{employee.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date</label>
                  <input
                    type="date"
                    value={timeLogForm.date}
                    onChange={(event) => setTimeLogForm((current) => ({ ...current, date: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hours</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={timeLogForm.hours}
                    onChange={(event) => setTimeLogForm((current) => ({ ...current, hours: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Task</label>
                <input
                  value={timeLogForm.task}
                  onChange={(event) => setTimeLogForm((current) => ({ ...current, task: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Task or activity"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</label>
                <select
                  value={timeLogForm.status}
                  onChange={(event) => setTimeLogForm((current) => ({ ...current, status: event.target.value as 'PENDING' | 'APPROVED' | 'REJECTED' }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                >
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</label>
                <textarea
                  value={timeLogForm.note}
                  onChange={(event) => setTimeLogForm((current) => ({ ...current, note: event.target.value }))}
                  rows={4}
                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="What was done during this time?"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={() => setShowTimeLogEntry(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="button"
                onClick={onSaveTimeLogEntry}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Save entry
              </button>
            </div>
          </aside>
        </>
      )}

      {dedicated && projectDetails && (
        <>
        <section className="-mx-6 -mt-6 min-h-screen bg-white px-6 pb-10 pt-5">
          <div className="mb-6 flex items-center justify-between">
            <button type="button" onClick={() => router.push('/dashboard/projects')} className="text-sm font-semibold text-slate-500 hover:text-slate-900">
              ← Back to Projects
            </button>
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Project workspace</span>
          </div>

          <div className="border-b border-slate-200 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{projectDetails.projectName}</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Project ID {projectDetails.id} · {projectDetails.clientName ?? projectDetails.client ?? 'No client'} · Owner: {projectOwnerName} · Managed by: {projectManagerName}
                </p>
                {projectDetails.managerId != null && (
                  <p className="mt-1 text-xs text-slate-500">
                    Manager assigned by {projectDetails.managerAssignedBy?.name ?? 'Unknown (historical)'}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{projectDetails.status.replaceAll('_', ' ')}</span>
                  {projectDetails.priority && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{projectDetails.priority} priority</span>}
                  <span className="text-slate-400">Due {formatDate(projectDetails.deadline ?? projectDetails.endDate)}</span>
                </div>
              </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 shadow-sm ring-1 ring-slate-100">
                {canManageProject && (
                  <button
                    type="button"
                    onClick={() => setShowProjectEdit(true)}
                    title="Edit project"
                    aria-label="Edit project"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden="true">
                      <path d="M12 20h9" strokeLinecap="round" />
                      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}

                {isAdmin && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Manager</label>
                    <select
                      value={managerSelection}
                      onChange={(e) => setManagerSelection(e.target.value)}
                      className="min-w-42.5 border-0 bg-transparent pr-1 text-sm font-medium text-slate-700 outline-none"
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
                      className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Assign
                    </button>
                  </div>
                )}

                {canManageProject && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Status</label>
                    <select
                      value={projectDetails.status}
                      onChange={(e) => onUpdateProjectStatus(e.target.value)}
                      className="min-w-37.5 border-0 bg-transparent pr-1 text-sm font-medium text-slate-700 outline-none"
                    >
                      <option value="NOT_STARTED">Not started</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="IN_APPROVAL">In approval</option>
                      <option value="BLOCKED_CANCELLED">Blocked / cancelled</option>
                      <option value="POSTPONED">Postponed</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                )}

                {canManageProject && projectDetails.status !== 'COMPLETED' && (
                  <button
                    onClick={onMarkAsComplete}
                    disabled={busy}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          </div>

          {projectDetails.status === 'COMPLETED' && (
            <SuccessFeedback
              className="mb-4"
              title="Project completed successfully"
              description="All project work has been marked complete."
            />
          )}

          </div>

          <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200 py-3">
            {tabs
              .filter((tab) => !(tab.id === 'chat' && !canViewChat))
              .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-slate-950'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid gap-8 border-b border-slate-200 pb-6 md:grid-cols-[1fr_0.8fr]">
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-700">Project summary</span>
                  </div>
                  <div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                    <p><span className="text-slate-400">Client</span><br /><span className="font-medium text-slate-800">{projectDetails.clientName ?? projectDetails.client ?? 'Not set'}</span></p>
                    <p><span className="text-slate-400">Project type</span><br /><span className="font-medium text-slate-800">{projectDetails.projectType?.replaceAll('_', ' ') ?? 'Not set'}</span></p>
                    <p><span className="text-slate-400">Start date</span><br /><span className="font-medium text-slate-800">{formatDate(projectDetails.startDate)}</span></p>
                    <p><span className="text-slate-400">Deadline</span><br /><span className="font-medium text-slate-800">{formatDate(projectDetails.deadline ?? projectDetails.endDate)}</span></p>
                  </div>
                </div>
                <div>
                  <div className="mb-4 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">Progress</span>
                    <span className="font-semibold text-slate-900">{progress ? `${progress.progressPercent}%` : 'N/A'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-orange-500" style={{ width: `${progress ? Math.max(0, Math.min(100, progress.progressPercent)) : 0}%` }} />
                  </div>
                  {progress && <p className="mt-3 text-sm text-slate-500">{progress.totalTasks} task{progress.totalTasks === 1 ? '' : 's'} · {progress.completedTasks} completed</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="border-b border-slate-200 pb-5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Summary</p>
                  </div>
                  <div
                    className="prose prose-sm max-w-none text-sm text-slate-700"
                    dangerouslySetInnerHTML={{ __html: projectDetails.description || '<p>No description available.</p>' }}
                  />
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
                    <p>Owner: {projectOwnerName}</p>
                    <p>Managed by: {projectManagerName}</p>
                    {projectDetails.managerId != null && (
                      <p>Manager assigned by: {projectDetails.managerAssignedBy?.name ?? 'Unknown (historical)'}</p>
                    )}
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
                </div>

                <div className="border-b border-slate-200 pb-5">
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
                </div>
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
                  {taskError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{taskError}</div>}
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
                      <option value="">{taskAssigneeOptions.length ? 'Assign to employee' : 'Add team members in Users first'}</option>
                      {taskAssigneeOptions.map((employee) => (
                        <option key={employee.id} value={employee.id} disabled={!employee.userId}>
                          {employee.name}{[employee.organization?.name, employee.department].filter(Boolean).length ? ` · ${[employee.organization?.name, employee.department].filter(Boolean).join(' · ')}` : ''}{employee.userId ? '' : ' · No user account'}
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
                    {PROJECT_CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <div className="md:col-span-2">
                    <RichTextEditor value={taskForm.description} onChange={(value) => setTaskForm((prev) => ({ ...prev, description: value }))} placeholder="Describe what the employee needs to do. Include steps, context, and any reference materials." />
                  </div>
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
                  <div className="grid gap-3 md:grid-cols-4">
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
                      type="number"
                      min="0.01"
                      step="0.25"
                      value={taskForm.estimatedHours}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, estimatedHours: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Estimate (hours)"
                    />
                    <input
                      type="datetime-local"
                      aria-label="Task deadline date and time"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-slate-500">Deadline time uses your device&apos;s local timezone.</p>
                    <button
                      disabled={taskSubmitting}
                      className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {taskSubmitting ? 'Saving…' : 'Assign Task'}
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto border-y border-slate-200 bg-white">
                {visibleTasks.length === 0 && (
                  <div className="flex min-h-40 items-center justify-center px-4 py-10 text-center">
                    <div>
                      <div className="mb-2 text-2xl">📋</div>
                      <p className="text-sm text-slate-500">No tasks here</p>
                    </div>
                  </div>
                )}
                {visibleTasks.length > 0 && (
                  <table className="min-w-max border-collapse text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        {['ID', 'Task Name', 'Owner', 'Start Date', 'Due Date', 'Duration', 'Priority', 'Completion', 'Time Logs', 'Status'].map((heading, index) => (
                          <th key={heading} className={`whitespace-nowrap border-b border-slate-200 px-4 py-3 ${index < 2 ? 'sticky z-10 bg-slate-50' : ''}`}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleTasks.map((task) => {
                        const status = task.status?.toUpperCase() ?? 'PENDING';
                        const priority = (task.priority?.toUpperCase() ?? 'LOW') as keyof typeof taskPriorityClass;
                        const due = task.dueDate ? new Date(task.dueDate) : null;
                        const start = task.startDate ? new Date(task.startDate) : null;
                        const days = due ? Math.ceil((due.getTime() - currentTime) / 86400000) : null;
                        const completion = task.completionPercent ?? (status === 'APPROVED' ? 100 : status === 'SUBMITTED' ? 80 : status === 'IN_PROGRESS' ? 55 : 0);
                        return (
                          <tr key={task.id} onClick={() => setSelectedTaskId(task.id)} className="cursor-pointer transition hover:bg-orange-50/50">
                            <td className="sticky left-0 z-10 bg-white px-4 py-3 text-slate-500">#{task.id}</td>
                            <td className="sticky left-14 z-10 bg-white px-4 py-3 font-semibold text-slate-900">{task.taskName}</td>
                            <td className="px-4 py-3 text-slate-600">{task.assignedToUser?.name ?? 'Unassigned'}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">{start ? formatDate(task.startDate) : '—'}</td>
                            <td className={`whitespace-nowrap px-4 py-3 ${days != null && days < 0 && status !== 'APPROVED' ? 'font-semibold text-rose-600' : 'text-slate-600'}`}>
                              {due ? <>{formatDateTime(task.dueDate)} {days !== null && <span className="text-xs">({days === 0 ? 'today' : days > 0 ? `${days} days left` : `${Math.abs(days)} days overdue`})</span>}</> : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{start && due ? `${Math.max(1, Math.ceil((due.getTime() - start.getTime()) / 86400000) + 1)} days` : '—'}</td>
                            <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${taskPriorityClass[priority] ?? taskPriorityClass.LOW}`}>{priority}</span></td>
                            <td className="min-w-32 px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-orange-500" style={{ width: `${Math.max(0, Math.min(100, completion))}%` }} /></div><span className="text-xs text-slate-600">{completion}%</span></div></td>
                            <td className="px-4 py-3">
                              <TaskTimerSessionsCell
                                taskId={task.id}
                                estimateHours={task.estimatedHours}
                                actualHours={task.actualHours}
                                sessions={task.timerSessions}
                                legacyTimerTotalSeconds={task.legacyTimerTotalSeconds}
                                currentUserId={userId}
                                canControl={role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR' || role === 'MANAGER' || role === 'EMPLOYEE'}
                              />
                            </td>
                            <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${taskStatusClass[status] ?? 'bg-slate-200 text-slate-700'}`}>{status.replace('_', ' ')}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <TaskDetailPanel
                key={selectedTask?.id ?? 'none'}
                task={selectedTask as TaskPanelData | null}
                open={Boolean(selectedTask)}
                role={role}
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
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                            {renderProjectMessageContent(message, onProjectUserMention, onProjectTaskMention)}
                          </p>
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
              {mentionedUserCard && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{mentionedUserCard.label}</p>
                    <p className="truncate text-xs text-slate-500">{mentionedUserCard.detail}</p>
                  </div>
                  <button type="button" aria-label="Close mentioned user details" onClick={() => setMentionedUserCard(null)} className="px-2 py-1 text-sm text-slate-500 hover:text-slate-900">×</button>
                </div>
              )}
              <div className="relative mt-4 flex items-end gap-2">
                {mentionMenu && mentionSuggestions.length > 0 && (
                  <div role="listbox" aria-label={mentionMenu.trigger === '@' ? 'Mention a project participant' : 'Mention a project task'} className="absolute bottom-full left-0 z-20 mb-2 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {mentionSuggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.type}-${suggestion.id}`}
                        type="button"
                        role="option"
                        aria-selected={index === mentionMenu.activeIndex}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectMention(suggestion)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${index === mentionMenu.activeIndex ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                      >
                        <span className="truncate text-sm font-medium text-slate-900">{mentionMenu.trigger}{suggestion.label}</span>
                        <span className="truncate text-xs text-slate-500">{suggestion.detail}</span>
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  ref={chatInputRef}
                  value={chatDraft}
                  rows={2}
                  onChange={(event) => updateChatDraft(event.target.value, event.currentTarget.selectionStart)}
                  onKeyDown={onChatInputKeyDown}
                  className="min-h-11 max-h-32 flex-1 resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Write a message. Use @ for people or # for tasks."
                  aria-label="Write a project chat message"
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

          {activeTab === 'reports' && (
            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task completion</p><p className="mt-2 text-3xl font-semibold text-slate-900">{progress?.progressPercent ?? 0}%</p></article>
              <article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total tasks</p><p className="mt-2 text-3xl font-semibold text-slate-900">{progress?.totalTasks ?? projectDetails.tasks?.length ?? 0}</p></article>
              <article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed</p><p className="mt-2 text-3xl font-semibold text-emerald-600">{progress?.completedTasks ?? 0}</p></article>
            </section>
          )}

          {activeTab === 'issues' && (
            <section className="rounded-xl border border-slate-200 bg-white p-6"><h3 className="text-base font-semibold text-slate-900">Issues</h3><p className="mt-2 text-sm text-slate-500">Issue tracking is ready for the project workspace. No issue records are linked to this project yet.</p></section>
          )}

          {activeTab === 'timeLogs' && (
            <section className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Time Log</h3>
                  <p className="mt-1 text-sm text-slate-500">Track hours and approval status for this project.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTimeLogEntry(true)}
                  disabled={timeLogLoading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {timeLogLoading ? 'Loading...' : '+ Add entry'}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total hours</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{timeLogSummary.totalHours.toFixed(1)}h</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approved</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-600">{timeLogSummary.approvedHours.toFixed(1)}h</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-600">{timeLogSummary.pendingHours.toFixed(1)}h</p>
                </article>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h4 className="text-sm font-semibold text-slate-800">Recent entries</h4>
                  <button type="button" className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                    Filter
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {timeLogEntries.map((entry) => (
                    <div key={entry.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                          {entry.employee.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{entry.employee}</p>
                            <span className="text-xs text-slate-400">{new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                          <p className="text-xs text-slate-500">{entry.organization}</p>
                          <p className="mt-0.5 text-sm text-slate-600">{entry.task}</p>
                          <p className="mt-1 text-xs text-slate-500">{entry.note}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:justify-end">
                        <span className="text-sm font-semibold text-slate-800">{Number(entry.hours).toFixed(1)}h</span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          entry.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : entry.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'users' && (
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
                              {[employee.organization?.name, employee.department, employee.designation].filter(Boolean).join(' · ') || employee.email || 'Employee'}
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

        {showProjectEdit && (
          <>
            <button
              type="button"
              aria-label="Close project editor"
              onClick={() => setShowProjectEdit(false)}
              className="fixed inset-0 z-40 cursor-default bg-slate-950/20"
            />
            <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Project settings</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">Edit project</h2>
                </div>
                <button type="button" onClick={() => setShowProjectEdit(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-900" aria-label="Close project editor">×</button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-7">
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Identity</p>
                    <div className="space-y-3">
                      <input value={projectNameDraft} onChange={(event) => setProjectNameDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Project name" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input value={projectClientNameDraft} onChange={(event) => setProjectClientNameDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Client name" />
                        <select value={projectCategoryDraft} onChange={(event) => setProjectCategoryDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                          <option value="">Category</option>
                          {PROJECT_CATEGORY_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select value={projectTypeDraft} onChange={(event) => setProjectTypeDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                          <option value="">Project type</option>
                          <option value="EVENT_MANAGEMENT">Event management</option>
                          <option value="PRODUCTION_EM">Production EM</option>
                          <option value="DIGITAL_MARKETING">Digital marketing</option>
                          <option value="PRODUCTION_DM">Production DM</option>
                          <option value="PRODUCTION_OTHER">Production other</option>
                          <option value="TECH_PROJECTS">Tech projects</option>
                        </select>
                        <input value={projectClientDraft} onChange={(event) => setProjectClientDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Client reference" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Schedule and priority</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input type="date" value={projectStartDateDraft} onChange={(event) => setProjectStartDateDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                      <input type="date" value={projectEndDateDraft} onChange={(event) => setProjectEndDateDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                      <select value={projectPriorityDraft} onChange={(event) => setProjectPriorityDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                        <option value="">Priority</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>
                      <input type="number" min="0" value={projectBudgetDraft} onChange={(event) => setProjectBudgetDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Budget" />
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Ownership</p>
                    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                      <span>Additional owners</span>
                      <select multiple value={projectOwnerIdsDraft} onChange={(event) => setProjectOwnerIdsDraft(Array.from(event.currentTarget.selectedOptions, (option) => option.value))} className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                        {ownerOptions.map((owner) => (
                          <option key={owner.id} value={String(owner.id)}>{owner.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Details</p>
                    <div className="space-y-3">
                      <input value={projectSpecificTaskDraft} onChange={(event) => setProjectSpecificTaskDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Primary project task" />
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Project description</label>
                        <RichTextEditor value={projectDescriptionDraft} onChange={setProjectDescriptionDraft} placeholder="Project description" />
                      </div>
                      <textarea value={projectRemarksDraft} onChange={(event) => setProjectRemarksDraft(event.target.value)} rows={3} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Remarks" />
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Links</p>
                    <div className="space-y-3">
                      <input value={projectDriveLinkDraft} onChange={(event) => setProjectDriveLinkDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Google Drive link" />
                      <input value={projectFinalDeliverablesDraft} onChange={(event) => setProjectFinalDeliverablesDraft(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Final deliverables link" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button type="button" onClick={() => setShowProjectEdit(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="button" disabled={busy} onClick={onSaveProjectEdit} className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving...' : 'Save changes'}</button>
              </div>
            </aside>
          </>
        )}
        </>
      )}
    </div>
  );
}
