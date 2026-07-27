import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

export type PasswordInputProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, 'type'>;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, id, ...props },
  ref,
) {
  const [showPassword, setShowPassword] = React.useState(false);
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  return (
    <div className="relative">
      <Input
        ref={ref}
        id={inputId}
        type={showPassword ? 'text' : 'password'}
        className={cn('pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword((value) => !value)}
        className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        aria-pressed={showPassword}
        aria-controls={inputId}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
