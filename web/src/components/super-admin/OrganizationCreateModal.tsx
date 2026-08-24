'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Plus, RotateCcw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/api/apiClient';
import { toast } from '@/providers/toast-provider';

const schema = z.object({
  name: z.string().trim().min(2, 'Organization name is required'),
  legalName: z.string().optional(),
  slug: z.string().optional().or(z.literal('')),
  industry: z.string().optional(),
  organizationSize: z.string().optional(),
  businessEmail: z.string().email('Enter a valid business email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  website: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  subscriptionPlan: z.string().optional(),
  trialDays: z.coerce.number().int().min(1).max(365).optional(),
  status: z.string().optional(),
  adminName: z.string().optional(),
  adminEmail: z.string().email('Enter a valid admin email').optional().or(z.literal('')),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  confirmPassword: z.string().optional(),
  sendWelcomeEmail: z.boolean().optional(),
  enableImmediately: z.boolean().optional(),
}).superRefine((values, ctx) => {
  if (values.phone && values.phone.trim()) {
    const normalizedPhone = values.phone.replace(/[\s-]/g, '');
    if (!/^(?:\+91)?[6-9]\d{9}$/.test(normalizedPhone)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: 'Enter a valid Indian mobile number' });
    }
  }

  if (values.slug && values.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug.trim())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slug'], message: 'Use lowercase letters, numbers, and hyphens only' });
  }

  if (values.adminEmail && values.adminPassword && values.adminPassword !== values.confirmPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Passwords do not match' });
  }

  if (values.adminEmail && !values.adminPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adminPassword'], message: 'Provide a password for the primary admin' });
  }
});

type FormValues = z.infer<typeof schema>;

function getDefaultValues(): FormValues {
  return {
    name: '',
    legalName: '',
    slug: '',
    industry: '',
    organizationSize: '',
    businessEmail: '',
    phone: '',
    website: '',
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    address: '',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    subscriptionPlan: 'STARTER',
    trialDays: 14,
    status: 'ACTIVE',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    sendWelcomeEmail: true,
    enableImmediately: true,
  };
}

export function OrganizationCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: getDefaultValues(),
  });

  const watchedName = watch('name');
  const watchedSlug = watch('slug');
  const slugPreview = useMemo(() => {
    if (watchedSlug?.trim()) return watchedSlug.trim();
    return watchedName?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || '';
  }, [watchedName, watchedSlug]);

  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const handleClose = () => {
    reset(getDefaultValues());
    setError(null);
    setSuccess(false);
    onClose();
  };

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      const normalizedPayload = {
        name: values.name.trim(),
        legalName: values.legalName?.trim() || undefined,
        slug: values.slug?.trim() || undefined,
        businessEmail: values.businessEmail?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        website: values.website?.trim() || undefined,
        country: values.country?.trim() || 'India',
        state: values.state?.trim() || 'Maharashtra',
        city: values.city?.trim() || 'Mumbai',
        timezone: values.timezone?.trim() || 'Asia/Kolkata',
        currency: values.currency?.trim() || 'INR',
        logoUrl: undefined,
        adminEmail: values.adminEmail?.trim() || undefined,
        adminPassword: values.adminPassword?.trim() || undefined,
        adminName: values.adminName?.trim() || undefined,
        subscriptionPlan: values.subscriptionPlan || 'STARTER',
        trialDays: values.trialDays ?? 14,
        status: values.status || 'ACTIVE',
      };

      await apiClient('/organizations', {
        method: 'POST',
        body: JSON.stringify(normalizedPayload),
      });

      setSuccess(true);
      onCreated();
      toast.success('Organization created', `${normalizedPayload.name} is now available for your platform team.`);
      reset(getDefaultValues());
      window.setTimeout(() => {
        handleClose();
        setSuccess(false);
      }, 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to create organization';
      setError(message);
      toast.error('Creation failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-120 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
        <motion.div initial={{ y: 20, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 10, opacity: 0, scale: 0.98 }} className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-4xl border border-slate-200/70 bg-white shadow-[0_32px_80px_-24px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Create organization</h2>
              <p className="mt-1 text-sm text-slate-500">Launch a new tenant and provision the first admin account.</p>
            </div>
            <button type="button" onClick={handleClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
            {success ? (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                Organization created successfully.
              </div>
            ) : null}

            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Organization Name</label>
                    <Input {...register('name')} placeholder="Northwind Labs" />
                    {errors.name ? <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p> : null}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Legal Name</label>
                    <Input {...register('legalName')} placeholder="Northwind Labs Inc." />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Organization Slug</label>
                    <Input {...register('slug')} placeholder="northwind-labs" />
                    {slugPreview ? <p className="mt-1 text-xs text-slate-500">Preview: {slugPreview}</p> : null}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Industry</label>
                    <Input {...register('industry')} placeholder="Software" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Organization Size</label>
                    <Select {...register('organizationSize')}>
                      <option value="">Select size</option>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201-1000">201-1000</option>
                      <option value="1000+">1000+</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Subscription Plan</label>
                    <Select {...register('subscriptionPlan')}>
                      <option value="STARTER">Starter</option>
                      <option value="PRO">Pro</option>
                      <option value="ENTERPRISE">Enterprise</option>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Business Email</label>
                    <Input type="email" {...register('businessEmail')} placeholder="ops@northwind.example" />
                    {errors.businessEmail ? <p className="mt-1 text-xs text-rose-600">{errors.businessEmail.message}</p> : null}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
                    <Input {...register('phone')} placeholder="+1 555 000 0000" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Website</label>
                  <Input {...register('website')} placeholder="https://northwind.example" />
                  {errors.website ? <p className="mt-1 text-xs text-rose-600">{errors.website.message}</p> : null}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Country</label>
                    <Input {...register('country')} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">State</label>
                    <Input {...register('state')} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">City</label>
                    <Input {...register('city')} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Address</label>
                    <Textarea {...register('address')} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Timezone</label>
                      <Input {...register('timezone')} placeholder="America/Los_Angeles" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Currency</label>
                      <Input {...register('currency')} placeholder="USD" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-slate-50 p-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Logo Upload</label>
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-500">
                    Drag-and-drop upload is not wired to a backend endpoint yet. The organization can still be created without a logo.
                  </div>
                </div>
                <div className="grid gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Trial Days</label>
                    <Input type="number" {...register('trialDays')} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Organization Status</label>
                    <Select {...register('status')}>
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspended</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="CANCELLED">Cancelled</option>
                    </Select>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Primary Admin</h3>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Admin Name</label>
                      <Input {...register('adminName')} placeholder="Avery Chen" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Admin Email</label>
                      <Input type="email" {...register('adminEmail')} placeholder="avery@northwind.example" />
                      {errors.adminEmail ? <p className="mt-1 text-xs text-rose-600">{errors.adminEmail.message}</p> : null}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Admin Password</label>
                      <Input type="password" {...register('adminPassword')} />
                      {errors.adminPassword ? <p className="mt-1 text-xs text-rose-600">{errors.adminPassword.message}</p> : null}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm Password</label>
                      <Input type="password" {...register('confirmPassword')} />
                      {errors.confirmPassword ? <p className="mt-1 text-xs text-rose-600">{errors.confirmPassword.message}</p> : null}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  <label className="flex items-center gap-3">
                    <Checkbox {...register('sendWelcomeEmail')} defaultChecked />
                    <span>Send welcome email</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <Checkbox {...register('enableImmediately')} defaultChecked />
                    <span>Enable immediately</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4">
              <Button type="button" variant="outline" onClick={() => reset(getDefaultValues())}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
                <Button type="submit" loading={submitting}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create organization
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
