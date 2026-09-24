'use client';

import { useRouter } from 'next/navigation';
import { ArrowRightLeft, Building2, ShieldCheck } from 'lucide-react';

import {
  clearActiveOrganization,
  getActiveOrganizationId,
  isSuperAdminSession,
  useAuthSession,
} from '@/stores/auth-store';

export default function ImpersonationBanner() {
  const router = useRouter();
  const session = useAuthSession();
  const activeOrganizationId = getActiveOrganizationId();

  const isImpersonating = isSuperAdminSession(session) && activeOrganizationId != null;

  if (!isImpersonating) {
    return null;
  }

  // Use the persisted org name (set by Topbar's fetch effect) — fall back to ID.
  const displayName = session.organizationName ?? `Organisation #${activeOrganizationId}`;

  const handleSwitchOrganization = () => {
    router.push('/super-admin/organizations');
  };

  const handleReturnToConsole = () => {
    clearActiveOrganization();
    router.replace('/super-admin/dashboard');
  };

  return (
    <details className="relative">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm hover:bg-indigo-100" title={`Impersonating ${displayName}`}>
        <ShieldCheck className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-indigo-200 bg-white p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
          <div><p className="text-sm font-semibold text-slate-900">Organisation context</p><p className="mt-1 text-xs leading-5 text-slate-500">Operating as Organisation Admin for <span className="font-semibold text-indigo-700">{displayName}</span>.</p></div>
        </div>
        <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={handleSwitchOrganization} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-indigo-200 px-2 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"><ArrowRightLeft className="h-3.5 w-3.5" />Switch</button>
          <button type="button" onClick={handleReturnToConsole} className="flex-1 rounded-lg bg-indigo-600 px-2 py-2 text-xs font-semibold text-white hover:bg-indigo-700">Console</button>
        </div>
      </div>
    </details>
  );
}
