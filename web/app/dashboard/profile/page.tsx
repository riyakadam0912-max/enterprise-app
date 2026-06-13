'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/api/apiClient';

type LocalUser = {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  team?: string;
  jobTitle?: string;
  designation?: string;
  position?: string;
  isActive?: boolean;
  createdAt?: string;
  lastLogin?: string;
};

type ProfileResponse = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  phoneNumber: string | null;
  position: string | null;
  designation: string | null;
  department: string | null;
  hireDate: string | null;
  manager: string | null;
  address: string | null;
  emergencyContact: string | null;
  emergencyContactPhone: string | null;
  user?: {
    id?: number;
    name?: string;
    email?: string;
    role?: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
};

function readStoredUser(): LocalUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem('currentUser');
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as LocalUser;
    if (!parsed.name && !parsed.email) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function roleBadgeClasses(role: string) {
  return role === 'ADMIN'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-blue-100 text-blue-700';
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ProfilePage() {
  const storedUser = useMemo(() => readStoredUser(), []);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState({
    fullName: storedUser?.name ?? 'User',
    email: storedUser?.email ?? '',
    phone: '',
    department: storedUser?.department ?? '',
    role: storedUser?.role ?? 'EMPLOYEE',
    location: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const data = await apiClient<ProfileResponse>('/employee-self-service/profile/me');
        if (cancelled) {
          return;
        }

        setProfile(data);
        setDetails((prev) => ({
          ...prev,
          fullName: data.name || prev.fullName,
          email: data.email || prev.email,
          phone: data.phoneNumber ?? data.phone ?? prev.phone,
          department: data.department ?? prev.department,
          location: data.address ?? prev.location,
          role: data.user?.role ?? prev.role,
        }));
      } catch {
        if (!cancelled) {
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const displayRole = profile?.user?.role ?? details.role;
  const displayDepartment = profile?.department ?? details.department;
  const displayTitle = profile?.designation ?? profile?.position ?? storedUser?.designation ?? storedUser?.position ?? displayRole;
  const initials = (details.fullName?.trim().charAt(0) ?? 'U').toUpperCase();
  const accountActive = profile?.user?.isActive ?? storedUser?.isActive ?? true;
  const joinedAt = profile?.user?.createdAt ?? profile?.hireDate ?? storedUser?.createdAt ?? null;
  const lastLogin = storedUser?.lastLogin ?? null;

  async function handleDetailsSave() {
    setError(null);
    setMessage(null);
    setSavingDetails(true);

    try {
      const token = typeof window === 'undefined' ? null : localStorage.getItem('token');
      if (!token) {
        throw new Error('Please sign in again.');
      }

      if (profile?.id) {
        await apiClient('/employee-self-service/profile/update', {
          method: 'PUT',
          body: JSON.stringify({
            phoneNumber: details.phone || undefined,
            address: details.location || undefined,
          }),
        });
      }

      if (typeof window !== 'undefined') {
        const nextUser = {
          ...(storedUser ?? {}),
          name: details.fullName,
          email: details.email,
          role: details.role,
          department: details.department,
          position: profile?.position ?? storedUser?.position,
          designation: profile?.designation ?? storedUser?.designation,
        };
        localStorage.setItem('currentUser', JSON.stringify(nextUser));
      }

      setMessage('Profile details saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile details.');
    } finally {
      setSavingDetails(false);
    }
  }

  async function handlePasswordSave() {
    setError(null);
    setMessage(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('Please fill out all password fields.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      setMessage('Password update is not wired to a backend endpoint on this page yet.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your personal information and preferences</p>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500" />
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white shadow-sm">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{details.fullName}</h2>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeClasses(displayRole)}`}>
                    {displayRole}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500 truncate">{displayTitle}</p>
                <p className="mt-0.5 text-sm text-slate-500 truncate">{displayDepartment || 'Not assigned'}</p>
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">Personal Information</h3>
              <p className="mt-1 text-sm text-slate-500">Update the details that are visible on your profile.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="profile-full-name" className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                <input
                  id="profile-full-name"
                  name="fullName"
                  value={details.fullName}
                  readOnly
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none"
                />
              </div>

              <div>
                <label htmlFor="profile-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  id="profile-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={details.email}
                  readOnly
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none"
                />
              </div>

              <div>
                <label htmlFor="profile-phone" className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={details.phone}
                  onChange={(e) => setDetails((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter phone number"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label htmlFor="profile-department" className="mb-1 block text-sm font-medium text-slate-700">Department</label>
                <input
                  id="profile-department"
                  name="department"
                  value={displayDepartment || 'Not assigned'}
                  readOnly
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none"
                />
              </div>

              <div>
                <label htmlFor="profile-role" className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <input
                  id="profile-role"
                  name="role"
                  value={displayRole}
                  readOnly
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="profile-location" className="mb-1 block text-sm font-medium text-slate-700">Location</label>
                <input
                  id="profile-location"
                  name="location"
                  type="text"
                  autoComplete="street-address"
                  value={details.location}
                  onChange={(e) => setDetails((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Enter location"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end">
              <button
                type="button"
                onClick={handleDetailsSave}
                disabled={savingDetails}
                className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
              >
                {savingDetails ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">Account</h3>
              <p className="mt-1 text-sm text-slate-500">Quick account details and login state.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Account status</p>
                <div className="mt-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${accountActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {accountActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Date joined</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{formatDate(joinedAt)}</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Last login</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{formatDateTime(lastLogin)}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-slate-900">Change Password</h3>
            <p className="mt-1 text-sm text-slate-500">Update your login password from the profile screen.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="profile-current-password" className="mb-1 block text-sm font-medium text-slate-700">Current Password</label>
              <input
                id="profile-current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label htmlFor="profile-new-password" className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
              <input
                id="profile-new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label htmlFor="profile-confirm-password" className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
              <input
                id="profile-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Password changes are shown here for consistency with the profile UI.</p>
            <button
              type="button"
              onClick={handlePasswordSave}
              disabled={savingPassword}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {savingPassword ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </section>

        <p className="text-sm text-slate-500">To update your profile details, contact your administrator.</p>
      </div>
    </div>
  );
}