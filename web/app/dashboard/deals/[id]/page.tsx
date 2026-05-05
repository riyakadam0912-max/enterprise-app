'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getDeal, Deal } from '@/api/dealsApi';
import { getDealActivities, Activity } from '@/api/activitiesApi';
import { getTasksByDeal, Task } from '@/api/tasksApi';
import ActivityTimeline from '@/components/activity/ActivityTimeline';
import UpcomingTasks from '@/components/tasks/UpcomingTasks';
import { formatInrCurrency } from '@/utils/formatCurrency';

export default function DealDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [deal, setDeal] = useState<Deal | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getDeal(id), getDealActivities(id), getTasksByDeal(id)])
      .then(([dealData, activityData, taskData]) => {
        setDeal(dealData);
        setActivities(activityData);
        setTasks(taskData);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading deal...</div>;
  if (!deal) return <div className="p-6 text-sm text-red-500">Deal not found</div>;

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Deal Detail</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">{deal.title}</h1>
            <p className="mt-2 text-sm text-slate-500">{deal.lead?.name ?? 'No lead linked'}{deal.contact ? ` · ${deal.contact}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/deals" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">Back to Deals</Link>
            <Link href="/dashboard/deals/pipeline" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">Pipeline View</Link>
            <Link href={`/dashboard/deals/edit/${deal.id}`} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600">Edit Deal</Link>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Value</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatInrCurrency(deal.value, 2)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Stage</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{deal.stage}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{deal.owner ?? 'Unassigned'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lead</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{deal.lead?.name ?? 'No lead linked'}</p>
          </div>
        </div>

        {deal.stage === 'PROPOSAL' && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <div>
              <p className="text-sm font-semibold text-orange-800">This deal is in the Proposal stage</p>
              <p className="mt-0.5 text-xs text-orange-600">Create a quote to send a formal proposal to the client</p>
            </div>
            <Link
              href={`/dashboard/quotes/add?dealId=${deal.id}${deal.contactId ? `&contactId=${deal.contactId}` : ''}`}
              className="shrink-0 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              Create Quote
            </Link>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <ActivityTimeline activities={activities} title="Deal Activity" />
        <UpcomingTasks tasks={tasks} title="Follow-Up Tasks" />
      </div>
    </div>
  );
}
