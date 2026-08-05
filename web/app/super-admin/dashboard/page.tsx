'use client';

import { ArrowRight, CircleAlert, Sparkles } from 'lucide-react';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { SuperAdminOverviewCards } from '@/components/super-admin/SuperAdminOverviewCards';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const activityFeed = [
  { title: 'New tenant onboarded', detail: 'Northwind Labs provisioned a new workspace', time: '2m ago', tone: 'emerald' },
  { title: 'Subscription renewed', detail: 'Acme Corp renewed Enterprise', time: '18m ago', tone: 'indigo' },
  { title: 'Security review pending', detail: '3 elevated audit events need triage', time: '1h ago', tone: 'amber' },
];

export default function SuperAdminDashboard() {
  return (
    <SuperAdminPageShell
      title="Platform Command Center"
      description="A premium overview of platform health, tenant momentum, and system operations."
      actions={
        <>
          <Button variant="outline">Export snapshot</Button>
          <Button>Open console</Button>
        </>
      }
    >
      <SuperAdminOverviewCards />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200/80 bg-white/80 p-6 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Live platform activity</h2>
              <p className="mt-1 text-sm text-slate-500">Recent administrative events across every tenant.</p>
            </div>
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">Operational</div>
          </div>
          <div className="mt-6 space-y-3">
            {activityFeed.map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${item.tone === 'emerald' ? 'bg-emerald-500' : item.tone === 'indigo' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                </div>
                <p className="text-sm text-slate-400">{item.time}</p>
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card className="border-slate-200/80 bg-linear-to-br from-slate-950 via-slate-900 to-indigo-900 p-6 text-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.65)]">
            <div className="flex items-center gap-2 text-sm font-medium text-indigo-200">
              <Sparkles className="h-4 w-4" />
              Premium operations
            </div>
            <h3 className="mt-4 text-xl font-semibold">Multi-tenant admin experience</h3>
            <p className="mt-2 text-sm text-slate-300">Coordinate organization launches, security posture, and lifecycle events from one polished control surface.</p>
            <Button className="mt-5 bg-white text-slate-900 hover:bg-slate-100">Review alerts <ArrowRight className="h-4 w-4" /></Button>
          </Card>
          <Card className="border-slate-200/80 bg-white/80 p-6 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="flex items-center gap-2">
              <CircleAlert className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-slate-950">System cautions</h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2"><span>Backup retention</span><span className="font-medium text-slate-900">Healthy</span></li>
              <li className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2"><span>Pending approvals</span><span className="font-medium text-slate-900">12</span></li>
              <li className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2"><span>Audit queue</span><span className="font-medium text-slate-900">6 new</span></li>
            </ul>
          </Card>
        </div>
      </div>
    </SuperAdminPageShell>
  );
}
