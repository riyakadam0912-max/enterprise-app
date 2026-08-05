'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { getAuditLogs, type AuditLogEntry } from '@/api/auditLogsApi';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/providers/toast-provider';

function formatTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SuperAdminAuditLogs() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadEntries = async () => {
      try {
        const data = await getAuditLogs({ limit: 25 });
        if (!active) return;
        setEntries(data.items);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Unable to load audit logs';
        toast.error('Audit logs unavailable', message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadEntries();
    return () => {
      active = false;
    };
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesQuery = !normalizedQuery || [entry.userName ?? '', entry.userRole ?? '', entry.module, entry.action, entry.description ?? ''].join(' ').toLowerCase().includes(normalizedQuery);
      const matchesModule = !moduleFilter || entry.module.toLowerCase() === moduleFilter.toLowerCase();
      return matchesQuery && matchesModule;
    });
  }, [entries, moduleFilter, query]);

  return (
    <SuperAdminPageShell title="Audit logs" description="Investigate administrative actions and system changes across your platform." actions={<Button variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button>}>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search by user, action, or module" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-10" />
          </div>
        </Card>
        <Card className="border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <Select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="">All modules</option>
            <option value="Organizations">Organizations</option>
            <option value="Users">Users</option>
            <option value="Roles & Permissions">Roles & Permissions</option>
          </Select>
        </Card>
      </div>
      <Card className="overflow-hidden border-slate-200/80 bg-white/80 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Loading audit logs…</td></tr>
              ) : filteredEntries.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">No audit entries match your filters.</td></tr>
              ) : filteredEntries.map((entry) => (
                <tr key={entry.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-4"><p className="font-semibold text-slate-900">{entry.userName ?? 'System'}</p><p className="text-sm text-slate-500">{entry.userRole ?? '—'}</p></td>
                  <td className="px-4 py-4 text-slate-700">{entry.module}</td>
                  <td className="px-4 py-4 text-slate-700">{entry.action}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${entry.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{entry.status ?? 'UNKNOWN'}</span></td>
                  <td className="px-4 py-4 text-slate-600">{formatTime(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </SuperAdminPageShell>
  );
}
