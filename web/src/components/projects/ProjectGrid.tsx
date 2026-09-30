'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Project } from '@/api/projectsApi';
import { deleteProject } from '@/api/projectsApi';

type GridColumn = { key: string; label: string; width: number; getValue: (project: Project) => string };

const DEFAULT_COLUMNS: GridColumn[] = [
  { key: 'id', label: 'ID', width: 72, getValue: (project) => String(project.id) },
  { key: 'projectName', label: 'Project Name', width: 240, getValue: (project) => project.projectName },
  { key: 'customer', label: 'Customer', width: 180, getValue: (project) => project.customer?.customerName ?? project.clientName ?? project.client ?? 'Unlinked' },
  { key: 'owner', label: 'Owner', width: 160, getValue: (project) => project.owner?.name ?? project.managerUser?.name ?? project.manager ?? 'Unassigned' },
  { key: 'managerAssignedBy', label: 'Manager assigned by', width: 190, getValue: (project) => project.managerAssignedBy?.name ?? (project.managerId ? 'Unknown (historical)' : '—') },
  { key: 'status', label: 'Status', width: 150, getValue: (project) => project.status.replaceAll('_', ' ') },
  { key: 'tasks', label: 'Tasks', width: 90, getValue: (project) => String(project.tasksCount ?? project._count?.tasks ?? project.tasks?.length ?? 0) },
  { key: 'phases', label: 'Phases', width: 90, getValue: () => '0' },
  { key: 'issues', label: 'Issues', width: 90, getValue: () => '0' },
  { key: 'startDate', label: 'Start Date', width: 130, getValue: (project) => project.startDate ? new Date(project.startDate).toLocaleDateString() : '—' },
  { key: 'endDate', label: 'End Date', width: 130, getValue: (project) => project.endDate ? new Date(project.endDate).toLocaleDateString() : '—' },
  { key: 'tags', label: 'Tags', width: 150, getValue: (project) => project.tags?.join(', ') || '—' },
];

const statusClass: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  BLOCKED_CANCELLED: 'bg-rose-50 text-rose-700',
  IN_APPROVAL: 'bg-amber-50 text-amber-700',
};

const defaultVisibleState = () =>
  Object.fromEntries(DEFAULT_COLUMNS.map((column) => [column.key, true]));

const defaultWidthsState = () =>
  Object.fromEntries(DEFAULT_COLUMNS.map((column) => [column.key, column.width]));

const getSavedTablePreferences = () => {
  if (typeof window === 'undefined') {
    return { visible: defaultVisibleState(), widths: defaultWidthsState() };
  }

  try {
    const saved = JSON.parse(localStorage.getItem('erp-table-preferences:projects') ?? '{}') as {
      visible?: Record<string, boolean>;
      widths?: Record<string, number>;
    };

    return {
      visible: saved.visible ?? defaultVisibleState(),
      widths: saved.widths ?? defaultWidthsState(),
    };
  } catch {
    return { visible: defaultVisibleState(), widths: defaultWidthsState() };
  }
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-slate-400">
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16L21 21" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M4 6H20" strokeLinecap="round" />
      <path d="M7 12H17" strokeLinecap="round" />
      <path d="M10 18H14" strokeLinecap="round" />
    </svg>
  );
}

