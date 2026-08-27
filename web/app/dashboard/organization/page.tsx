'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, Plus, Save } from 'lucide-react';
import {
  getMyOrganization,
  listOrganizations,
  updateMyOrganization,
  type Organization,
} from '@/api/organizationsApi';
import {
  isSuperAdminSession,
  setActiveOrganization,
  useAuthSession,
  getActiveOrganizationId,
} from '@/stores/auth-store';
import { OrganizationCreateModal } from '@/components/super-admin/OrganizationCreateModal';

type EditableField =
  | 'name'
  | 'slug'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'state'
  | 'country'
  | 'timezone'
  | 'currency'
  | 'website'
  | 'industry';

const fields: Array<{ key: EditableField; label: string; type?: string }> = [
  { key: 'name', label: 'Organization name' },
  { key: 'slug', label: 'Slug' },
  { key: 'email', label: 'Business email', type: 'email' },
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website', type: 'url' },
  { key: 'industry', label: 'Industry' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'timezone', label: 'Timezone' },
  { key: 'currency', label: 'Currency' },
];

/** Derive initials from an org name for the logo fallback. */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export default function OrganizationPage() {
  const router = useRouter();
  const session = useAuthSession();
  const isSuperAdmin = isSuperAdminSession(session);

  // Active org id (set when SA is impersonating an org)
  const [activeOrgId, setActiveOrgId] = useState<number | null>(null);

  const [parentOrg, setParentOrg] = useState<Organization | null>(null);
  const [childOrgs, setChildOrgs] = useState<Organization[]>([]);

  // Edit form state (for ADMIN role editing their own org)
  const [form, setForm] = useState<Record<EditableField, string>>(
    {} as Record<EditableField, string>,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    // Resolve active org id on client (reads from sessionStorage)
    setActiveOrgId(getActiveOrganizationId());
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      const impersonatedId = getActiveOrganizationId();

      if (impersonatedId != null) {
        // SA is impersonating an org — show that org's info + its children.
        // The backend will scope to `parentId = impersonatedId` because
        // X-Organization-Id header is already set by axiosClient.
        // We also fetch the parent org details for the header display.
        Promise.all([
          // Fetch the parent org details
          fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/organizations/${impersonatedId}`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-Organization-Id': String(impersonatedId),
            },
          })
            .then((r) => r.json())
            .then((body: { data?: Organization }) => body.data ?? null)
            .catch(() => null),
          // Fetch child orgs — backend scopes to parentId = impersonatedId
          listOrganizations({ parentId: impersonatedId }),
        ])
          .then(([parent, children]) => {
            setParentOrg(parent);
            setChildOrgs(children);
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Unable to load organizations');
          })
          .finally(() => setLoading(false));
      } else {
        // Pure SA global view — no org context, show all top-level orgs
        listOrganizations()
          .then((orgs) => {
            setParentOrg(null);
            setChildOrgs(orgs);
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Unable to load organizations');
          })
          .finally(() => setLoading(false));
      }
      return;
    }

    if (session.role === 'ADMIN') {
      // Regular admin: load their own org + its children
      Promise.all([
        getMyOrganization(),
        listOrganizations(), // backend scopes to parentId = user.organizationId
      ])
        .then(([myOrg, children]) => {
          setParentOrg(myOrg);
          setChildOrgs(children);
          setForm(
            Object.fromEntries(
              fields.map(({ key }) => [key, myOrg[key as keyof Organization] ?? '']),
            ) as Record<EditableField, string>,
          );
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Unable to load organization');
        })
        .finally(() => setLoading(false));
      return;
    }

    // Other roles have no org management access
    setLoading(false);
  }, [isSuperAdmin, session.role]);

  const set = (key: EditableField, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const selectOrganization = (organizationId: number) => {
    setActiveOrganization(organizationId);
    router.replace('/dashboard');
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await updateMyOrganization(form);
      setParentOrg(updated);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save organization details');
    } finally {
      setSaving(false);
    }
  }

  function refreshOrgs() {
    if (isSuperAdmin) {
      const impersonatedId = getActiveOrganizationId();
      if (impersonatedId != null) {
        void listOrganizations({ parentId: impersonatedId }).then(setChildOrgs);
      } else {
        void listOrganizations().then(setChildOrgs);
      }
    } else {
      void listOrganizations().then(setChildOrgs);
    }
  }

  // ── Super Admin view ───────────────────────────────────────────────────
  if (isSuperAdmin) {
    const contextLabel = parentOrg
      ? `Children of ${parentOrg.name}`
      : 'All Organizations';
    const contextParentId = parentOrg?.id ?? activeOrgId ?? undefined;

    return (
      <div className="min-h-full bg-slate-50 p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Parent org logo / initials */}
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white overflow-hidden shrink-0">
              {parentOrg?.logoUrl ? (
                <img
                  src={parentOrg.logoUrl}
                  alt={parentOrg.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Organizations
              </h1>
              <p className="text-sm text-slate-500">{contextLabel}</p>
              {parentOrg ? (
                <p className="mt-0.5 text-xs text-indigo-600 font-medium">
                  Context: {parentOrg.name}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Create organization
          </button>
        </div>

        {error ? (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-500">Loading organizations…</div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {childOrgs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                        No child organizations found{parentOrg ? ` under ${parentOrg.name}` : ''}.
                      </td>
                    </tr>
                  ) : (
                    childOrgs.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-4 font-medium text-slate-900">
                          <div className="flex items-center gap-2.5">
                            {/* Logo / initials */}
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold overflow-hidden">
                              {item.logoUrl ? (
                                <img
                                  src={item.logoUrl}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display =
                                      'none';
                                    (
                                      e.currentTarget.parentElement as HTMLElement
                                    ).textContent = getInitials(item.name);
                                  }}
                                />
                              ) : (
                                getInitials(item.name)
                              )}
                            </div>
                            <div>
                              <span>{item.name}</span>
                              <span className="ml-2 text-xs font-normal text-slate-500">
                                {item.slug}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{item.code}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {item.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {new Date(item.createdAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => selectOrganization(item.id)}
                            disabled={item.status !== 'ACTIVE'}
                            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <OrganizationCreateModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={refreshOrgs}
          parentId={contextParentId}
        />
      </div>
    );
  }

  // ── Regular ADMIN view ────────────────────────────────────────────────
  if (session.role !== 'ADMIN') return null;
  if (loading) return <div className="p-6 text-sm text-slate-500">Loading organization…</div>;

  return (
    <div className="min-h-full bg-slate-50 p-6">
      {/* Header with logo/initials */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white overflow-hidden">
          {parentOrg?.logoUrl ? (
            <img
              src={parentOrg.logoUrl}
              alt={parentOrg.name ?? 'Organization'}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <Building2 className="h-5 w-5" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {parentOrg?.name ?? 'Organization'}
          </h1>
          <p className="text-sm text-slate-500">Manage your organization profile and sub-organizations.</p>
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Edit form */}
      {parentOrg ? (
        <form
          onSubmit={handleSubmit}
          className="mb-8 max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <p className="font-semibold text-slate-900">Organization profile</p>
              <p className="text-sm text-slate-500">Status: {parentOrg.status}</p>
            </div>
            {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map(({ key, label, type }) => (
              <label key={key} className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">{label}</span>
                <input
                  type={type ?? 'text'}
                  value={form[key]}
                  onChange={(event) => set(key, event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-orange-400"
                />
              </label>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : null}

      {/* Child organizations */}
      <div className="max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Sub-organizations</h2>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Add sub-organization
          </button>
        </div>
        {childOrgs.length === 0 ? (
          <p className="text-sm text-slate-500">No sub-organizations yet.</p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {childOrgs.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold overflow-hidden">
                            {item.logoUrl ? (
                              <img
                                src={item.logoUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  (e.currentTarget.parentElement as HTMLElement).textContent =
                                    getInitials(item.name);
                                }}
                              />
                            ) : (
                              getInitials(item.name)
                            )}
                          </div>
                          <div>
                            <span>{item.name}</span>
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              {item.slug}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{item.code}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {item.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {new Date(item.createdAt).toLocaleDateString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <OrganizationCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refreshOrgs}
        parentId={parentOrg?.id}
      />
    </div>
  );
}
