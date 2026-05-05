import { Activity } from '@/api/activitiesApi';
import ActivityItem from './ActivityItem';

interface ActivityTimelineProps {
  title?: string;
  activities: Activity[];
}

export default function ActivityTimeline({ title = 'Activity Timeline', activities }: ActivityTimelineProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <div className="mt-4 space-y-4 border-l border-slate-200">
        {activities.length === 0 && <p className="pl-4 text-sm text-slate-400">No activity yet</p>}
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
}
