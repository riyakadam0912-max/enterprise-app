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
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
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
    <label className={cn('block space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={name}>{label}</Label>
        {helperText ? <span className="text-xs text-slate-500">{helperText}</span> : null}
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-slate-500">{currency}</span>
            <Input
              id={name}
              name={name}
              value={field.value ?? ''}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^\d.]/g, '');
                field.onChange(raw ? Number(raw) : '');
              }}
              className="pl-8"
              inputMode="decimal"
              autoComplete="transaction-amount"
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? `${name}-error` : helperText ? `${name}-help` : undefined}
              {...props}
            />
          </div>
        )}
      />
      {errorMessage ? <p id={`${name}-error`} className="text-xs font-medium text-rose-600">{errorMessage}</p> : null}
      {!errorMessage && helperText ? <p id={`${name}-help`} className="text-xs text-slate-500">{helperText}</p> : null}
    </label>
  );
}
