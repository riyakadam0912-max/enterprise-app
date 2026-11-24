'use client';

import { ArrowRight, Building2, FileText, Settings, Users } from 'lucide-react';
import Link from 'next/link';

import { SuperAdminOverviewCards } from '@/components/super-admin/SuperAdminOverviewCards';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';

const workflows = [
  { label: 'Organizations', description: 'Tenant setup, status, and hierarchy', href: '/super-admin/organizations', icon: Building2 },
  { label: 'Users', description: 'Access, roles, and account lifecycle', href: '/super-admin/users', icon: Users },
  { label: 'Audit logs', description: 'Administrative and security history', href: '/super-admin/audit-logs', icon: FileText },
  { label: 'Settings', description: 'Platform-wide operating controls', href: '/super-admin/settings', icon: Settings },
];

export default function SuperAdminDashboard() {
  return (
    <SuperAdminPageShell
      title="Platform overview"
      description="Monitor platform scope, review exceptions, and open the workflows that need attention."
      actions={
        <>
          <Link href="/super-admin/organizations" className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">Manage organizations</Link>
          <Link href="/super-admin/audit-logs" className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white shadow-sm hover:bg-slate-800">Open audit console</Link>
        </>
      }
    >
      <SuperAdminOverviewCards />

      <section aria-labelledby="core-workflows-heading">
        <div className="mb-3">
          <h2 id="core-workflows-heading" className="font-semibold text-slate-950">Core workflows</h2>
          <p className="mt-1 text-sm text-slate-500">Go directly to the records you need to manage.</p>
        </div>
        <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
          {workflows.map((workflow, index) => {
            const Icon = workflow.icon;
            return (
              <Link
                key={workflow.href}
                href={workflow.href}
                className={`group flex items-start gap-3 border-slate-200 p-4 transition hover:bg-slate-50 ${index > 0 ? 'border-t sm:border-t-0 sm:border-l' : ''} ${index === 2 ? 'sm:border-l-0 sm:border-t xl:border-l xl:border-t-0' : ''}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{workflow.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{workflow.description}</span></span>
                <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
              </Link>
            );
          })}
        </div>
      </section>
    </SuperAdminPageShell>
  );
}
