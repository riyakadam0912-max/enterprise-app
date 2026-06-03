import * as React from 'react';
import { cn } from '@/lib/cn';

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  indeterminate?: boolean;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, indeterminate = false, ...props },
  ref,
) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      className={cn(
        'h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
