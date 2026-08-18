'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getFormSubmission, type FormSubmission, type FormSubmissionStatus } from '@/api/formSubmissionsApi';
import { reportError } from '@/lib/error-handling';

const STATUS_COLOR: Record<FormSubmissionStatus, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  PROCESSED: 'bg-emerald-100 text-emerald-700',
};

function fmtDateTime(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FormSubmissionDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const submissionId = Number(params.id);
  const invalidSubmission = !Number.isFinite(submissionId);
  const [submission, setSubmission] = useState<FormSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invalidSubmission) {
      return;
    }

    let cancelled = false;
    getFormSubmission(submissionId)
      .then((record) => {
        if (!cancelled) {
          setSubmission(record);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unable to load submission');
          reportError(e, 'Unable to load form submission');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  const displayError = invalidSubmission ? 'Invalid submission' : error;
  const isLoading = !invalidSubmission && loading;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/dashboard/forms/status')}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-orange-600"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Form Status
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : displayError || !submission ? (
        <div className="bg-white rounded-xl border border-rose-200 shadow-sm px-6 py-10 text-center text-sm text-rose-600">
          {displayError ?? 'Submission not found'}
        </div>
      ) : (
        <>
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">{submission.form}</h1>
                <p className="mt-1 text-sm text-slate-500">Submission #{submission.id}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[submission.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {submission.status.charAt(0) + submission.status.slice(1).toLowerCase()}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Submitted By</p>
                <p className="mt-1 text-sm text-slate-800">{submission.submittedBy ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Submission Date</p>
                <p className="mt-1 text-sm text-slate-800">{fmtDateTime(submission.submissionDate)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Current Approver</p>
                <p className="mt-1 text-sm text-slate-800">{submission.reviewer ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Review Date</p>
                <p className="mt-1 text-sm text-slate-800">{fmtDateTime(submission.reviewDate)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Created</p>
                <p className="mt-1 text-sm text-slate-800">{fmtDateTime(submission.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Last Updated</p>
                <p className="mt-1 text-sm text-slate-800">{fmtDateTime(submission.updatedAt)}</p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900">Submission Details</h2>
            <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4">
              <pre className="whitespace-pre-wrap break-words text-sm text-slate-700">
                {submission.data?.trim() ? submission.data : 'No submission details provided.'}
              </pre>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
