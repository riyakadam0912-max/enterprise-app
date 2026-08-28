'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Plus, RotateCcw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { PhoneDialCodeInput } from '@/components/ui/phone-dial-code-input';
import { apiClient } from '@/api/apiClient';
import { toast } from '@/providers/toast-provider';
import {
  getCountryOptions,
  getStateOptions,
  getCityOptions,
  getTimezoneOptions,
  getCurrencyOptions,
} from '@/lib/geo-options';

// ─── Zod schema ──────────────────────────────────────────────────────────────

const schema = z
  .object({
    name: z.string().trim().min(2, 'Organization name is required'),
    legalName: z.string().optional(),
    slug: z.string().optional().or(z.literal('')),
    industry: z.string().optional(),
    organizationSize: z.string().optional(),
    businessEmail: z
      .string()
      .email('Enter a valid business email')
      .optional()
      .or(z.literal('')),
    /** Full phone e.g. "+91 9876543210" */
    phone: z.string().optional().or(z.literal('')),
    website: z
      .string()
      .url('Enter a valid URL')
      .optional()
      .or(z.literal('')),
    /** ISO country code "IN" */
    country: z.string().optional(),
    /** ISO state code "MH" */
    state: z.string().optional(),
    /** City name */
    city: z.string().optional(),
    address: z.string().optional(),
    /** IANA timezone "Asia/Kolkata" */
    timezone: z.string().optional(),
    /** ISO 4217 currency code "INR" */
    currency: z.string().optional(),
    status: z.string().optional(),
    adminName: z.string().optional(),
    adminEmail: z
      .string()
      .email('Enter a valid admin email')
      .optional()
      .or(z.literal('')),
    adminPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .optional()
      .or(z.literal('')),
    confirmPassword: z.string().optional(),
    sendWelcomeEmail: z.boolean().optional(),
    enableImmediately: z.boolean().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.slug?.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['slug'],
        message: 'Use lowercase letters, numbers, and hyphens only',
      });
    }
    if (
      values.adminEmail &&
      values.adminPassword &&
      values.adminPassword !== values.confirmPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      });
    }
    if (values.adminEmail && !values.adminPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['adminPassword'],
        message: 'Provide a password for the primary admin',
      });
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
    phone: '+91 ',
    website: '',
    country: 'IN',
    state: 'MH',
    city: 'Mumbai',
    address: '',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    status: 'ACTIVE',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    sendWelcomeEmail: true,
    enableImmediately: true,
  };
}

// ─── Static option lists (computed once) ─────────────────────────────────────

const COUNTRY_OPTIONS = getCountryOptions();
const TIMEZONE_OPTIONS = getTimezoneOptions();
const CURRENCY_OPTIONS = getCurrencyOptions();

// ─── Component ────────────────────────────────────────────────────────────────

