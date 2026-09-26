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

export function OrganizationSwitcher() {
  const session = useAuthSession();
  const [organizations, setOrganizations] = useState<AccessibleOrganization[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (session.role !== 'ADMIN') {
      setOrganizations([]);
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

  if (session.role !== 'ADMIN' || organizations.length <= 1) return null;

  const activeOrganizationId =
    getActiveOrganizationId() ?? session.organizationId ?? '';

  async function handleChange(value: string) {
    const organizationId = Number(value);
    const organization = organizations.find((item) => item.id === organizationId);
    if (!organization || organizationId === activeOrganizationId || switching) return;

    setSwitching(true);
    setActiveOrganization(organization.id);
    setActiveOrganizationDetails({
      name: organization.name,
      logoUrl: organization.logoUrl,
      slug: organization.slug,
    });
    window.location.reload();
  }

  return (
    <label className="flex items-center">
      <span className="sr-only">Active organization</span>
      <select
        aria-label="Switch organization"
        value={activeOrganizationId}
        disabled={switching}
        onChange={(event) => void handleChange(event.target.value)}
        className="max-w-44 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
    </label>
  );
}