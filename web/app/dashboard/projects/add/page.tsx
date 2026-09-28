'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AddProjectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/projects?create=1');
  }, [router]);

  return (
    <div className="flex min-h-[240px] items-center justify-center p-6 text-sm text-slate-500">
      Redirecting to the project creation drawer...
    </div>
  );
}
