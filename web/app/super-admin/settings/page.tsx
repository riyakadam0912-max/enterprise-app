'use client';

import { Settings2, ShieldCheck, Mail, Server, PlugZap } from 'lucide-react';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { Card } from '@/components/ui/card';

const settingsSections = [
  { label: 'General', description: 'Platform branding, locale, and defaults', icon: Settings2, status: 'Ready' },
  { label: 'Security', description: 'JWT, 2FA, password policy, and session controls', icon: ShieldCheck, status: 'In review' },
  { label: 'Email', description: 'SMTP, templates, and notifications', icon: Mail, status: 'Live' },
  { label: 'Infrastructure', description: 'Storage, cache, queues, and backups', icon: Server, status: 'Pending' },
  { label: 'Integrations', description: 'Google, Microsoft, Slack, Stripe, and webhooks', icon: PlugZap, status: 'Draft' },
];

export default function SuperAdminSettings() {
  return (
    <SuperAdminPageShell title="System settings" description="Configure the operating model of the platform with a streamlined control panel.">
      <div className="grid gap-4 xl:grid-cols-2">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.label} className="border-slate-200/80 bg-white/80 p-6 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700"><Icon className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{section.label}</h3>
                  <p className="text-sm text-slate-500">{section.description}</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600">
                <span>Configuration workspace</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${section.status === 'Live' ? 'bg-emerald-50 text-emerald-700' : section.status === 'In review' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{section.status}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </SuperAdminPageShell>
  );
}
