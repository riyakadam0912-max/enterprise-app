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

export function ProjectGrid({ projects, selectedProjectId, onSelect, onDeleted, onDeleteError }: { projects: Project[]; selectedProjectId: number | null; onSelect: (id: number) => void; onDeleted?: (ids: number[]) => void | Promise<void>; onDeleteError?: (message: string) => void }) {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const preferenceKey = 'erp-table-preferences:projects';

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}') as { visible?: Record<string, boolean>; widths?: Record<string, number> };
      setVisible(saved.visible ?? Object.fromEntries(DEFAULT_COLUMNS.map((column) => [column.key, true])));
      setWidths(saved.widths ?? Object.fromEntries(DEFAULT_COLUMNS.map((column) => [column.key, column.width])));
    } catch {
      setVisible(Object.fromEntries(DEFAULT_COLUMNS.map((column) => [column.key, true])));
    }
  }, []);

  useEffect(() => {
    if (Object.keys(visible).length > 0) localStorage.setItem(preferenceKey, JSON.stringify({ visible, widths }));
  }, [visible, widths]);

  const columns = useMemo(() => DEFAULT_COLUMNS.filter((column) => visible[column.key] !== false), [visible]);

  function resetColumns() {
    setVisible(Object.fromEntries(DEFAULT_COLUMNS.map((column) => [column.key, true])));
    setWidths(Object.fromEntries(DEFAULT_COLUMNS.map((column) => [column.key, column.width])));
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function exportSelected() {
    const rows = projects.filter((project) => selectedIds.includes(project.id));
    const csv = ['ID,Project Name,Customer,Owner,Status', ...rows.map((project) => [project.id, project.projectName, columnValue('customer', project), columnValue('owner', project), project.status].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n');
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
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Spreadsheet view</p>{selectedIds.length > 0 && <span className="text-xs font-semibold text-orange-600">{selectedIds.length} selected</span>}</div>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Columns</summary>
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
            {DEFAULT_COLUMNS.map((column) => <label key={column.key} className="flex items-center gap-2 py-1.5 text-sm text-slate-700"><input type="checkbox" checked={visible[column.key] !== false} onChange={(event) => setVisible((current) => ({ ...current, [column.key]: event.target.checked }))} />{column.label}</label>)}
            <button type="button" onClick={resetColumns} className="mt-2 w-full border-t border-slate-100 pt-2 text-left text-xs font-semibold text-orange-600">Reset columns</button>
          </div>
        </details>
      </div>
      {selectedIds.length > 0 && <div className="flex items-center gap-2 border-b border-orange-100 bg-orange-50 px-4 py-2"><button type="button" onClick={exportSelected} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Export CSV</button><button type="button" onClick={() => void deleteSelected()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Delete</button><button type="button" onClick={() => setSelectedIds([])} className="text-xs font-semibold text-slate-500">Clear</button></div>}
      <div className="overflow-x-auto">
        <table className="min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50"><tr><th className="sticky left-0 z-20 border-b border-slate-200 bg-slate-50 px-3 py-3"><input type="checkbox" checked={projects.length > 0 && selectedIds.length === projects.length} onChange={(event) => setSelectedIds(event.target.checked ? projects.map((project) => project.id) : [])} aria-label="Select all projects" /></th>{columns.map((column, index) => <th key={column.key} style={{ width: widths[column.key] ?? column.width }} className={`relative whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${index < 2 ? 'sticky z-10 bg-slate-50' : ''}`}><span className="block">{column.label}</span><span role="separator" aria-label={`Resize ${column.label}`} onMouseDown={(event) => { const start = event.clientX; const initial = widths[column.key] ?? column.width; const move = (moveEvent: MouseEvent) => setWidths((current) => ({ ...current, [column.key]: Math.max(70, initial + moveEvent.clientX - start) })); const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); }} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400" /></th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{projects.map((project) => <tr key={project.id} tabIndex={0} onClick={() => onSelect(project.id)} onKeyDown={(event) => { if (event.key === 'Enter') onSelect(project.id); }} className={`cursor-pointer transition hover:bg-orange-50/50 ${selectedProjectId === project.id ? 'bg-orange-50' : ''}`}><td className="sticky left-0 z-10 bg-white px-3 py-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(project.id)} onChange={() => toggleSelected(project.id)} aria-label={`Select project ${project.projectName}`} /></td>{columns.map((column, index) => <td key={column.key} className={`whitespace-nowrap px-4 py-3 text-slate-700 ${index < 2 ? 'sticky z-10 bg-white' : ''}`}>{column.key === 'projectName' ? <span className="font-semibold text-slate-900">{column.getValue(project)}</span> : column.key === 'status' ? <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass[project.status] ?? 'bg-slate-100 text-slate-600'}`}>{column.getValue(project)}</span> : column.getValue(project)}</td>)}</tr>)}</tbody>
        </table>
        {projects.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No projects found.</p>}
      </div>
    </div>
  );
}
