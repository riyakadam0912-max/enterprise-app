'use client';

import { type FieldValues, type Path, useFormContext } from 'react-hook-form';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/typography/Label';
import { cn } from '@/lib/cn';
import { getErrorMessage, useFormFieldState } from './form-utils';

export function FormSelect<TFieldValues extends FieldValues>({
  name,
  label,
  options,
  helperText,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  name: Path<TFieldValues>;
  label: string;
  options: Array<{ label: string; value: string }>;
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
      <Select id={name} aria-invalid={Boolean(errorMessage)} aria-describedby={errorMessage ? `${name}-error` : helperText ? `${name}-help` : undefined} {...register(name)} {...props}>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {errorMessage ? <p id={`${name}-error`} className="text-xs font-medium text-rose-600">{errorMessage}</p> : null}
      {!errorMessage && helperText ? <p id={`${name}-help`} className="text-xs text-slate-500">{helperText}</p> : null}
    </label>
  );
}
