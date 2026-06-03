'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, Filter, RefreshCw, Search, ShieldAlert, X } from 'lucide-react';
import { canAccessAuditLogs } from '@/utils/auth/permissions';
import { AuditLogEntry, AuditLogFilters, getAuditLogs } from '@/api/auditLogsApi';

const MODULE_OPTIONS = ['All', 'Auth', 'Users', 'HR', 'Attendance', 'Leave', 'Payroll', 'Tasks', 'Projects', 'CRM', 'Accounting', 'Inventory', 'Assets', 'Roles & Permissions'];
const ACTION_OPTIONS = ['All', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'CUSTOM_ACTION'];
const ROLE_OPTIONS = ['All', 'SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER', 'HR', 'MANAGER', 'EMPLOYEE'];

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function prettyJson(value: unknown) {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusClass(status: AuditLogEntry['status']) {
  return status === 'SUCCESS'
    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
    : 'bg-rose-100 text-rose-700 ring-1 ring-rose-200';
}

function actionClass(action: string) {
  if (action.startsWith('LOGIN')) return 'bg-blue-100 text-blue-700';
  if (action === 'DELETE') return 'bg-rose-100 text-rose-700';
  if (action === 'CREATE') return 'bg-emerald-100 text-emerald-700';
  if (action === 'UPDATE') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogsPage() {
  const [role, setRole] = useState<string>('ADMIN');
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [refreshTick, setRefreshTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({
    search: '',
    module: '',
    action: '',
    role: '',
    from: '',
    to: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setRole(localStorage.getItem('role') ?? 'ADMIN');
  }, []);

  const canView = canAccessAuditLogs(role);

  const query = useMemo<AuditLogFilters>(() => ({
    page,
    limit,
    search: filters.search?.trim() || undefined,
    module: filters.module || undefined,
    action: filters.action || undefined,
    role: filters.role || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  }), [filters.action, filters.from, filters.module, filters.role, filters.search, filters.to, limit, page]);

  useEffect(() => {
    if (!canView) return;

    let active = true;
    setLoading(true);
    setError(null);

    getAuditLogs(query)
      .then((response) => {
        if (!active) return;
        setItems(response.items);
        setTotal(response.total);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canView, query, refreshTick]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startRow = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRow = Math.min(total, page * limit);

  const exportRows = useMemo(() => items.map((log) => ({
    Timestamp: formatDateTime(log.createdAt),
    User: log.userName ?? 'System',
    Role: log.userRole ?? 'N/A',
    Module: log.module,
    Action: log.action,
    Field: log.fieldName ?? '',
    'Old Value': prettyJson(log.oldValue),
    'New Value': prettyJson(log.newValue),
    'IP Address': log.ipAddress ?? '',
    Endpoint: log.endpoint ?? '',
    Status: log.status,
  })), [items]);

  const exportCsv = () => {
    const header = ['Timestamp', 'User', 'Role', 'Module', 'Action', 'Field', 'Old Value', 'New Value', 'IP Address', 'Endpoint', 'Status'];
    const rows = exportRows.map((row) => header.map((column) => `"${String((row as Record<string, string>)[column] ?? '').replace(/"/g, '""')}"`).join(','));
    downloadFile(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, [header.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;');
  };

  const exportXlsx = async () => {
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs');
    XLSX.writeFile(workbook, `audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const clearFilters = () => {
    setFilters({ search: '', module: '', action: '', role: '', from: '', to: '' });
    setPage(1);
  };

  if (!canView) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">Access Restricted</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="mt-3 text-sm text-slate-600">You do not have permission to view enterprise audit records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-400 space-y-6 p-4 sm:p-6">
        <section className="overflow-hidden rounded-4xl border border-slate-200 bg-linear-to-br from-slate-900 via-slate-800 to-slate-950 text-white shadow-2xl">
          <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                <ShieldAlert className="h-3.5 w-3.5" />
                Enterprise Audit Trail
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Audit Logs</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Centralized compliance records for every major ERP module, with field-level diffs, security events, and traceable request metadata.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Total Events</p>
                <p className="mt-1 text-2xl font-semibold">{total.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Page</p>
                <p className="mt-1 text-2xl font-semibold">{page} / {totalPages}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Visible Rows</p>
                <p className="mt-1 text-2xl font-semibold">{items.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Search</span>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input value={filters.search ?? ''} onChange={(e) => { setPage(1); setFilters((prev) => ({ ...prev, search: e.target.value })); }} className="w-full bg-transparent text-sm outline-none" placeholder="User, module, action, field..." />
                </div>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Module</span>
                <select value={filters.module ?? ''} onChange={(e) => { setPage(1); setFilters((prev) => ({ ...prev, module: e.target.value })); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  {MODULE_OPTIONS.map((option) => <option key={option} value={option === 'All' ? '' : option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Action</span>
                <select value={filters.action ?? ''} onChange={(e) => { setPage(1); setFilters((prev) => ({ ...prev, action: e.target.value })); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  {ACTION_OPTIONS.map((option) => <option key={option} value={option === 'All' ? '' : option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Role</span>
                <select value={filters.role ?? ''} onChange={(e) => { setPage(1); setFilters((prev) => ({ ...prev, role: e.target.value })); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  {ROLE_OPTIONS.map((option) => <option key={option} value={option === 'All' ? '' : option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">From</span>
                <input type="date" value={filters.from ?? ''} onChange={(e) => { setPage(1); setFilters((prev) => ({ ...prev, from: e.target.value })); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">To</span>
                <input type="date" value={filters.to ?? ''} onChange={(e) => { setPage(1); setFilters((prev) => ({ ...prev, to: e.target.value })); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Rows</span>
                <select value={limit} onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  {[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={clearFilters} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <Filter className="h-4 w-4" /> Reset
              </button>
              <button onClick={() => void exportCsv()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <Download className="h-4 w-4" /> CSV
              </button>
              <button onClick={() => void exportXlsx()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
                Printable Report
              </button>
              <button onClick={() => setRefreshTick((value) => value + 1)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Field</th>
                  <th className="px-4 py-3">Old Value</th>
                  <th className="px-4 py-3">New Value</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={9}>Loading audit log entries...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={9}>No audit events match the current filters.</td></tr>
                ) : items.map((log) => (
                  <tr key={log.id} onClick={() => setSelected(log)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{log.userName ?? 'System'}</td>
                    <td className="px-4 py-3 text-slate-600">{log.userRole ?? 'N/A'}</td>
                    <td className="px-4 py-3 text-slate-600">{log.module}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${actionClass(log.action)}`}>{log.action}</span></td>
                    <td className="px-4 py-3 text-slate-600">{log.fieldName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500"><span className="max-w-48 truncate block">{prettyJson(log.oldValue)}</span></td>
                    <td className="px-4 py-3 text-slate-500"><span className="max-w-48 truncate block">{prettyJson(log.newValue)}</span></td>
                    <td className="px-4 py-3 text-slate-600">{log.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-600 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {startRow}-{endRow} of {total} events
            </p>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">Previous</button>
              <span className="rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{page}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)} className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">Next</button>
            </div>
          </div>
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-4xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Audit Log Details</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">{selected.module} - {selected.action}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">User Info</h3>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">User:</span> {selected.userName ?? 'System'}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">Role:</span> {selected.userRole ?? 'N/A'}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">User ID:</span> {selected.userId ?? 'N/A'}</p>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Action Summary</h3>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">Module:</span> {selected.module}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">Entity:</span> {selected.entityType} {selected.entityId ? `#${selected.entityId}` : ''}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">Endpoint:</span> {selected.endpoint ?? 'N/A'}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">Method:</span> {selected.requestMethod ?? 'N/A'}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">Timestamp:</span> {formatDateTime(selected.createdAt)}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">IP:</span> {selected.ipAddress ?? 'N/A'}</p>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40 md:col-span-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Changed Fields</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Field</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{selected.fieldName ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</p>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(selected.status)}`}>{selected.status}</span>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Old Value</p>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-2xl bg-slate-900 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap">{prettyJson(selected.oldValue)}</pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">New Value</p>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-2xl bg-slate-900 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap">{prettyJson(selected.newValue)}</pre>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Description</p>
                  <p className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{selected.description ?? 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
