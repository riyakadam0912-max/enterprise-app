'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { convertLead, getLeadDetail, Lead } from '@/api/leadsApi';
import { Activity } from '@/api/activitiesApi';
import { Task } from '@/api/tasksApi';
import ActivityTimeline from '@/components/activity/ActivityTimeline';
import UpcomingTasks from '@/components/tasks/UpcomingTasks';

export default function LeadDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getLeadDetail(id)
      .then((detail) => {
        setLead(detail.lead);
        setActivities(detail.activities);
        setTasks(detail.tasks);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleConvert = async () => {
    if (!lead) return;
    setConverting(true);
    try {
      await convertLead(lead.id);
      router.push('/dashboard/deals/pipeline');
    } finally {
      setConverting(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading lead...</div>;
  if (!lead) return <div className="p-6 text-sm text-red-500">Lead not found</div>;

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Lead Detail</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">{lead.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{lead.company ?? 'No company'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/leads" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">Back to Leads</Link>
            <Link href={`/dashboard/leads/edit/${lead.id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">Edit Lead</Link>
            <button
              onClick={handleConvert}
              disabled={converting}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-70"
            >
              {converting ? 'Converting...' : 'Convert Lead'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{lead.status ?? 'Unknown'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Activity</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{activities.length} events</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Follow-up tasks</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{tasks.length} open items</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <ActivityTimeline activities={activities} title="Lead Activity" />
        <UpcomingTasks tasks={tasks} title="Follow-Up Tasks" />
      </div>
    </div>
  );
}
