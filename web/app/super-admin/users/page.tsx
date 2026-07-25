'use client';

import { Search, Filter } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Heading } from '@/components/typography/Heading';
import { Caption } from '@/components/typography/Caption';
import { Input } from '@/components/ui/input';

export default function SuperAdminUsers() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>
            Users
          </Heading>
          <Caption className="text-slate-500 mt-1">
            Manage all users across organizations
          </Caption>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search users..." className="pl-10" />
          </div>
          <div className="sm:w-48">
            <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm">
              <option value="">All Roles</option>
            </select>
          </div>
          <div className="sm:w-48">
            <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm">
              <option value="">All Organizations</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-12 text-center">
        <Caption className="text-slate-500">Users table will be implemented here</Caption>
      </Card>
    </div>
  );
}
