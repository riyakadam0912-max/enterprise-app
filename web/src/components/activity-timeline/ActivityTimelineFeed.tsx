'use client';

import { useMemo, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, Filter, MessageSquarePlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { useActivityTimeline } from '@/hooks/useActivityTimeline';

const MODULE_OPTIONS = ['All', 'Sales', 'Tasks', 'Deals', 'Invoices', 'Leave', 'Workflow', 'System'];
const EVENT_OPTIONS = ['All', 'AUDIT_EVENT', 'CREATED', 'UPDATED', 'ASSIGNED', 'COMMENTED', 'APPROVED', 'REJECTED', 'MENTIONED', 'WORKFLOW_EVENT'];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toneForEvent(eventType: string, status: string) {
  if (status === 'ERROR') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'SUCCESS') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (eventType === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (eventType === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (eventType === 'ASSIGNED' || eventType === 'MENTIONED') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function ActivityTimelineFeed() {
  const { items, meta, loading, error, query, setFilters, goToPage, refresh, addComment } = useActivityTimeline();
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [savingCommentId, setSavingCommentId] = useState<number | null>(null);

  const activeModule = query.module ?? 'All';
  const activeEventType = query.eventType ?? 'All';

  const metrics = useMemo(() => ({
    total: meta.total,
    page: meta.page,
    entityTypes: new Set(items.map((item) => item.entityType)).size,
    modules: new Set(items.map((item) => item.module)).size,
  }), [items, meta.page, meta.total]);

  return (
    <div className="space-y-6">
      <div className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Enterprise Activity</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Activity Timeline</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Unified chronological history for audit events, workflow actions, assignments, comments, and mentions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatPill label="Total" value={metrics.total} />
            <StatPill label="Modules" value={metrics.modules} />
            <StatPill label="Entity types" value={metrics.entityTypes} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.7fr_0.7fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query.search ?? ''}
              onChange={(event) => setFilters({ search: event.target.value })}
              placeholder="Search titles, descriptions, or actions"
              className="pl-9"
            />
          </div>
          <select
            value={activeModule}
            onChange={(event) => setFilters({ module: event.target.value === 'All' ? undefined : event.target.value })}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            {MODULE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select
            value={activeEventType}
            onChange={(event) => setFilters({ eventType: event.target.value === 'All' ? undefined : event.target.value })}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            {EVENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setFilters({ module: undefined, eventType: undefined, search: undefined })} className="gap-2">
            <Filter className="h-4 w-4" />
            Reset filters
          </Button>
          <Button onClick={() => refresh()} className="gap-2">
            Refresh feed
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Recent events</h2>
          <p className="mt-1 text-sm text-slate-500">Audit logs, approvals, mentions, and workflow changes.</p>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">Loading timeline...</div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-16 text-center">
              <Activity className="h-6 w-6 text-slate-400" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No timeline events yet</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">Once audits, workflows, and mentions are emitted, they will appear here.</p>
            </div>
          ) : (
            <div className="relative space-y-4 pl-2">
              <div className="absolute bottom-0 left-5 top-0 w-px bg-slate-200" />
              {items.map((item) => (
                <TimelineCard
                  key={item.id}
                  item={item}
                  draft={commentDrafts[item.id] ?? ''}
                  saving={savingCommentId === item.id}
                  onDraftChange={(value) => setCommentDrafts((current) => ({ ...current, [item.id]: value }))}
                  onSubmit={async () => {
                    const comment = (commentDrafts[item.id] ?? '').trim();
                    if (!comment) return;
                    setSavingCommentId(item.id);
                    try {
                      await addComment({ timelineId: item.id, comment });
                      setCommentDrafts((current) => ({ ...current, [item.id]: '' }));
                    } finally {
                      setSavingCommentId(null);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-sm text-slate-500">
            Page {meta.page} of {meta.totalPages} · {meta.total} events
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={!meta.hasPreviousPage} onClick={() => goToPage(Math.max(1, meta.page - 1))} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button variant="outline" disabled={!meta.hasNextPage} onClick={() => goToPage(Math.min(meta.totalPages, meta.page + 1))} className="gap-2">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function TimelineCard({
  item,
  draft,
  saving,
  onDraftChange,
  onSubmit,
}: {
  item: ReturnType<typeof useActivityTimeline>['items'][number];
  draft: string;
  saving: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
}) {
  const tone = toneForEvent(item.eventType, item.status);
  const comments = item.comments ?? [];
  const markerStyle = item.color ? { backgroundColor: item.color } : undefined;

  return (
    <article className="relative pl-10">
      <span className={cn('absolute left-3 top-5 h-4 w-4 rounded-full border-4 border-white shadow-sm', !item.color && 'bg-slate-400')} style={markerStyle} />
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', tone)}>
                {item.eventType}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                {item.module}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                {item.entityType} #{item.entityId}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
            {item.description ? <p className="max-w-3xl text-sm leading-6 text-slate-600">{item.description}</p> : null}
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>{formatDateTime(item.createdAt)}</div>
            <div className="mt-1">{item.performedByRole ?? 'System'}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailBlock label="Action" value={item.action} />
          <DetailBlock label="Status" value={item.status} />
          <DetailBlock label="Priority" value={item.priority} />
          <DetailBlock label="Approval" value={item.approvalStatus ?? 'N/A'} />
        </div>

        {item.metadata ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <div className="mb-2 font-semibold uppercase tracking-[0.18em] text-slate-500">Metadata</div>
            <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word font-mono text-[11px] leading-5 text-slate-600">{JSON.stringify(item.metadata, null, 2)}</pre>
          </div>
        ) : null}

        {comments.length > 0 ? (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Comments</div>
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{comment.userRole ?? 'User'} {comment.userId ? `#${comment.userId}` : ''}</span>
                  <span>{formatDateTime(comment.createdAt)}</span>
                </div>
                <p className="mt-2 leading-6">{comment.comment}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Add comment</span>
          </div>
          <Textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Add a note for the team or leave context for this event"
            className="mt-3"
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={() => void onSubmit()} disabled={saving || !draft.trim()}>
              {saving ? 'Saving...' : 'Comment'}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}
