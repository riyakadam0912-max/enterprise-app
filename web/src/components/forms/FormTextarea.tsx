'use client';

import { type FieldValues, type Path, useFormContext } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/typography/Label';
import { cn } from '@/lib/cn';
import { getErrorMessage, useFormFieldState } from './form-utils';

export function FormTextarea<TFieldValues extends FieldValues>({
  name,
  label,
  helperText,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  name: Path<TFieldValues>;
  label: string;
  helperText?: string;
}) {
  const { register } = useFormContext<TFieldValues>();
  const fieldState = useFormFieldState<TFieldValues>(name);
  const errorMessage = getErrorMessage(fieldState.error);

  return (
    <label className={cn('block space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={name}>{label}</Label>
        {helperText ? <span className="text-xs text-slate-500">{helperText}</span> : null}
      </div>
      <Textarea id={name} aria-invalid={Boolean(errorMessage)} aria-describedby={errorMessage ? `${name}-error` : helperText ? `${name}-help` : undefined} {...register(name)} {...props} />
      {errorMessage ? <p id={`${name}-error`} className="text-xs font-medium text-rose-600">{errorMessage}</p> : null}
      {!errorMessage && helperText ? <p id={`${name}-help`} className="text-xs text-slate-500">{helperText}</p> : null}
    </label>
  );
}
