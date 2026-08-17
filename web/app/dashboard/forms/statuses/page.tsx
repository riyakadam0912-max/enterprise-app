'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FormSubmissionsStatusesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/forms/status');
  }, [router]);

  return <div className="p-6 text-sm text-slate-500">Redirecting…</div>;
}
