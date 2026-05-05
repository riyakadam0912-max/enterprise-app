import { Task } from '@/api/tasksApi';
import TaskItem from './TaskItem';

interface UpcomingTasksProps {
  title?: string;
  tasks: Task[];
}

export default function UpcomingTasks({ title = 'Upcoming Tasks', tasks }: UpcomingTasksProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <div className="mt-3 space-y-2">
        {tasks.length === 0 && <p className="text-sm text-slate-400">No tasks found</p>}
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
