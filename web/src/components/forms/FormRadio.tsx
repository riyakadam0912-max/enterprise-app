'use client';

import { Controller, type FieldValues, type Path, useFormContext } from 'react-hook-form';
import { Radio } from '@/components/ui/radio';
import { Label } from '@/components/typography/Label';
import { cn } from '@/lib/cn';
import { getErrorMessage, useFormFieldState } from './form-utils';

export function FormRadio<TFieldValues extends FieldValues>({
  name,
  label,
  options,
  helperText,
  className,
}: {
  name: Path<TFieldValues>;
  label: string;
  options: Array<{ label: string; value: string }>;
  helperText?: string;
  className?: string;
}) {
  const { control } = useFormContext<TFieldValues>();
  const fieldState = useFormFieldState<TFieldValues>(name);
  const errorMessage = getErrorMessage(fieldState.error);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {helperText ? <span className="text-xs text-slate-500">{helperText}</span> : null}
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <label key={option.value} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <Radio checked={field.value === option.value} onChange={() => field.onChange(option.value)} />
                <span className="text-sm text-slate-700">{option.label}</span>
              </label>
            ))}
          </div>
        )}
      />
      {errorMessage ? <p className="text-xs font-medium text-rose-600">{errorMessage}</p> : null}
    </div>
  );
}
