'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronRight, LogOut, Loader2 } from 'lucide-react';

import { listOrganizations, type Organization } from '@/api/organizationsApi';
import { useAuth } from '@/providers/AuthProvider';
import {
  getActiveOrganizationId,
  setActiveOrganization,
  useAuthSession,
} from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function SelectOrganizationPage() {
  const router = useRouter();
  const auth = useAuth();
  const session = useAuthSession();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadOrganizations() {
      try {
        setLoading(true);
        setError('');
        const orgs = await listOrganizations();
        if (mounted) {
          setOrganizations(orgs);
          if (orgs.length === 1) {
            setSelectedId(orgs[0].id);
          } else {
            const activeOrgId = getActiveOrganizationId();
            if (activeOrgId != null && orgs.some((o) => o.id === activeOrgId)) {
              setSelectedId(activeOrgId);
            }
          }
        }
      } catch (e: unknown) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Failed to load organizations');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadOrganizations();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleContinue() {
    if (selectedId == null) return;
    try {
      setSubmitting(true);
      setActiveOrganization(selectedId);
      if (session.isSuperAdmin || session.role === 'SUPER_ADMIN') {
        router.replace('/dashboard');
      } else {
        router.replace('/dashboard');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to select organization');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await auth.logout();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500 rounded-2xl mb-4 shadow-sm">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Select Organization</h1>
          <p className="mt-2 text-sm text-slate-500">
            Choose the organization you want to work with
          </p>
          {session?.user?.name && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
              <span>Signed in as</span>
              <span className="font-medium text-slate-700">{session.user.name}</span>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600 transition"
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <Card className="p-10 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <p className="mt-3 text-sm text-slate-500">Loading organizations...</p>
          </Card>
        ) : organizations.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-slate-700 font-medium">No organizations available</p>
            <p className="mt-1 text-sm text-slate-500">
              Please contact an administrator to get access to an organization.
            </p>
            <div className="mt-6">
              <Button onClick={handleLogout} variant="destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden mb-6">
              <div className="divide-y divide-slate-100">
                {organizations.map((org) => {
                  const isActive = org.status === 'ACTIVE';
                  const isSelected = selectedId === org.id;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      disabled={!isActive || submitting}
                      onClick={() => setSelectedId(org.id)}
                      className={[
                        'w-full flex items-center gap-4 px-5 py-4 text-left transition',
                        isActive ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-60 cursor-not-allowed',
                        isSelected ? 'bg-orange-50/60' : '',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'w-11 h-11 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0',
                          isSelected ? 'bg-orange-500' : 'bg-slate-500',
                        ].join(' ')}
                      >
                        {org.name.trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900 truncate">
                            {org.name}
                          </p>
                          <span
                            className={[
                              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
                              isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600',
                            ].join(' ')}
                          >
                            {org.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {org.code} • {org.slug}
                        </p>
                      </div>
                      <ChevronRight
                        className={[
                          'w-5 h-5 shrink-0 transition',
                          isSelected ? 'text-orange-500' : 'text-slate-300',
                        ].join(' ')}
                      />
                    </button>
                  );
                })}
              </div>
            </Card>

            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleLogout}
                disabled={submitting}
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
              <Button
                type="button"
                onClick={handleContinue}
                disabled={selectedId == null || submitting}
                className="min-w-[160px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Continuing...
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
