import { type FieldValues, type Path, useFormContext } from 'react-hook-form';

export function useFormFieldState<TFieldValues extends FieldValues>(name: Path<TFieldValues>) {
  const { formState, getFieldState } = useFormContext<TFieldValues>();
  return getFieldState(name, formState);
}

export function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return undefined;
}
