'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Pencil,
  Plus,
  Save,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getMyOrganization,
  listOrganizations,
  updateMyOrganization,
  deleteOrganization,
  type Organization,
} from '@/api/organizationsApi';
import {
  isSuperAdminSession,
  setActiveOrganization,
  useAuthSession,
  getActiveOrganizationId,
} from '@/stores/auth-store';
import { OrganizationCreateModal } from '@/components/super-admin/OrganizationCreateModal';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { PhoneDialCodeInput } from '@/components/ui/phone-dial-code-input';
import { Dialog } from '@/components/Dialog';
import {
  getCountryOptions,
  getStateOptions,
  getCityOptions,
  getTimezoneOptions,
  getCurrencyOptions,
  resolveCountryCode,
  resolveStateCode,
} from '@/lib/geo-options';
import { axiosClient } from '@/api/axiosClient';

// ─── Static option lists ─────────────────────────────────────────────────────
const COUNTRY_OPTIONS = getCountryOptions();
const CURRENCY_OPTIONS = getCurrencyOptions();

/** Derive initials from an org name for the logo fallback. */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// ─── Edit-form state type ────────────────────────────────────────────────────

interface OrgEditForm {
  name: string;
  slug: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  address: string;
  /** ISO country code e.g. "IN" */
  country: string;
  /** ISO state code e.g. "MH" */
  state: string;
  /** City name */
  city: string;
  /** IANA timezone */
  timezone: string;
  /** ISO 4217 currency */
  currency: string;
}

