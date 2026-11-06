'use client';

import { ArrowRight, CircleAlert, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { SuperAdminOverviewCards } from '@/components/super-admin/SuperAdminOverviewCards';
import { Card } from '@/components/ui/card';

export default function SuperAdminDashboard() {
  return (
    <SuperAdminPageShell
      title="Platform Command Center"
      description="A premium overview of platform health, tenant momentum, and system operations."
      actions={
        <>
          <Link href="/super-admin/organizations" className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">Manage organizations</Link>
          <Link href="/super-admin/audit-logs" className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white shadow-sm hover:bg-slate-800">Open audit console</Link>
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
          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600">
            Administrative events are available in the audit console. This panel no longer shows placeholder activity.
            <Link href="/super-admin/audit-logs" className="mt-3 inline-flex font-semibold text-indigo-700 hover:underline">View audit events <ArrowRight className="ml-1 h-4 w-4" /></Link>
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
            <Link href="/super-admin/audit-logs" className="mt-5 inline-flex h-10 items-center rounded-md bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-100">Review audit alerts <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Card>
          <Card className="border-slate-200/80 bg-white/80 p-6 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="flex items-center gap-2">
              <CircleAlert className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-slate-950">System cautions</h3>
            </div>
            <p className="mt-4 text-sm text-slate-600">Operational cautions require live monitoring integrations. Review tenant, audit, and settings pages for current data.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm font-medium">
              <Link href="/super-admin/organizations" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-slate-100">Organizations</Link>
              <Link href="/super-admin/audit-logs" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-slate-100">Audit logs</Link>
              <Link href="/super-admin/settings" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-slate-100">Settings</Link>
            </div>
          </Card>
        </div>
      </div>
    </SuperAdminPageShell>
  );
}
