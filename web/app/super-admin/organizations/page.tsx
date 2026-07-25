'use client';

import { Search, Plus, MoreVertical, Eye, Edit, Ban, Check, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/typography/Heading';
import { Text } from '@/components/typography/Text';
import { Caption } from '@/components/typography/Caption';
import { Input } from '@/components/ui/input';

const organizations = [
  {
    id: 1,
    name: 'Acme Corp',
    logo: 'AC',
    owner: 'John Doe',
    plan: 'Enterprise',
    users: 234,
    status: 'Active',
    created: '2024-01-15',
  },
  {
    id: 2,
    name: 'TechStart Inc',
    logo: 'TS',
    owner: 'Jane Smith',
    plan: 'Professional',
    users: 89,
    status: 'Active',
    created: '2024-01-14',
  },
  {
    id: 3,
    name: 'Global Solutions',
    logo: 'GS',
    owner: 'Mike Johnson',
    plan: 'Enterprise',
    users: 512,
    status: 'Active',
    created: '2024-01-12',
  },
  {
    id: 4,
    name: 'Old Ventures',
    logo: 'OV',
    owner: 'Bob Wilson',
    plan: 'Basic',
    users: 12,
    status: 'Suspended',
    created: '2023-11-20',
  },
];

export default function SuperAdminOrganizations() {
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
            />
          </div>
          <div className="sm:w-48">
            <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm">
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
                  Owner
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
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
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-semibold">
                        {org.logo}
                      </div>
                      <Text className="font-medium text-slate-900">
                        {org.name}
                      </Text>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Text className="text-slate-900">
                      {org.owner}
                    </Text>
                  </td>
                  <td className="px-6 py-4">
                    <Text className="text-slate-900">
                      {org.plan}
                    </Text>
                  </td>
                  <td className="px-6 py-4">
                    <Text className="text-slate-900">
                      {org.users}
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
                    <Caption className="text-slate-500">{org.created}</Caption>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-slate-600">
                        <Eye className="h-4 w-4" />
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
