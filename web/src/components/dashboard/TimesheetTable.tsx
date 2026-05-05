'use client';

import React from 'react';
import { TimesheetRow } from '../../api/timesheetsApi';

type SortField = 'employee' | 'date' | 'hours' | 'status' | 'task';
type SortDir = 'asc' | 'desc';

interface TimesheetTableProps {
  rows: TimesheetRow[];
  loading: boolean;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  SUBMITTED: 'bg-red-100 text-red-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-slate-100 text-slate-600',
};

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <span className="ml-1 text-slate-300">↕</span>;
  return <span className="ml-1 text-orange-500">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

const SORTABLE_COLS: { key: SortField; label: string }[] = [
  { key: 'employee', label: 'Employee' },
  { key: 'task', label: 'Task' },
  { key: 'date', label: 'Date' },
  { key: 'hours', label: 'Hours' },
  { key: 'status', label: 'Status' },
];

export default function TimesheetTable({ rows, loading, sortField, sortDir, onSort }: TimesheetTableProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        No timesheets found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {SORTABLE_COLS.map(({ key, label }) => (
              <th
                key={key}
                onClick={() => onSort(key)}
                className="text-left py-3 px-4 font-semibold text-slate-500 cursor-pointer select-none hover:text-slate-700 whitespace-nowrap"
              >
                {label}
                <SortIcon field={key} sortField={sortField} sortDir={sortDir} />
              </th>
            ))}
            <th className="text-left py-3 px-4 font-semibold text-slate-500">Project</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-500">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="py-3 px-4 text-slate-700 font-medium">
                {row.employee?.name ?? '—'}
              </td>
              <td className="py-3 px-4 text-slate-600 max-w-48 truncate" title={row.task}>
                {row.task}
              </td>
              <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                {new Date(row.date).toLocaleDateString()}
              </td>
              <td className="py-3 px-4 text-slate-600">{row.hours}h</td>
              <td className="py-3 px-4">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[row.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {row.status}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-500">{row.project ?? '—'}</td>
              <td className="py-3 px-4 text-slate-400 max-w-40 truncate" title={row.notes ?? ''}>
                {row.notes ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
