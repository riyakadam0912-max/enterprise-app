'use client';

import {
  Building2,
  Users,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Heading } from '@/components/typography/Heading';
import { Text } from '@/components/typography/Text';
import { Caption } from '@/components/typography/Caption';

const stats = [
  {
    label: 'Total Organizations',
    value: '128',
    icon: Building2,
    color: 'bg-blue-500',
  },
  {
    label: 'Active Organizations',
    value: '115',
    icon: CheckCircle2,
    color: 'bg-emerald-500',
  },
  {
    label: 'Inactive Organizations',
    value: '13',
    icon: XCircle,
    color: 'bg-rose-500',
  },
  {
    label: 'Total Users',
    value: '2,450',
    icon: Users,
    color: 'bg-indigo-500',
  },
  {
    label: "Today's Logins",
    value: '342',
    icon: Activity,
    color: 'bg-orange-500',
  },
  {
    label: 'Monthly Revenue',
    value: '$45,280',
    icon: TrendingUp,
    color: 'bg-purple-500',
  },
];

const recentActivities = [
  {
    id: 1,
    action: 'New organization created',
    organization: 'Acme Corp',
    time: '2 minutes ago',
    status: 'success',
  },
  {
    id: 2,
    action: 'User role updated',
    organization: 'TechStart Inc',
    time: '15 minutes ago',
    status: 'info',
  },
  {
    id: 3,
    action: 'Subscription renewed',
    organization: 'Global Solutions',
    time: '1 hour ago',
    status: 'success',
  },
  {
    id: 4,
    action: 'Organization suspended',
    organization: 'Old Ventures',
    time: '2 hours ago',
    status: 'warning',
  },
];

const recentOrganizations = [
  {
    id: 1,
    name: 'Acme Corp',
    plan: 'Enterprise',
    users: 234,
    status: 'Active',
    created: '2024-01-15',
  },
  {
    id: 2,
    name: 'TechStart Inc',
    plan: 'Professional',
    users: 89,
    status: 'Active',
    created: '2024-01-14',
  },
  {
    id: 3,
    name: 'Global Solutions',
    plan: 'Enterprise',
    users: 512,
    status: 'Active',
    created: '2024-01-12',
  },
  {
    id: 4,
    name: 'Old Ventures',
    plan: 'Basic',
    users: 12,
    status: 'Suspended',
    created: '2023-11-20',
  },
];

export default function SuperAdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <Caption className="text-slate-500">{stat.label}</Caption>
                  <p className="font-bold text-slate-900 text-2xl">
                    {stat.value}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="p-6">
          <Heading level={3} className="mb-4 text-lg">
            Recent Activity
          </Heading>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-4">
                <div
                  className={`mt-1 w-2 h-2 rounded-full ${
                    activity.status === 'success'
                      ? 'bg-emerald-500'
                      : activity.status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  }`}
                />
                <div className="flex-1">
                  <p className="font-medium text-slate-900 text-sm">
                    {activity.action}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Caption className="text-slate-500">{activity.organization}</Caption>
                    <span className="text-slate-300">•</span>
                    <div className="flex items-center gap-1 text-slate-500">
                      <Clock className="h-3 w-3" />
                      <Caption>{activity.time}</Caption>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Organizations */}
        <Card className="p-6">
          <Heading level={3} className="mb-4 text-lg">
            Recent Organizations
          </Heading>
          <div className="space-y-4">
            {recentOrganizations.map((org) => (
              <div key={org.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 text-sm">
                    {org.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Caption className="text-slate-500">{org.plan}</Caption>
                    <span className="text-slate-300">•</span>
                    <Caption className="text-slate-500">{org.users} users</Caption>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    org.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {org.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
