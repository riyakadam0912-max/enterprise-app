'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  assignProjectManager,
  getProject,
  getProjectProgress,
  getProjects,
  type Project,
  type ProjectProgress,
  updateProjectStatus,
} from '@/api/projectsApi';
import { createTask, reviewTask, submitTaskWork, updateTaskStatus } from '@/api/tasksApi';
import { apiClient } from '@/api/apiClient';

type DashboardRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
type ProjectTab = 'overview' | 'tasks' | 'team';

const tabs: Array<{ id: ProjectTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'team', label: 'Team' },
];

const taskStatusClass: Record<string, string> = {
  PENDING: 'bg-slate-200 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
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

function parseCurrentUser() {
  if (typeof window === 'undefined') {
    return { role: 'EMPLOYEE' as DashboardRole, userId: null as number | null };
  }

  const role = (localStorage.getItem('role') ?? 'EMPLOYEE') as DashboardRole;
  try {
    const raw = localStorage.getItem('currentUser');
    const user = raw ? (JSON.parse(raw) as { id?: number }) : null;
    return { role, userId: user?.id ?? null };
  } catch {
    return { role, userId: null };
  }
}

export default function ProjectsWorkflowPage() {
  const router = useRouter();
  const [{ role, userId }] = useState(parseCurrentUser);
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectDetails, setProjectDetails] = useState<Project | null>(null);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const [managers, setManagers] = useState<Array<{ id: number; name: string; role: string }>>([]);
  const [assignableUsers, setAssignableUsers] = useState<Array<{ id: number; name: string; role: string; managerId?: number | null }>>([]);

  const [managerSelection, setManagerSelection] = useState('');
  const [taskForm, setTaskForm] = useState({
    taskName: '',
    description: '',
    assignedToUserId: '',
    dueDate: '',
    priority: 'Medium',
  });
  const [submitForms, setSubmitForms] = useState<Record<number, { submissionLink: string; note: string }>>({});
  const [reviewForms, setReviewForms] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const isAdmin = role === 'ADMIN';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  const canManageProject = isAdmin || isManager;

  async function loadProjectDetails(projectId: number) {
    setProgress(null);
    const details = await getProject(projectId);
    setProjectDetails(details);
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

  async function refreshProjects(initialProjectId?: number) {
    const list = await getProjects();
    setProjects(list);

    const targetId = initialProjectId ?? selectedProjectId ?? list[0]?.id ?? null;
    setSelectedProjectId(targetId);
    if (targetId) {
      await loadProjectDetails(targetId);
    } else {
      setProjectDetails(null);
      setProgress(null);
    }
  }

  useEffect(() => {
    Promise.all([
      apiClient<Array<{ id: number; name: string; role: string }>>('/users').catch(() => []),
      apiClient<Array<{ id: number; name: string; role: string; managerId?: number | null }>>('/users/assignable').catch(() => []),
    ])
      .then(async ([users, assignable]) => {
        setManagers(users.filter((u) => u.role === 'MANAGER'));
        if (isManager && userId) {
          setAssignableUsers(assignable.filter((u) => u.role === 'EMPLOYEE' && u.managerId === userId));
        } else if (isAdmin) {
          setAssignableUsers(assignable.filter((u) => u.role !== 'ADMIN'));
        } else {
          setAssignableUsers([]);
        }
        await refreshProjects();
      })
      .catch(() => setError('Failed to load projects module'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleTasks = useMemo(() => {
    const all = projectDetails?.tasks ?? [];
    if (isEmployee && userId) {
      return all.filter((task) => task.assignedToUserId === userId);
    }
    return all;
  }, [projectDetails?.tasks, isEmployee, userId]);

  async function onProjectSelect(projectId: number) {
    setSelectedProjectId(projectId);
    await loadProjectDetails(projectId);
  }

  async function onAssignManager() {
    if (!selectedProjectId || !managerSelection) return;
    if (Number(managerSelection) === projectDetails?.managerId) {
      setActionMessage('Selected manager is already assigned to this project.');
      return;
    }
    setBusy(true);
    setActionMessage('');
    try {
      await assignProjectManager(selectedProjectId, Number(managerSelection));
      await refreshProjects(selectedProjectId);
      setActionMessage('Project manager updated successfully.');
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to assign manager');
    } finally {
      setBusy(false);
    }
  }

  async function onUpdateProjectStatus(status: 'ACTIVE' | 'COMPLETED') {
    if (!selectedProjectId) return;
    setBusy(true);
    setActionMessage('');
    try {
      await updateProjectStatus(selectedProjectId, status);
      await refreshProjects(selectedProjectId);
      setActionMessage(`Project status updated to ${status}.`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to update project status');
    } finally {
      setBusy(false);
    }
  }

  async function onMarkAsComplete() {
    if (!selectedProjectId) return;
    setBusy(true);
    setActionMessage('');
    try {
      await updateProjectStatus(selectedProjectId, 'COMPLETED');
      await refreshProjects(selectedProjectId);
      setActionMessage('Project marked as complete.');
      if (typeof window !== 'undefined') {
        window.alert('Project marked as complete.');
      }
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to update project status');
    } finally {
      setBusy(false);
    }
  }

  async function onAssignTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId || !taskForm.taskName.trim() || !taskForm.assignedToUserId) return;

    setBusy(true);
    try {
      await createTask({
        taskName: taskForm.taskName.trim(),
        description: taskForm.description.trim() || null,
        projectId: selectedProjectId,
        assignedToUserId: Number(taskForm.assignedToUserId),
        dueDate: taskForm.dueDate || null,
        priority: taskForm.priority,
        status: 'PENDING',
      });
      setTaskForm({
        taskName: '',
        description: '',
        assignedToUserId: '',
        dueDate: '',
        priority: 'Medium',
      });
      await loadProjectDetails(selectedProjectId);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitTask(taskId: number) {
    const form = submitForms[taskId];
    if (!form?.submissionLink || !form?.note) return;

    setBusy(true);
    try {
      await submitTaskWork(taskId, {
        submissionLink: form.submissionLink,
        note: form.note,
      });
      if (selectedProjectId) {
        await loadProjectDetails(selectedProjectId);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onReviewTask(taskId: number, decision: 'APPROVED' | 'REJECTED') {
    setBusy(true);
    try {
      await reviewTask(taskId, {
        decision,
        comment: reviewForms[taskId]?.trim() || undefined,
      });
      if (selectedProjectId) {
        await loadProjectDetails(selectedProjectId);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onMoveToInProgress(taskId: number) {
    setBusy(true);
    try {
      await updateTaskStatus(taskId, 'IN_PROGRESS');
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
        {isAdmin && (
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
              <p className="font-semibold text-slate-900">{project.projectName}</p>
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

      {actionMessage && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {actionMessage}
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
                  onChange={(e) => onUpdateProjectStatus(e.target.value as 'ACTIVE' | 'COMPLETED')}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              )}
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-100 pb-3">
            {tabs.map((tab) => (
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
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Project Summary</p>
                  <p className="text-sm text-slate-700">{projectDetails.description ?? 'No description available.'}</p>
                  <div className="mt-4 space-y-1 text-sm text-slate-600">
                    <p>Start: {formatDate(projectDetails.startDate)}</p>
                    <p>Deadline: {formatDate(projectDetails.deadline ?? projectDetails.endDate)}</p>
                    <p>Status: {projectDetails.status}</p>
                    <p>Budget: {formatBudget(projectDetails.budget)}</p>
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
              {canManageProject && (
                <form onSubmit={onAssignTask} className="grid gap-2 md:grid-cols-2">
                  <input
                    value={taskForm.taskName}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, taskName: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Task title"
                  />
                  <select
                    value={taskForm.assignedToUserId}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, assignedToUserId: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Assign to employee</option>
                    {assignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                  <input
                    value={taskForm.description}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    placeholder="Task description"
                  />
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                      <option>Critical</option>
                    </select>
                    <button
                      disabled={busy}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Assign Task
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {visibleTasks.length === 0 && (
                  <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                    <div>
                      <div className="mb-2 text-2xl">📋</div>
                      <p className="text-sm font-medium text-slate-500">No tasks assigned to this project yet.</p>
                    </div>
                  </div>
                )}
                {visibleTasks.map((task) => {
                  const status = task.status?.toUpperCase() ?? 'PENDING';
                  const canSubmitThisTask = isEmployee && task.assignedToUserId === userId;
                  return (
                    <article key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{task.taskName}</p>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${taskStatusClass[status] ?? 'bg-slate-200 text-slate-700'}`}>
                          {status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{task.notes ?? 'No description'}</p>
                      <p className="mt-2 text-xs text-slate-500">Assigned to: {task.assignedToUser?.name ?? 'N/A'}</p>
                      <p className="text-xs text-slate-500">Due: {formatDate(task.dueDate)}</p>

                      {task.submissionLink && (
                        <a href={task.submissionLink} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-medium text-blue-600 hover:underline">
                          View submitted work
                        </a>
                      )}

                      {task.reviewComment && (
                        <p className={`mt-2 text-xs ${status === 'REJECTED' ? 'text-rose-600' : 'text-slate-600'}`}>
                          Feedback: {task.reviewComment}
                        </p>
                      )}

                      {canSubmitThisTask && (status === 'PENDING' || status === 'IN_PROGRESS' || status === 'REJECTED') && (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <input
                            value={submitForms[task.id]?.submissionLink ?? ''}
                            onChange={(e) =>
                              setSubmitForms((prev) => ({
                                ...prev,
                                [task.id]: { submissionLink: e.target.value, note: prev[task.id]?.note ?? '' },
                              }))
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Submission URL"
                          />
                          <input
                            value={submitForms[task.id]?.note ?? ''}
                            onChange={(e) =>
                              setSubmitForms((prev) => ({
                                ...prev,
                                [task.id]: { submissionLink: prev[task.id]?.submissionLink ?? '', note: e.target.value },
                              }))
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Work note"
                          />
                          <div className="md:col-span-2 flex gap-2">
                            <button
                              onClick={() => onSubmitTask(task.id)}
                              disabled={busy}
                              className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Submit Work
                            </button>
                            <button
                              onClick={() => onMoveToInProgress(task.id)}
                              disabled={busy}
                              className="rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Mark In Progress
                            </button>
                          </div>
                        </div>
                      )}

                      {canManageProject && status === 'SUBMITTED' && (
                        <div className="mt-3 space-y-2">
                          <input
                            value={reviewForms[task.id] ?? ''}
                            onChange={(e) => setReviewForms((prev) => ({ ...prev, [task.id]: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Review comment"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => onReviewTask(task.id, 'APPROVED')}
                              disabled={busy}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => onReviewTask(task.id, 'REJECTED')}
                              disabled={busy}
                              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Reject and Reassign
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-2">
              {(projectDetails.teamMembers ?? []).length === 0 && (
                <p className="text-sm text-slate-500">No team members found under this manager yet.</p>
              )}
              {(projectDetails.teamMembers ?? []).map((member) => (
                <div key={member.id} className="rounded-lg border border-slate-100 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