function orgToForm(org: Organization): OrgEditForm {
  // Resolve stored country/state to ISO codes (handles legacy full-name values)
  const countryCode = resolveCountryCode(org.country);
  const stateCode = resolveStateCode(countryCode, org.state);
  return {
    name: org.name ?? '',
    slug: org.slug ?? '',
    email: org.email ?? '',
    phone: org.phone ?? '',
    website: org.website ?? '',
    industry: org.industry ?? '',
    address: org.address ?? '',
    country: countryCode,
    state: stateCode,
    city: org.city ?? '',
    timezone: org.timezone ?? '',
    currency: org.currency ?? '',
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

type OrganizationProfitLossRow = {
  name: string;
  profit: number;
  loss: number;
  net: number;
};

function toChartName(name: string) {
  return name.length > 12 ? `${name.slice(0, 12)}...` : name;
}

async function loadChildProfitLossData(orgs: Organization[]): Promise<OrganizationProfitLossRow[]> {
  if (orgs.length === 0) return [];

  const rows = await Promise.all(
    orgs.map(async (org) => {
      try {
        const response = await axiosClient.get('/reports/overview', {
          headers: {
            'X-Organization-Id': String(org.id),
          },
        });

        const payload = response.data;
        const summary = payload?.data?.summary ?? payload?.summary ?? {};
        const profit = Number(summary.totalRevenue ?? 0);
        const loss = Number(summary.totalExpenses ?? 0);

        return {
          name: toChartName(org.name),
          profit,
          loss,
          net: profit - loss,
        };
      } catch {
        return {
          name: toChartName(org.name),
          profit: 0,
          loss: 0,
          net: 0,
        };
      }
    }),
  );

  return rows;
}

function SummaryStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose';
}) {
  const toneClasses = {
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  };

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_-26px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-24px_rgba(15,23,42,0.42)]">
      <div className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase ring-1 ${toneClasses[tone]}`}>
        {label}
      </div>
      <p className="mt-4 text-[26px] font-semibold tracking-[-0.04em] text-slate-900">{value}</p>
      <p className="mt-1.5 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OrganizationPage() {
  const router = useRouter();
  const session = useAuthSession();
  const isSuperAdmin = isSuperAdminSession(session);

  const [activeOrgId, setActiveOrgId] = useState<number | null>(null);
  const [parentOrg, setParentOrg] = useState<Organization | null>(null);
  const [childOrgs, setChildOrgs] = useState<Organization[]>([]);
  const [form, setForm] = useState<OrgEditForm>({
    name: '', slug: '', email: '', phone: '', website: '', industry: '',
    address: '', country: 'IN', state: 'MH', city: '', timezone: 'Asia/Kolkata', currency: 'INR',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Organization | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [deletingChild, setDeletingChild] = useState(false);
  const [childProfitLossData, setChildProfitLossData] = useState<OrganizationProfitLossRow[]>([]);

  // Cascading state options
  const stateOptions = useMemo(() => getStateOptions(form.country), [form.country]);
  const cityOptions = useMemo(() => getCityOptions(form.country, form.state), [form.country, form.state]);
  const timezoneOptions = useMemo(() => getTimezoneOptions(form.country), [form.country]);
  const organizationSummary = useMemo(() => {
    const totalChildren = childOrgs.length;
    const activeChildren = childOrgs.filter((org) => org.status === 'ACTIVE').length;
    const totalProfit = childProfitLossData.reduce((sum, row) => sum + row.profit, 0);
    const totalLoss = childProfitLossData.reduce((sum, row) => sum + row.loss, 0);

    return {
      totalChildren,
      activeChildren,
      totalProfit,
      totalLoss,
      net: totalProfit - totalLoss,
    };
  }, [childOrgs.length, childProfitLossData]);

  useEffect(() => {
    let active = true;

    if (childOrgs.length === 0) {
      setChildProfitLossData([]);
      return;
    }

    void loadChildProfitLossData(childOrgs).then((rows) => {
      if (active) {
        setChildProfitLossData(rows);
      }
    });

    return () => {
      active = false;
    };
  }, [childOrgs]);

  useEffect(() => {
    setActiveOrgId(getActiveOrganizationId());
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      const impersonatedId = getActiveOrganizationId();
      if (impersonatedId != null) {
        Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/organizations/${impersonatedId}`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-Organization-Id': String(impersonatedId) },
          })
            .then((r) => r.json())
            .then((body: { data?: Organization }) => body.data ?? null)
            .catch(() => null),
          listOrganizations({ parentId: impersonatedId }),
        ])
          .then(([parent, children]) => { setParentOrg(parent); setChildOrgs(children); })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load organizations'))
          .finally(() => setLoading(false));
      } else {
        listOrganizations()
          .then((orgs) => { setParentOrg(null); setChildOrgs(orgs); })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load organizations'))
          .finally(() => setLoading(false));
      }
      return;
    }

    if (session.role === 'ADMIN') {
      Promise.all([getMyOrganization(), listOrganizations()])
        .then(([myOrg, children]) => {
          setParentOrg(myOrg);
          setChildOrgs(children);
          setForm(orgToForm(myOrg));
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load organization'))
        .finally(() => setLoading(false));
      return;
    }

    setLoading(false);
  }, [isSuperAdmin, session.role]);

  // Reset state when country changes
  function handleCountryChange(val: string) {
    setForm((f) => ({
      ...f,
      country: val,
      state: '',
      city: '',
      timezone: getTimezoneOptions(val)[0]?.value ?? '',
    }));
  }
  // Reset city when state changes
  function handleStateChange(val: string) {
    setForm((f) => ({ ...f, state: val, city: '' }));
  }

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
      const updated = await updateMyOrganization({
        name: form.name,
        slug: form.slug,
        email: form.email,
        phone: form.phone || undefined,
        website: form.website || undefined,
        industry: form.industry || undefined,
        address: form.address || undefined,
        country: form.country || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        timezone: form.timezone || undefined,
        currency: form.currency || undefined,
      });
      setParentOrg(updated);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save organization details');
    } finally {
      setSaving(false);
    }
  }

  function refreshOrgs() {
    const impersonatedId = isSuperAdmin ? getActiveOrganizationId() : null;
    if (isSuperAdmin && impersonatedId != null) {
      void listOrganizations({ parentId: impersonatedId }).then(setChildOrgs);
    } else {
      void listOrganizations().then(setChildOrgs);
    }
  }

  async function handleDeleteChild() {
    if (!deleteTarget) return;
    setDeletingChild(true);
    try {
      await deleteOrganization(deleteTarget.id);
      setDeleteTarget(null);
      refreshOrgs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to delete organization');
    } finally {
      setDeletingChild(false);
    }
  }

  // ── Super Admin view ───────────────────────────────────────────────────
  if (isSuperAdmin) {
    const contextLabel = parentOrg ? `Children of ${parentOrg.name}` : 'All Organizations';
    const contextParentId = parentOrg?.id ?? activeOrgId ?? undefined;

    return (
      <div className="min-h-full bg-slate-50 p-5 sm:p-6 lg:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-sm ring-1 ring-indigo-200">
              {parentOrg?.logoUrl ? (
                <img src={parentOrg.logoUrl} alt={parentOrg.name} className="h-full w-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600">Organization hub</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Organizations</h1>
              <p className="text-sm text-slate-500">{contextLabel}</p>
              {parentOrg ? (
                <p className="mt-0.5 text-xs font-medium text-indigo-600">Context: {parentOrg.name}</p>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={() => { setEditingChild(null); setCreateOpen(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700">
            <Plus className="h-4 w-4" />Create organization
          </button>
        </div>

        {error ? <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

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
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold overflow-hidden">
                              {item.logoUrl ? (
                                <img src={item.logoUrl} alt={item.name} className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    (e.currentTarget.parentElement as HTMLElement).textContent = getInitials(item.name);
                                  }} />
                              ) : getInitials(item.name)}
                            </div>
                            <div>
                              <span>{item.name}</span>
                              <span className="ml-2 text-xs font-normal text-slate-500">{item.slug}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{item.code}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />{item.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{new Date(item.createdAt).toLocaleDateString('en-GB')}</td>
                        <td className="px-5 py-4 text-right">
                          <button type="button" onClick={() => selectOrganization(item.id)}
                            disabled={item.status !== 'ACTIVE'}
                            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                            Open
                          </button>
                          <button type="button" onClick={() => { setEditingChild(item); setCreateOpen(true); }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <Pencil className="h-4 w-4" />Edit
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(item)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
                            <Trash2 className="h-4 w-4" />Delete
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
          onClose={() => { setCreateOpen(false); setEditingChild(null); }}
          onCreated={refreshOrgs}
          parentId={contextParentId}
          organization={editingChild}
        />

        <Dialog
          open={Boolean(deleteTarget)}
          title="Delete child organization"
          description={`This will remove ${deleteTarget?.name ?? 'this organization'} from the platform. This action cannot be undone.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => void handleDeleteChild()}
          confirmLabel={deletingChild ? 'Deleting…' : 'Delete'}
          cancelLabel="Cancel"
          destructive
        />
      </div>
    );
  }

  // ── Regular ADMIN view ────────────────────────────────────────────────
  if (session.role !== 'ADMIN') return null;
  if (loading) return <div className="p-6 text-sm text-slate-500">Loading organization…</div>;

  return (
    <div className="min-h-full bg-slate-50 p-5 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-sm ring-1 ring-orange-200">
            {parentOrg?.logoUrl ? (
              <img src={parentOrg.logoUrl} alt={parentOrg.name ?? 'Organization'} className="h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-600">Organization dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{parentOrg?.name ?? 'Organization'}</h1>
            <p className="text-sm text-slate-500">Manage your organization profile and sub-organizations.</p>
          </div>
        </div>

        <button type="button" onClick={() => { setEditingChild(null); setCreateOpen(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-orange-600">
          <Plus className="h-4 w-4" />Add sub-organization
        </button>
      </div>

      {error ? <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStat label="Child orgs" value={String(organizationSummary.totalChildren)} hint="Total active entities" tone="indigo" />
        <SummaryStat label="Active" value={String(organizationSummary.activeChildren)} hint="Operational branches" tone="emerald" />
        <SummaryStat label="Profit" value={formatCurrency(organizationSummary.totalProfit)} hint="Combined earnings" tone="amber" />
        <SummaryStat label="Net" value={formatCurrency(organizationSummary.net)} hint={organizationSummary.net >= 0 ? 'Positive margin' : 'Loss position'} tone={organizationSummary.net >= 0 ? 'emerald' : 'rose'} />
      </div>

      {parentOrg ? (
        <div className="mb-8 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_28px_-24px_rgba(15,23,42,0.3)]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3.5 sm:px-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Overview</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">Profit vs loss</h2>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2 py-1 text-[10px] font-semibold text-orange-700 ring-1 ring-orange-200">
              <TrendingUp className="h-3 w-3" />
              {childProfitLossData.length > 0 ? `${childProfitLossData.length} tracked` : 'No data'}
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.5fr_0.8fr]">
            <div className="h-[300px] rounded-[18px] border border-slate-200 bg-slate-50/60 p-2">
              {childProfitLossData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">No child organization performance data available yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={childProfitLossData} margin={{ top: 10, right: 10, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-12} textAnchor="end" height={50} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(value) => {
                        const numericValue = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0);
                        return formatCurrency(numericValue);
                      }}
                      contentStyle={{ borderRadius: 16, borderColor: '#e2e8f0', boxShadow: '0 16px 40px -24px rgba(15,23,42,0.45)' }}
                    />
                    <Legend />
                    <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="loss" name="Loss" fill="#f97316" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="space-y-3">
              {childProfitLossData.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Performance metrics will appear when child organizations have data.</div>
              ) : (
                childProfitLossData.slice(0, 4).map((row) => (
                  <div key={row.name} className="rounded-[20px] border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${row.net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {row.net >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {formatCurrency(row.net)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-100">
                        <p className="text-slate-500">Profit</p>
                        <p className="mt-1 font-semibold text-emerald-600">{formatCurrency(row.profit)}</p>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-100">
                        <p className="text-slate-500">Loss</p>
                        <p className="mt-1 font-semibold text-orange-600">{formatCurrency(row.loss)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Edit form ── */}
      {parentOrg ? (
        <form onSubmit={handleSubmit} className="mb-8 max-w-4xl rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.3)] sm:p-5">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Profile</p>
              <p className="mt-1 text-base font-semibold text-slate-900">Organization profile</p>
              <p className="text-sm text-slate-500">Status: {parentOrg.status}</p>
            </div>
            {saved ? <span className="text-sm font-medium text-emerald-600">Saved ✓</span> : null}
          </div>

          <div className="space-y-5">
            {/* Row 1: Name + Slug */}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">Organization name</span>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white" />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">Slug</span>
                <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white" />
              </label>
            </div>

            {/* Row 2: Email + Website */}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">Business email</span>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white" />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">Website</span>
                <input type="url" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="https://example.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white" />
              </label>
            </div>

            {/* Row 3: Phone */}
            <div className="space-y-1.5 text-sm">
              <span className="block font-medium text-slate-700">Phone</span>
              <PhoneDialCodeInput
                value={form.phone}
                onChange={(val) => setForm((f) => ({ ...f, phone: val }))}
              />
            </div>

            {/* Row 4: Industry + Address */}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">Industry</span>
                <input value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  placeholder="Technology"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white" />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">Address</span>
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white" />
              </label>
            </div>

            {/* Row 5: Country → State → City */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">Country</span>
                <SearchableSelect options={COUNTRY_OPTIONS} value={form.country} onChange={handleCountryChange} placeholder="Select country" />
              </div>
              <div className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">State / Region</span>
                <SearchableSelect
                  options={stateOptions}
                  value={form.state}
                  onChange={handleStateChange}
                  placeholder={form.country ? 'Select state' : 'Select country first'}
                  disabled={!form.country || stateOptions.length === 0}
                />
              </div>
              <div className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">City</span>
                <SearchableSelect
                  options={cityOptions}
                  value={form.city}
                  onChange={(val) => setForm((f) => ({ ...f, city: val }))}
                  placeholder={form.state ? 'Select city' : 'Select state first'}
                  disabled={!form.state || cityOptions.length === 0}
                />
              </div>
            </div>

            {/* Row 6: Timezone + Currency */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">Time Zone</span>
                <SearchableSelect options={timezoneOptions} value={form.timezone}
                  onChange={(val) => setForm((f) => ({ ...f, timezone: val }))} placeholder="Select timezone" />
              </div>
              <div className="space-y-1.5 text-sm">
                <span className="block font-medium text-slate-700">Currency</span>
                <SearchableSelect options={CURRENCY_OPTIONS} value={form.currency}
                  onChange={(val) => setForm((f) => ({ ...f, currency: val }))} placeholder="Select currency" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60">
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : null}

      {/* ── Child organizations ── */}
      <div className="max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Directory</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Sub-organizations</h2>
          </div>
          <button type="button" onClick={() => { setEditingChild(null); setCreateOpen(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-600">
            <Plus className="h-4 w-4" />Add sub-organization
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
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {childOrgs.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold overflow-hidden">
                            {item.logoUrl ? (
                              <img src={item.logoUrl} alt={item.name} className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  (e.currentTarget.parentElement as HTMLElement).textContent = getInitials(item.name);
                                }} />
                            ) : getInitials(item.name)}
                          </div>
                          <div>
                            <span>{item.name}</span>
                            <span className="ml-2 text-xs font-normal text-slate-500">{item.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.code}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />{item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{new Date(item.createdAt).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => { setEditingChild(item); setCreateOpen(true); }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                            <Pencil className="h-3.5 w-3.5" />Edit
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100">
                            <Trash2 className="h-3.5 w-3.5" />Delete
                          </button>
                        </div>
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
        onClose={() => { setCreateOpen(false); setEditingChild(null); }}
        onCreated={refreshOrgs}
        parentId={parentOrg?.id}
        organization={editingChild}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete child organization"
        description={`This will remove ${deleteTarget?.name ?? 'this organization'} from the platform. This action cannot be undone.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteChild()}
        confirmLabel={deletingChild ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        destructive
      />
    </div>
  );
}
