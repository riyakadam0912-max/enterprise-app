'use client';

import { FormProvider, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { cn } from '@/lib/cn';

export function FormWrapper<TFieldValues extends FieldValues>({
  form,
  onSubmit,
  title,
  description,
  children,
  footer,
  className,
}: {
  form: UseFormReturn<TFieldValues>;
  onSubmit: (values: TFieldValues) => void | Promise<void>;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={cn('space-y-6', className)} noValidate>
        {(title || description) && (
          <div className="space-y-2">
            {title ? <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2> : null}
            {description ? <p className="text-sm text-slate-500">{description}</p> : null}
          </div>
        )}
        {children}
        {footer ? <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">{footer}</div> : null}
      </form>
    </FormProvider>
  );
}
