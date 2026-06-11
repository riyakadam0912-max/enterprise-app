'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCheck, Filter, Search, Trash2, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { useNotifications } from '@/hooks/useNotifications';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type Notification,
  type NotificationPreferences,
} from '@/api/notificationsApi';
import { reportError } from '@/lib/error-handling';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupByDay(items: Notification[]) {
  const groups = new Map<string, Notification[]>();

  for (const item of items) {
    const label = new Date(item.createdAt).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const existing = groups.get(label) ?? [];
    existing.push(item);
    groups.set(label, existing);
  }

  return Array.from(groups.entries());
}

export function NotificationCenter() {
  const { notifications, unreadCount, loading, refetch, markRead, markAllRead, remove, page } = useNotifications();
  const [search, setSearch] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [savingPreferences, setSavingPreferences] = useState(false);

  useEffect(() => {
    void refetch({
      page: 1,
      limit: page.limit,
      unreadOnly: onlyUnread,
      sortDirection,
    });
  }, [onlyUnread, page.limit, refetch, sortDirection]);

  useEffect(() => {
    let active = true;
    async function loadPreferences() {
      try {
        const data = await getNotificationPreferences();
        if (active) setPreferences(data);
      } catch (error) {
        reportError(error, 'Unable to load notification preferences');
        if (active) setPreferences(null);
      }
    }

    void loadPreferences();

    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return notifications;

    return notifications.filter((item) =>
      [item.title, item.message, item.module ?? '', item.type, item.category].join(' ').toLowerCase().includes(query),
    );
  }, [notifications, search]);

  const groupedItems = useMemo(() => groupByDay(filteredItems), [filteredItems]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        description="Realtime approvals, mentions, reminders, and system events across the ERP."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={onlyUnread ? 'default' : 'outline'} onClick={() => setOnlyUnread((value) => !value)} className="gap-2">
              <Filter className="h-4 w-4" />
              {onlyUnread ? 'Unread only' : 'All notifications'}
            </Button>
            <Button variant="outline" onClick={() => setSortDirection((value) => (value === 'desc' ? 'asc' : 'desc'))}>
              {sortDirection === 'desc' ? 'Newest first' : 'Oldest first'}
            </Button>
            <Button variant="outline" onClick={() => void markAllRead()} className="gap-2">
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          </div>
        }
      />

      <Card>
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Notification Preferences</h2>
          <p className="mt-1 text-sm text-slate-500">Control delivery channels and which events reach you.</p>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {preferences ? (
            <>
              <PreferenceToggle label="Email notifications" checked={preferences.emailEnabled} onChange={(checked) => setPreferences({ ...preferences, emailEnabled: checked })} />
              <PreferenceToggle label="Push notifications" checked={preferences.pushEnabled} onChange={(checked) => setPreferences({ ...preferences, pushEnabled: checked })} />
              <PreferenceToggle label="In-app notifications" checked={preferences.inAppEnabled} onChange={(checked) => setPreferences({ ...preferences, inAppEnabled: checked })} />
              <PreferenceToggle label="Mention alerts" checked={preferences.mentionNotifications} onChange={(checked) => setPreferences({ ...preferences, mentionNotifications: checked })} />
              <PreferenceToggle label="Approval alerts" checked={preferences.approvalNotifications} onChange={(checked) => setPreferences({ ...preferences, approvalNotifications: checked })} />
              <PreferenceToggle label="Reminder alerts" checked={preferences.reminderNotifications} onChange={(checked) => setPreferences({ ...preferences, reminderNotifications: checked })} />
            </>
          ) : (
            <div className="text-sm text-slate-500">Loading preferences...</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => void getNotificationPreferences().then(setPreferences)}
          >
            Reset
          </Button>
          <Button
            onClick={async () => {
              if (!preferences) return;
              setSavingPreferences(true);
              try {
                const { userId: _userId, ...payload } = preferences;
                const saved = await updateNotificationPreferences(payload);
                setPreferences(saved);
              } finally {
                setSavingPreferences(false);
              }
            }}
            loading={savingPreferences}
          >
            Save preferences
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="Unread" value={unreadCount} tone="orange" />
        <MetricCard label="Visible" value={filteredItems.length} tone="slate" />
        <MetricCard label="Pages" value={`${page.page}/${page.totalPages}`} tone="blue" />
        <MetricCard label="Total" value={page.total} tone="emerald" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notifications, modules, or actions" className="pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void refetch({ page: 1, limit: page.limit, unreadOnly: onlyUnread, sortDirection })}>Refresh</Button>
          </div>
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">Loading notifications...</div>
          ) : groupedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <BellRing className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No notifications found</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">You’re all caught up or the current filters are too narrow.</p>
            </div>
          ) : (
            groupedItems.map(([label, items]) => (
              <section key={label} className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className={cn(
                        'group rounded-3xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
                        item.isRead ? 'border-slate-200 bg-white' : 'border-orange-200 bg-orange-50/70 shadow-orange-100',
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn('mt-1 h-2.5 w-2.5 rounded-full', item.isRead ? 'bg-slate-300' : 'bg-orange-500')} />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{item.type}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{item.priority}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{item.category}</span>
                          </div>
                          <p className="text-sm leading-6 text-slate-600">{item.message}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span>{item.module ?? 'System'}</span>
                            <span>{formatDateTime(item.createdAt)}</span>
                            {item.actionUrl ? <span className="truncate">{item.actionUrl}</span> : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => void markRead(item.id)} aria-label="Mark as read">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => void remove(item.id)} aria-label="Delete notification">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing page {page.page} of {page.totalPages} · {page.total} total notifications
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={!page.hasPreviousPage}
              onClick={() => void refetch({ page: Math.max(1, page.page - 1), limit: page.limit, unreadOnly: onlyUnread, sortDirection })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!page.hasNextPage}
              onClick={() => void refetch({ page: Math.min(page.totalPages, page.page + 1), limit: page.limit, unreadOnly: onlyUnread, sortDirection })}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number | string; tone: 'orange' | 'slate' | 'blue' | 'emerald' }) {
  const toneStyles: Record<typeof tone, string> = {
    orange: 'from-orange-500 to-amber-500',
    slate: 'from-slate-900 to-slate-700',
    blue: 'from-sky-500 to-cyan-500',
    emerald: 'from-emerald-500 to-teal-500',
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className={cn('h-1 w-full bg-linear-to-r', toneStyles[tone])} />
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function PreferenceToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
      <Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </label>
  );
}
