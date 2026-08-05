'use client';

import { useRouter } from 'next/navigation';
import { ArrowRightLeft, Building2, ShieldCheck } from 'lucide-react';

import { clearActiveOrganization, getActiveOrganizationId, isSuperAdminSession, useAuthSession } from '@/stores/auth-store';

export default function ImpersonationBanner() {
  const router = useRouter();
  const session = useAuthSession();
  const activeOrganizationId = getActiveOrganizationId();

  const isImpersonating = isSuperAdminSession(session) && activeOrganizationId != null;

  if (!isImpersonating) {
    return null;
  }

  const handleSwitchOrganization = () => {
    router.push('/super-admin/organizations');
  };

  const handleReturnToConsole = () => {
    clearActiveOrganization();
    router.replace('/super-admin/dashboard');
  };

  return (
    <div className="border-b border-indigo-200 bg-indigo-50/80 px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-indigo-600 p-2 text-white shadow-sm">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-700" />
              <p className="text-sm font-semibold text-indigo-900">Organization impersonation mode</p>
            </div>
            <p className="mt-1 text-sm text-indigo-700">
              You are currently operating as the Organization Admin for tenant #{activeOrganizationId}. All tenant-scoped tools and APIs are using this organization context.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSwitchOrganization}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Switch Organization
          </button>
          <button
            type="button"
            onClick={handleReturnToConsole}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Return to Console
          </button>
        </div>
      </div>
    </div>
  );
}
