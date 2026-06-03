import { PageHeader } from '@/components/layout/PageHeader';
import { DashboardCard } from '@/components/layout/DashboardCard';
import { cn } from '@/lib/cn';

export function ModuleTemplate({
  title,
  description,
  breadcrumbs,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-6', className)}>
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} actions={actions} />
      <DashboardCard>{children}</DashboardCard>
    </div>
  );
}
