'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ModuleTemplate } from '@/components/ModuleTemplate';

export type EnterpriseModuleStat = {
  label: string;
  value: ReactNode;
  detail?: string;
};

export type EnterpriseModulePageProps = {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
  stats?: EnterpriseModuleStat[];
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function EnterpriseModulePage({
  title,
  description,
  breadcrumbs,
  actions,
  stats,
  children,
  footer,
  className,
}: EnterpriseModulePageProps) {
  return (
    <ModuleTemplate title={title} description={description} breadcrumbs={breadcrumbs} actions={actions}>
      <div className={cn('space-y-6', className)}>
        {stats && stats.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{stat.label}</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{stat.value}</div>
                {stat.detail ? <div className="mt-1 text-sm text-slate-600">{stat.detail}</div> : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-4">{children}</div>

        {footer ? <div className="border-t border-slate-200 pt-4">{footer}</div> : null}
      </div>
    </ModuleTemplate>
  );
}