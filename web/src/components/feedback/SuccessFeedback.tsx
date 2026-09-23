'use client';

import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type SuccessFeedbackProps = {
  title: string;
  description?: string;
  className?: string;
};

export function SuccessFeedback({ title, description, className }: SuccessFeedbackProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950', className)}
    >
      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="mt-1 text-sm text-emerald-800">{description}</p> : null}
      </div>
    </div>
  );
}
