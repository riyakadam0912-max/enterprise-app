'use client';

import { useEffect, useState } from 'react';
import {
  getAccessibleOrganizations,
  type AccessibleOrganization,
} from '@/api/organizationsApi';
import {
  getActiveOrganizationId,
  setActiveOrganization,
  setActiveOrganizationDetails,
  useAuthSession,
} from '@/stores/auth-store';

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'O';
}

export function OrganizationSwitcher() {
  const session = useAuthSession();
  const [organizations, setOrganizations] = useState<AccessibleOrganization[]>([]);
  const [switching, setSwitching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (session.role !== 'ADMIN') {
      return;
    }

    void getAccessibleOrganizations()
      .then((accessible) => {
        setOrganizations(accessible);
        const activeId = getActiveOrganizationId() ?? session.organizationId;
        const activeOrganization = accessible.find((item) => item.id === activeId);

        if (activeOrganization) {
          setActiveOrganizationDetails({
            name: activeOrganization.name,
            logoUrl: activeOrganization.logoUrl,
            slug: activeOrganization.slug,
          });
        }
      })
      .catch(() => setOrganizations([]));
  }, [session.role, session.user?.id, session.organizationId]);

  const visibleOrganizations = session.role === 'ADMIN' ? organizations : [];

  if (session.role !== 'ADMIN' || visibleOrganizations.length <= 1) return null;

  const activeOrganizationId = getActiveOrganizationId() ?? session.organizationId ?? '';
  const activeOrganization =
    visibleOrganizations.find((organization) => organization.id === Number(activeOrganizationId)) ?? visibleOrganizations[0];
  const displayName = activeOrganization?.name ?? session.organizationName ?? 'Organization';

  async function handleSwitch(organization: AccessibleOrganization) {
    if (organization.id === Number(activeOrganizationId) || switching) return;

    setSwitching(true);
    setActiveOrganization(organization.id);
    setActiveOrganizationDetails({
      name: organization.name,
      logoUrl: organization.logoUrl,
      slug: organization.slug,
    });
    setIsOpen(false);
    window.location.reload();
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Switch organization"
        disabled={switching}
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {activeOrganization?.logoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeOrganization.logoUrl}
              alt={displayName}
              className="h-4 w-4 rounded-full object-cover"
              onError={(event) => {
                (event.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </>
        ) : (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[8px] font-bold text-white leading-none">
            {getInitials(displayName)}
          </span>
        )}
        <span className="max-w-[9rem] truncate">{displayName}</span>
        <svg
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)]">
          {visibleOrganizations.map((organization) => {
            const isActive = organization.id === Number(activeOrganizationId);

            return (
              <button
                key={organization.id}
                type="button"
                onClick={() => void handleSwitch(organization)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                  isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {organization.logoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={organization.logoUrl}
                      alt={organization.name}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  </>
                ) : (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white leading-none">
                    {getInitials(organization.name)}
                  </span>
                )}
                <span className="truncate font-medium">{organization.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}