export function OrganizationCreateModal({
  open,
  onClose,
  onCreated,
  parentId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  parentId?: number;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: getDefaultValues(),
  });

  const watchedName = watch('name');
  const watchedSlug = watch('slug');
  const watchedCountry = watch('country');
  const watchedState = watch('state');

  const slugPreview = useMemo(() => {
    if (watchedSlug?.trim()) return watchedSlug.trim();
    return (
      watchedName
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || ''
    );
  }, [watchedName, watchedSlug]);

  // Cascading resets
  useEffect(() => {
    setValue('state', '');
    setValue('city', '');
  }, [watchedCountry, setValue]);

  useEffect(() => {
    setValue('city', '');
  }, [watchedState, setValue]);

  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const stateOptions = useMemo(
    () => getStateOptions(watchedCountry ?? ''),
    [watchedCountry],
  );

  const cityOptions = useMemo(
    () => getCityOptions(watchedCountry ?? '', watchedState ?? ''),
    [watchedCountry, watchedState],
  );

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
      const payload = {
        name: values.name.trim(),
        legalName: values.legalName?.trim() || undefined,
        slug: values.slug?.trim() || undefined,
        businessEmail: values.businessEmail?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        website: values.website?.trim() || undefined,
        country: values.country || undefined,
        state: values.state || undefined,
        city: values.city || undefined,
        address: values.address?.trim() || undefined,
        timezone: values.timezone || 'Asia/Kolkata',
        currency: values.currency || 'INR',
        industry: values.industry?.trim() || undefined,
        status: values.status || 'ACTIVE',
        adminEmail: values.adminEmail?.trim() || undefined,
        adminPassword: values.adminPassword?.trim() || undefined,
        adminName: values.adminName?.trim() || undefined,
        sendWelcomeEmail: values.sendWelcomeEmail,
        enableImmediately: values.enableImmediately,
        parentId: parentId ?? undefined,
      };

      await apiClient('/organizations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccess(true);
      onCreated();
      toast.success(
        'Organization created',
        `${payload.name} is now available for your platform team.`,
      );
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-120 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 10, opacity: 0, scale: 0.98 }}
          className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-4xl border border-slate-200/70 bg-white shadow-[0_32px_80px_-24px_rgba(15,23,42,0.45)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Create organization</h2>
              <p className="mt-1 text-sm text-slate-500">
                Launch a new tenant and provision the first admin account.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
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
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              {/* ── Left column ── */}
              <div className="space-y-4">

                {/* Name + Legal Name */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Organization Name <span className="text-rose-500">*</span>
                    </label>
                    <Input {...register('name')} placeholder="Ekdrishti Group" />
                    {errors.name ? (
                      <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Legal Name
                    </label>
                    <Input
                      {...register('legalName')}
                      placeholder="Ekdrishti Group PVT LTD"
                    />
                  </div>
                </div>

                {/* Slug + Industry */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Slug
                    </label>
                    <Input {...register('slug')} placeholder="ekdrishti-group" />
                    {errors.slug ? (
                      <p className="mt-1 text-xs text-rose-600">{errors.slug.message}</p>
                    ) : null}
                    {slugPreview ? (
                      <p className="mt-1 text-xs text-slate-500">Preview: {slugPreview}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Industry
                    </label>
                    <Input {...register('industry')} placeholder="Technology" />
                  </div>
                </div>

                {/* Org size */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Organization Size
                    </label>
                    <Select {...register('organizationSize')}>
                      <option value="">Select size</option>
                      <option value="1-10">1–10</option>
                      <option value="11-50">11–50</option>
                      <option value="51-200">51–200</option>
                      <option value="201-1000">201–1000</option>
                      <option value="1000+">1000+</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Business Email
                    </label>
                    <Input
                      type="email"
                      {...register('businessEmail')}
                      placeholder="ops@example.com"
                    />
                    {errors.businessEmail ? (
                      <p className="mt-1 text-xs text-rose-600">
                        {errors.businessEmail.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Phone (with dial code) */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <Controller
                    name="phone"
                    control={control}
                    render={({ field }) => (
                      <PhoneDialCodeInput
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Website
                  </label>
                  <Input
                    {...register('website')}
                    placeholder="https://example.com"
                  />
                  {errors.website ? (
                    <p className="mt-1 text-xs text-rose-600">{errors.website.message}</p>
                  ) : null}
                </div>

                {/* Country → State → City (cascading) */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Country
                    </label>
                    <Controller
                      name="country"
                      control={control}
                      render={({ field }) => (
                        <SearchableSelect
                          options={COUNTRY_OPTIONS}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          placeholder="Select country"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      State / Region
                    </label>
                    <Controller
                      name="state"
                      control={control}
                      render={({ field }) => (
                        <SearchableSelect
                          options={stateOptions}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          placeholder={
                            watchedCountry ? 'Select state' : 'Select country first'
                          }
                          disabled={!watchedCountry || stateOptions.length === 0}
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      City
                    </label>
                    <Controller
                      name="city"
                      control={control}
                      render={({ field }) => (
                        <SearchableSelect
                          options={cityOptions}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          placeholder={
                            watchedState ? 'Select city' : 'Select state first'
                          }
                          disabled={!watchedState || cityOptions.length === 0}
                        />
                      )}
                    />
                  </div>
                </div>

                {/* Address + Timezone + Currency */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Address
                    </label>
                    <Textarea {...register('address')} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Time Zone
                      </label>
                      <Controller
                        name="timezone"
                        control={control}
                        render={({ field }) => (
                          <SearchableSelect
                            options={TIMEZONE_OPTIONS}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Select timezone"
                          />
                        )}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Currency
                      </label>
                      <Controller
                        name="currency"
                        control={control}
                        render={({ field }) => (
                          <SearchableSelect
                            options={CURRENCY_OPTIONS}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Select currency"
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Right column ── */}
              <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-slate-50 p-4">
                {/* Logo placeholder */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Logo Upload
                  </label>
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-500">
                    Drag-and-drop upload is not wired to a backend endpoint yet.
                    The organization can still be created without a logo.
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Organization Status
                  </label>
                  <Select {...register('status')}>
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="CANCELLED">Cancelled</option>
                  </Select>
                </div>

                {/* Primary admin */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Primary Admin</h3>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Admin Name
                      </label>
                      <Input {...register('adminName')} placeholder="Avery Chen" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Admin Email
                      </label>
                      <Input
                        type="email"
                        {...register('adminEmail')}
                        placeholder="avery@example.com"
                      />
                      {errors.adminEmail ? (
                        <p className="mt-1 text-xs text-rose-600">
                          {errors.adminEmail.message}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Admin Password
                      </label>
                      <Input type="password" {...register('adminPassword')} />
                      {errors.adminPassword ? (
                        <p className="mt-1 text-xs text-rose-600">
                          {errors.adminPassword.message}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Confirm Password
                      </label>
                      <Input type="password" {...register('confirmPassword')} />
                      {errors.confirmPassword ? (
                        <p className="mt-1 text-xs text-rose-600">
                          {errors.confirmPassword.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Options */}
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

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => reset(getDefaultValues())}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
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
