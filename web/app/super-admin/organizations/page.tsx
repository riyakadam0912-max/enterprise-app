'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Eye, Edit, Ban, Check, Trash2, Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/typography/Heading';
import { Text } from '@/components/typography/Text';
import { Caption } from '@/components/typography/Caption';
import { Input } from '@/components/ui/input';
import { setActiveOrganization } from '@/stores/auth-store';
import { listOrganizations, type Organization } from '@/api/organizationsApi';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SuperAdminOrganizations() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadOrganizations = async () => {
      try {
        const data = await listOrganizations();
        if (!active) return;
        setOrganizations(data);
      } catch {
        if (!active) return;
        setOrganizations([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadOrganizations();

    return () => {
      active = false;
    };
  }, []);

  const filteredOrganizations = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    return organizations.filter((org) => {
      const matchesSearch =
        !normalizedQuery ||
        [org.name, org.code, org.slug, org.status]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus = !statusFilter || org.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [organizations, search, statusFilter]);

  const handleOpenOrganization = (organizationId: number) => {
    setActiveOrganization(organizationId);
    router.replace('/dashboard');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1} className="text-xl">
            Organizations
          </Heading>
          <Caption className="text-slate-500 mt-1">
            Manage all organizations in the system
          </Caption>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search organizations..."
              className="pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="sm:w-48">
            <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Number
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Subscription
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Admin
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                    Loading organizations...
                  </td>
                </tr>
              ) : filteredOrganizations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                    No organizations found.
                  </td>
                </tr>
              ) : filteredOrganizations.map((org) => (
                <tr key={org.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-semibold">
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <Text className="font-medium text-slate-900">
                          {org.name}
                        </Text>
                        <Caption className="text-slate-500">{org.code}</Caption>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Text className="text-slate-900">
                      {org.number ?? `ORG-${String(org.id).padStart(6, '0')}`}
                    </Text>
                  </td>
                  <td className="px-6 py-4">
                    <Text className="text-slate-900">
                      {org.code}
                    </Text>
                  </td>
                  <td className="px-6 py-4">
                    <Text className="text-slate-900">
                      {org.slug}
                    </Text>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        org.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : org.status === 'Suspended'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      {org.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Text className="text-slate-900">
                      {org.subscriptionPlan ?? '—'}
                    </Text>
                  </td>
                  <td className="px-6 py-4">
                    <Text className="text-slate-900">
                      {org.adminUser ?? '—'}
                    </Text>
                  </td>
                  <td className="px-6 py-4">
                    <Caption className="text-slate-500">{formatDate(org.createdAt)}</Caption>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-slate-600">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenOrganization(org.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                      >
                        <Building2 className="h-4 w-4" />
                        Open
                      </button>
                      <button className="p-2 text-slate-400 hover:text-slate-600">
                        <Edit className="h-4 w-4" />
                      </button>
                      {org.status === 'Active' ? (
                        <button className="p-2 text-slate-400 hover:text-amber-600">
                          <Ban className="h-4 w-4" />
                        </button>
                      ) : (
                        <button className="p-2 text-slate-400 hover:text-emerald-600">
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button className="p-2 text-slate-400 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