export function ProjectGrid({ projects, selectedProjectId, onSelect, onDeleted, onDeleteError }: { projects: Project[]; selectedProjectId: number | null; onSelect: (id: number) => void; onDeleted?: (ids: number[]) => void | Promise<void>; onDeleteError?: (message: string) => void }) {
  const initialPreferences = useMemo(() => getSavedTablePreferences(), []);
  const [visible, setVisible] = useState<Record<string, boolean>>(initialPreferences.visible);
  const [widths, setWidths] = useState<Record<string, number>>(initialPreferences.widths);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const statusOptions = ['ALL', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED_CANCELLED', 'IN_APPROVAL'];

  useEffect(() => {
    if (Object.keys(visible).length > 0) localStorage.setItem('erp-table-preferences:projects', JSON.stringify({ visible, widths }));
  }, [visible, widths]);

  const columns = useMemo(() => DEFAULT_COLUMNS.filter((column) => visible[column.key] !== false), [visible]);

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesSearch =
        term.length === 0 ||
        project.projectName.toLowerCase().includes(term) ||
        (project.customer?.customerName ?? project.clientName ?? project.client ?? '').toLowerCase().includes(term) ||
        (project.owner?.name ?? project.managerUser?.name ?? project.manager ?? '').toLowerCase().includes(term) ||
        (project.managerAssignedBy?.name ?? '').toLowerCase().includes(term) ||
        project.status.toLowerCase().includes(term);

      const matchesStatus = statusFilter === 'ALL' || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  function resetColumns() {
    setVisible(Object.fromEntries(DEFAULT_COLUMNS.map((column) => [column.key, true])));
    setWidths(Object.fromEntries(DEFAULT_COLUMNS.map((column) => [column.key, column.width])));
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function exportSelected() {
    const rows = projects.filter((project) => selectedIds.includes(project.id));
    const csv = ['ID,Project Name,Customer,Owner,Manager assigned by,Status', ...rows.map((project) => [project.id, project.projectName, columnValue('customer', project), columnValue('owner', project), columnValue('managerAssignedBy', project), project.status].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'projects.csv'; anchor.click(); URL.revokeObjectURL(url);
  }

  function columnValue(key: string, project: Project) {
    return DEFAULT_COLUMNS.find((column) => column.key === key)?.getValue(project) ?? '';
  }

  async function deleteSelected() {
    if (selectedIds.length === 0 || !window.confirm(`Delete ${selectedIds.length} selected project(s)?`)) return;
    try {
      await Promise.all(selectedIds.map((id) => deleteProject(id)));
      await onDeleted?.(selectedIds);
      setSelectedIds([]);
    } catch (error) {
      onDeleteError?.(error instanceof Error ? error.message : 'Failed to delete selected projects');
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Spreadsheet view</p>
          {selectedIds.length > 0 && <span className="text-xs font-semibold text-orange-600">{selectedIds.length} selected</span>}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="w-52 rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFilterOpen((open) => !open)}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                statusFilter !== 'ALL' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <FilterIcon />
              <span>Filter</span>
              {statusFilter !== 'ALL' && <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{1}</span>}
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setStatusFilter(status);
                      setIsFilterOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition ${
                      statusFilter === status ? 'bg-orange-50 text-orange-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{status === 'ALL' ? 'All statuses' : status.replaceAll('_', ' ')}</span>
                    {statusFilter === status && <span className="text-xs font-semibold">✓</span>}
                  </button>
                ))}
                {statusFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('ALL');
                      setIsFilterOpen(false);
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-left text-xs font-semibold text-slate-600"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}
          </div>

          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Columns</summary>
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
              {DEFAULT_COLUMNS.map((column) => <label key={column.key} className="flex items-center gap-2 py-1.5 text-sm text-slate-700"><input type="checkbox" checked={visible[column.key] !== false} onChange={(event) => setVisible((current) => ({ ...current, [column.key]: event.target.checked }))} />{column.label}</label>)}
              <button type="button" onClick={resetColumns} className="mt-2 w-full border-t border-slate-100 pt-2 text-left text-xs font-semibold text-orange-600">Reset columns</button>
            </div>
          </details>
        </div>
      </div>

      {selectedIds.length > 0 && <div className="flex items-center gap-2 border-b border-orange-100 bg-orange-50 px-4 py-2"><button type="button" onClick={exportSelected} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Export CSV</button><button type="button" onClick={() => void deleteSelected()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Delete</button><button type="button" onClick={() => setSelectedIds([])} className="text-xs font-semibold text-slate-500">Clear</button></div>}

      <div className="overflow-x-auto">
        <table className="min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50"><tr><th className="sticky left-0 z-20 border-b border-slate-200 bg-slate-50 px-3 py-3"><input type="checkbox" checked={projects.length > 0 && selectedIds.length === projects.length} onChange={(event) => setSelectedIds(event.target.checked ? projects.map((project) => project.id) : [])} aria-label="Select all projects" /></th>{columns.map((column, index) => <th key={column.key} style={{ width: widths[column.key] ?? column.width }} className={`relative whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${index < 2 ? 'sticky z-10 bg-slate-50' : ''}`}><span className="block">{column.label}</span><span role="separator" aria-label={`Resize ${column.label}`} onMouseDown={(event) => { const start = event.clientX; const initial = widths[column.key] ?? column.width; const move = (moveEvent: MouseEvent) => setWidths((current) => ({ ...current, [column.key]: Math.max(70, initial + moveEvent.clientX - start) })); const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); }} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400" /></th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{filteredProjects.map((project) => <tr key={project.id} tabIndex={0} onClick={() => onSelect(project.id)} onKeyDown={(event) => { if (event.key === 'Enter') onSelect(project.id); }} className={`cursor-pointer transition hover:bg-orange-50/50 ${selectedProjectId === project.id ? 'bg-orange-50' : ''}`}><td className="sticky left-0 z-10 bg-white px-3 py-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(project.id)} onChange={() => toggleSelected(project.id)} aria-label={`Select project ${project.projectName}`} /></td>{columns.map((column, index) => <td key={column.key} className={`whitespace-nowrap px-4 py-3 text-slate-700 ${index < 2 ? 'sticky z-10 bg-white' : ''}`}>{column.key === 'projectName' ? <span className="font-semibold text-slate-900">{column.getValue(project)}</span> : column.key === 'status' ? <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass[project.status] ?? 'bg-slate-100 text-slate-600'}`}>{column.getValue(project)}</span> : column.getValue(project)}</td>)}</tr>)}</tbody>
        </table>
        {filteredProjects.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No matching projects found.</p>}
      </div>
    </div>
  );
}
