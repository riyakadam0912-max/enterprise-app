'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  User,
  Users,
} from 'lucide-react';

import { useAuth } from '@/providers/AuthProvider';
import { clearAuthSession, isSuperAdminSession, useAuthSession } from '@/stores/auth-store';
import { Heading } from '@/components/typography/Heading';
import ImpersonationBanner from '@/components/super-admin/ImpersonationBanner';
import { SuperAdminHeader } from '@/components/super-admin/SuperAdminHeader';

const superAdminNavItems = [
  { label: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
  { label: 'Organizations', href: '/super-admin/organizations', icon: Building2 },
  { label: 'Users', href: '/super-admin/users', icon: Users },
  { label: 'Roles & Permissions', href: '/super-admin/roles', icon: Shield },
  { label: 'Subscription Plans', href: '/super-admin/plans', icon: CreditCard },
  { label: 'Billing', href: '/super-admin/billing', icon: FileText },
  { label: 'Audit Logs', href: '/super-admin/audit-logs', icon: FileText },
  { label: 'System Settings', href: '/super-admin/settings', icon: Settings },
  { label: 'Reports', href: '/super-admin/reports', icon: BarChart3 },
];

export default function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authenticated, loading, logout } = useAuth();
  const session = useAuthSession();
  const [checked, setChecked] = useState(false);
  const [, startTransition] = useTransition();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('super-admin-sidebar-collapsed') === 'true';
  });

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setSidebarCollapsed((current) => !current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('super-admin-sidebar-collapsed', sidebarCollapsed ? 'true' : 'false');
    }
  }, [sidebarCollapsed]);

  const handleLogout = async () => {
    await logout();
    clearAuthSession();
    router.push('/login');
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed((current) => !current);
  };

  if (loading || !checked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_32%),linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)]">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 transform border-r border-slate-200/70 bg-slate-950 text-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.85)] transition-all duration-300 ease-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'w-24' : 'w-72'}`}
      >
        <div className="flex flex-col h-full">
          <div className="border-b border-slate-800/80 p-4">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 via-violet-500 to-sky-500 shadow-lg shadow-indigo-500/20">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                {!sidebarCollapsed ? (
                  <div>
                    <Heading level={2} className="text-lg font-semibold text-white">
                      Super Admin
                    </Heading>
                    <p className="text-sm text-slate-400">Global Console</p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleToggleSidebar}
                className="hidden rounded-xl border border-slate-800 bg-slate-900/70 p-2 text-slate-300 transition hover:bg-slate-800 lg:inline-flex"
                aria-label="Collapse sidebar"
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {superAdminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition-all ${
                    isActive ? 'bg-white/10 text-white shadow-lg shadow-indigo-950/20' : 'text-slate-300 hover:bg-slate-900/70 hover:text-white'
                  } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!sidebarCollapsed ? <span className="font-medium">{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2 border-t border-slate-800/80 p-3">
            <Link
              href="/super-admin/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-slate-300 transition hover:bg-slate-900/70 hover:text-white ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
            >
              <User className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed ? <span className="font-medium">Profile</span> : null}
            </Link>
            <button
              onClick={handleLogout}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-slate-300 transition hover:bg-slate-900/70 hover:text-white ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed ? <span className="font-medium">Logout</span> : null}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        <SuperAdminHeader onMenuToggle={() => setMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <ImpersonationBanner />
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
