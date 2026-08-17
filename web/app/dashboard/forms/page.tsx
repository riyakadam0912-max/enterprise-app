'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getFormSubmissions, FormSubmission } from '@/api/formSubmissionsApi';
import { useAuthSession } from '@/stores/auth-store';

const AVAILABLE_FORMS_COUNT: number = 17;

function IconDynamic() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 14h6M9 18h3M9 10h2" />
    </svg>
  );
}

function IconStatus() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export default function FormsLandingPage() {
  const router = useRouter();
  const { user } = useAuthSession();
  const [submissionsCount, setSubmissionsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const subs = await getFormSubmissions().catch(() => [] as FormSubmission[]);
        if (cancelled) return;
        const currentUserName = normalizeText(user?.name);
        const mySubs = subs.filter((s) => normalizeText(s.submittedBy) === currentUserName);
        setSubmissionsCount(mySubs.length);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Forms</h1>
        <p className="text-sm text-slate-500 mt-1">
          Browse available forms and track the status of your submissions.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Link
          href="/dashboard/forms/dynamic"
          className="group relative block bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-orange-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
              <IconDynamic />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                Dynamic Forms
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Directory of application forms — open a form to submit.
              </p>
              <div className="mt-4 text-xs text-slate-400">
                {`${AVAILABLE_FORMS_COUNT} form${AVAILABLE_FORMS_COUNT === 1 ? '' : 's'} available`}
              </div>
            </div>
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-slate-300 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>

        <Link
          href="/dashboard/forms/status"
          className="group relative block bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-orange-300 hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <IconStatus />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                Form Status
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Track your submissions.
              </p>
              <div className="mt-4 text-xs text-slate-400">
                {loading ? 'Loading…' : (
                  <>{submissionsCount ?? 0} total</>
                )}
              </div>
            </div>
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-slate-300 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3 text-xs text-slate-400">
        <button type="button" onClick={() => router.back()} className="hover:text-slate-600">
          ← Back
        </button>
      </div>
    </div>
  );
}
