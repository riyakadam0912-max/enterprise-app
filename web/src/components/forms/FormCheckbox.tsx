'use client';

import { Controller, type FieldValues, type Path, useFormContext } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/typography/Label';
import { cn } from '@/lib/cn';
import { getErrorMessage, useFormFieldState } from './form-utils';

export function FormCheckbox<TFieldValues extends FieldValues>({
  name,
  label,
  helperText,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: Path<TFieldValues>;
  label: string;
  helperText?: string;
  className?: string;
}) {
  const { control } = useFormContext<TFieldValues>();
  const fieldState = useFormFieldState<TFieldValues>(name);
  const errorMessage = getErrorMessage(fieldState.error);

  return (
    <div className={cn('space-y-2', className)}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <Checkbox
              id={name}
              name={name}
              checked={Boolean(field.value)}
              onChange={(event) => field.onChange(event.target.checked)}
              {...props}
            />
            <span className="space-y-1">
              <Label htmlFor={name}>{label}</Label>
              {helperText ? <p id={`${name}-help`} className="text-xs text-slate-500">{helperText}</p> : null}
            </span>
          </label>
        )}
      />
      {errorMessage ? <p id={`${name}-error`} className="text-xs font-medium text-rose-600">{errorMessage}</p> : null}
    </div>
  );
}
