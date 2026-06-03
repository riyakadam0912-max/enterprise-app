'use client';

import { Controller, type FieldValues, type Path, useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/typography/Label';
import { cn } from '@/lib/cn';
import { getErrorMessage, useFormFieldState } from './form-utils';

export function FormCurrencyInput<TFieldValues extends FieldValues>({
  name,
  label,
  currency = '₹',
  helperText,
  className,
}: {
  name: Path<TFieldValues>;
  label: string;
  currency?: string;
  helperText?: string;
  className?: string;
}) {
  const { control } = useFormContext<TFieldValues>();
  const fieldState = useFormFieldState<TFieldValues>(name);
  const errorMessage = getErrorMessage(fieldState.error);

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-slate-500">{currency}</span>
            <Input
              value={field.value ?? ''}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^\d.]/g, '');
                field.onChange(raw ? Number(raw) : '');
              }}
              className="pl-8"
              inputMode="decimal"
            />
          </div>
        )}
      />
      {errorMessage ? <p className="text-xs font-medium text-rose-600">{errorMessage}</p> : null}
      {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
    </div>
  );
}
