'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/typography/Heading';
import { Caption } from '@/components/typography/Caption';
import { Text } from '@/components/typography/Text';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/typography/Label';
import { useAuthSession } from '@/stores/auth-store';
import { ProfileAvatarUploader } from '@/components/profile/ProfileAvatarUploader';
import { apiClient } from '@/api/apiClient';
import { useEffect, useState } from 'react';

export default function SuperAdminProfile() {
  const session = useAuthSession();
  const [name, setName] = useState(session.user?.name ?? '');
  const [designation, setDesignation] = useState(session.user?.designation ?? '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiClient<{ name: string; phone: string | null; address: string | null; designation: string | null }>('/auth/profile/me')
      .then((profile) => {
        setName(profile.name);
        setPhone(profile.phone ?? '');
        setAddress(profile.address ?? '');
        setDesignation(profile.designation ?? '');
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await apiClient('/auth/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), designation: designation.trim() || undefined, phone: phone.trim() || undefined, address: address.trim() || undefined }),
      });
      setMessage('Profile updated successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  }

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
        {message && <Caption className="mb-4 text-emerald-600">{message}</Caption>}
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
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue={session.user?.email || ''} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 (555) 000-0000" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            <Input id="designation" value={designation} onChange={(event) => setDesignation(event.target.value)} placeholder="Enter your designation" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Location</Label>
            <Input id="address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Enter your location" />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
