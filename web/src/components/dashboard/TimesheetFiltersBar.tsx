'use client';

import React from 'react';
import { TimesheetFilters } from '../../api/timesheetsApi';

interface TimesheetFiltersBarProps {
  filters: TimesheetFilters;
  onChange: (filters: TimesheetFilters) => void;
}

const STATUS_OPTIONS = ['', 'PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'];

export default function TimesheetFiltersBar({ filters, onChange }: TimesheetFiltersBarProps) {
  const set = (key: keyof TimesheetFilters, value: string) =>
    onChange({ ...filters, [key]: value || undefined, page: 1 });

  const clear = () =>
    onChange({ page: 1, limit: filters.limit });

  return (
    <div className="flex flex-wrap gap-3 my-4">
      <input
        type="text"
        placeholder="Employee name"
        value={filters.employee ?? ''}
        onChange={(e) => set('employee', e.target.value)}
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300 w-40"
      />
      <input
        type="text"
        placeholder="Project"
        value={filters.project ?? ''}
        onChange={(e) => set('project', e.target.value)}
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300 w-36"
      />
      <select
        value={filters.status ?? ''}
        onChange={(e) => set('status', e.target.value)}
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.filter(Boolean).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <input
        type="date"
        value={filters.dateFrom ?? ''}
        onChange={(e) => set('dateFrom', e.target.value)}
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
      />
      <input
        type="date"
        value={filters.dateTo ?? ''}
        onChange={(e) => set('dateTo', e.target.value)}
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
      />
      <button
        onClick={clear}
        className="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
      >
        Clear
      </button>
    </div>
  );
}
