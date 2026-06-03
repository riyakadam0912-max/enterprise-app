import * as React from 'react';
import { cn } from '@/lib/cn';

export const Radio = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Radio(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="radio"
      className={cn(
        'h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
