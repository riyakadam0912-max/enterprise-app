'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  CreditCard,
  FileText,
  Settings,
  BarChart3,
  LogOut,
  Menu,
  Bell,
  User,
} from 'lucide-react';

import { useAuth } from '@/providers/AuthProvider';
import { useAuthSession, clearAuthSession, isSuperAdminSession, clearActiveOrganization } from '@/stores/auth-store';
import { Heading } from '@/components/typography/Heading';
import { Caption } from '@/components/typography/Caption';

const superAdminNavItems = [
  { label: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
  { label: 'Organizations', href: '/super-admin/organizations', icon: Building2 },
  { label: 'Business Units', href: '/super-admin/business-units', icon: Building2 },
  { label: 'Users', href: '/super-admin/users', icon: Users },
  { label: 'Roles & Permissions', href: '/super-admin/roles', icon: Shield },
  { label: 'Subscription Plans', href: '/super-admin/plans', icon: CreditCard },
  { label: 'Billing', href: '/super-admin/billing', icon: FileText },
  { label: 'Audit Logs', href: '/super-admin/audit-logs', icon: FileText },
  { label: 'System Settings', href: '/super-admin/settings', icon: Settings },
  { label: 'Reports', href: '/super-admin/reports', icon: BarChart3 },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { authenticated, loading, logout } = useAuth();
  const session = useAuthSession();
  const [checked, setChecked] = useState(false);
  const [, startTransition] = useTransition();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    clearActiveOrganization();
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!authenticated) {
      router.replace('/login');
      return;
    }

    if (!isSuperAdminSession(session)) {
      router.replace('/dashboard');
      return;
    }

    startTransition(() => setChecked(true));
  }, [authenticated, loading, pathname, router, session, session.role, session.roles, session.isSuperAdmin, session.isPlatformAdmin, startTransition]);

  const handleLogout = async () => {
    await logout();
    clearAuthSession();
    router.push('/login');
  };

  if (loading || !checked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white shadow-2xl transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Brand */}
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <Heading level={2} className="font-bold text-white text-lg">
                  Super Admin
                </Heading>
                <Caption className="text-slate-400">
                  Global Console
                </Caption>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {superAdminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User & Logout */}
          <div className="p-4 border-t border-slate-800 space-y-2">
            <Link
              href="/super-admin/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <User className="h-5 w-5" />
              <span className="font-medium">Profile</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Heading level={3} className="font-semibold text-slate-900 text-lg">
              {superAdminNavItems.find((item) => pathname === item.href || pathname.startsWith(item.href + '/'))?.label || 'Dashboard'}
            </Heading>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <Bell className="h-6 w-6" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="font-medium text-slate-900 text-sm">
                  {session.user?.name || 'Super Admin'}
                </p>
                <Caption className="text-slate-500">Global Super Admin</Caption>
              </div>
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                {(session.user?.name?.charAt(0) || 'S').toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
