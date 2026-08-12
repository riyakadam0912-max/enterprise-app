'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/typography/Heading';
import { Caption } from '@/components/typography/Caption';
import { Text } from '@/components/typography/Text';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/typography/Label';
import { useAuthSession } from '@/stores/auth-store';
import { ProfileAvatarUploader } from '@/components/profile/ProfileAvatarUploader';

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
          <ProfileAvatarUploader
            userName={session.user?.name}
            userEmail={session.user?.email}
            userId={session.user?.id ?? null}
            size="lg"
          />
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
                <PasswordInput id="current-password" autoComplete="current-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <PasswordInput id="new-password" autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <PasswordInput id="confirm-password" autoComplete="new-password" />
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
