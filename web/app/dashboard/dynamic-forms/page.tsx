'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DynamicFormsListRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/forms/dynamic');
  }, [router]);

  return <div className="p-6 text-sm text-slate-500">Redirecting…</div>;
}
