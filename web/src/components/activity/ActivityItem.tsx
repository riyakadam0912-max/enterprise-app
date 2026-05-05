import { Activity } from '@/api/activitiesApi';

interface ActivityItemProps {
  activity: Activity;
}

export default function ActivityItem({ activity }: ActivityItemProps) {
  const created = new Date(activity.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="relative pl-8">
      <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-orange-500" />
      <p className="text-xs text-slate-400">{created}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-600">{activity.type}</p>
      <p className="mt-1 text-sm text-slate-700">{activity.description}</p>
      <p className="mt-1 text-xs text-slate-500">by {activity.user?.name ?? 'Unknown user'}</p>
    </div>
  );
}
