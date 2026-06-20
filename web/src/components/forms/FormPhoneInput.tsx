'use client';

import { Controller, type FieldValues, type Path, useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/typography/Label';
import { cn } from '@/lib/cn';
import { getErrorMessage, useFormFieldState } from './form-utils';

export function FormPhoneInput<TFieldValues extends FieldValues>({
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
    <label className={cn('block space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={name}>{label}</Label>
        {helperText ? <span className="text-xs text-slate-500">{helperText}</span> : null}
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={name}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? `${name}-error` : helperText ? `${name}-help` : undefined}
            value={field.value ?? ''}
            onChange={(event) => field.onChange(event.target.value.replace(/[^\d+()\-\s]/g, ''))}
            placeholder="+1 555 000 0000"
            {...props}
          />
        )}
      />
      {errorMessage ? <p id={`${name}-error`} className="text-xs font-medium text-rose-600">{errorMessage}</p> : null}
      {!errorMessage && helperText ? <p id={`${name}-help`} className="text-xs text-slate-500">{helperText}</p> : null}
    </label>
  );
}
