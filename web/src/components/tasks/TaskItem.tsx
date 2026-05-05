import { Task } from '@/api/tasksApi';

interface TaskItemProps {
  task: Task;
}

export default function TaskItem({ task }: TaskItemProps) {
  const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-sm font-medium text-slate-800">{task.taskName}</p>
      <p className="mt-1 text-xs text-slate-500">Due: {due}</p>
      <p className="text-xs text-slate-500">Priority: {task.priority ?? 'Not set'}</p>
    </div>
  );
}
