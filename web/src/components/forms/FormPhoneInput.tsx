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
}: {
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
      <Label>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            type="tel"
            inputMode="tel"
            value={field.value ?? ''}
            onChange={(event) => field.onChange(event.target.value.replace(/[^\d+()\-\s]/g, ''))}
            placeholder="+1 555 000 0000"
          />
        )}
      />
      {errorMessage ? <p className="text-xs font-medium text-rose-600">{errorMessage}</p> : null}
      {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
    </div>
  );
}
