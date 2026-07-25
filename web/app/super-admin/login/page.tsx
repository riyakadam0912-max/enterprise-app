'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock, User } from 'lucide-react';

import { useAuth } from '@/providers/AuthProvider';
import { getAuthSessionSnapshot } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/typography/Label';
import { Heading } from '@/components/typography/Heading';
import { Caption } from '@/components/typography/Caption';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const methods = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setError('');
    try {
      await login(values.email, values.password);
      const snapshot = getAuthSessionSnapshot();
      const needsOrganizationSelection = snapshot.organizationId == null;
      if (needsOrganizationSelection) {
        router.push('/select-organization');
      } else {
        router.push('/super-admin/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <Heading level={1} className="font-bold text-slate-900">
              Super Admin Console
            </Heading>
          <Caption className="text-slate-500 mt-2">
            Sign in to access the global administration dashboard
          </Caption>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  className="pl-10"
                  {...methods.register('email')}
                />
              </div>
              {methods.formState.errors.email && (
                <Caption className="text-rose-600">
                  {methods.formState.errors.email.message}
                </Caption>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  {...methods.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {methods.formState.errors.password && (
                <Caption className="text-rose-600">
                  {methods.formState.errors.password.message}
                </Caption>
              )}
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <Caption className="text-rose-700">{error}</Caption>
              </div>
            )}

            <Button type="submit" className="w-full" loading={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
