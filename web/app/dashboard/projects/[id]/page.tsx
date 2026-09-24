'use client';

import { useParams, useRouter } from 'next/navigation';
import ProjectsWorkflowPage from '../page';

export default function ProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = Number(params.id);

  if (!Number.isInteger(projectId) || projectId < 1) {
    router.replace('/dashboard/projects');
    return null;
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => router.push('/dashboard/projects')} className="absolute right-6 top-6 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Back to Projects</button>
      <ProjectsWorkflowPage initialProjectId={projectId} dedicated />
    </div>
  );
}
