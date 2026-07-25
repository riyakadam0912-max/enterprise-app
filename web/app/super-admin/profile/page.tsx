'use client';

import { User, Camera } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/typography/Heading';
import { Caption } from '@/components/typography/Caption';
import { Text } from '@/components/typography/Text';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/typography/Label';
import { useAuthSession } from '@/stores/auth-store';

export default function SuperAdminProfile() {
  const session = useAuthSession();
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Heading level={1}>
          Profile
        </Heading>
        <Caption className="text-slate-500 mt-1">
          Manage your super admin profile
        </Caption>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-6 mb-8">
          <div className="relative">
            <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {(session.user?.name?.charAt(0) || 'S').toUpperCase()}
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
              <Camera className="h-4 w-4 text-slate-600" />
            </button>
          </div>
          <div>
            <Text className="font-bold text-slate-900">
              {session.user?.name || 'Super Admin'}
            </Text>
            <Caption className="text-slate-500">
              {session.user?.email || 'admin@example.com'}
            </Caption>
            <span className="inline-flex mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
              Global Super Admin
            </span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" defaultValue={session.user?.name || ''} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue={session.user?.email || ''} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" />
          </div>

          <div className="border-t border-slate-200 pt-6">
            <Heading level={3} className="mb-4">
              Change Password
            </Heading>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" type="password" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button>Save Changes</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
