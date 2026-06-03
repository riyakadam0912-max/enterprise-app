'use client';

import { Controller, type FieldValues, type Path, useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/typography/Label';
import { cn } from '@/lib/cn';
import { getErrorMessage, useFormFieldState } from './form-utils';

export function FormFileUpload<TFieldValues extends FieldValues>({
  name,
  label,
  helperText,
  accept,
  multiple = false,
  className,
}: {
  name: Path<TFieldValues>;
  label: string;
  helperText?: string;
  accept?: string;
  multiple?: boolean;
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
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={(event) => field.onChange(multiple ? Array.from(event.target.files ?? []) : event.target.files?.[0] ?? null)}
          />
        )}
      />
      {errorMessage ? <p className="text-xs font-medium text-rose-600">{errorMessage}</p> : null}
      {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
    </div>
  );
}
