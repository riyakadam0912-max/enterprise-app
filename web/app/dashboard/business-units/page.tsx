'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Search, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import {
  assignBusinessUnitAdministrator,
  listBusinessUnitAdministratorCandidates,
  listBusinessUnitAdministrators,
  listBusinessUnits,
  revokeBusinessUnitAdministrator,
  type BusinessUnit,
  type BusinessUnitAdministrator,
  type BusinessUnitAdministratorCandidate,
} from '@/api/businessUnitsApi';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/providers/toast-provider';
import { getActiveOrganizationId, useAuthSession } from '@/stores/auth-store';

const operationalLinks = [
  { label: 'Employees', href: '/dashboard/employees' },
  { label: 'Attendance', href: '/dashboard/attendance' },
  { label: 'Leave requests', href: '/dashboard/requests' },
  { label: 'Expenses', href: '/dashboard/expenses' },
  { label: 'Projects', href: '/dashboard/projects' },
  { label: 'Tasks', href: '/dashboard/tasks' },
];

export default function BusinessUnitAdminPage() {
  const session = useAuthSession();
  const organizationId = getActiveOrganizationId() ?? session.organizationId;
  const canManageAssignments =
    session.role === 'ADMIN' || session.isBusinessUnitAdmin;
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [administrators, setAdministrators] = useState<BusinessUnitAdministrator[]>([]);
  const [candidates, setCandidates] = useState<BusinessUnitAdministratorCandidate[]>([]);
  const [search, setSearch] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [workingUserId, setWorkingUserId] = useState<number | null>(null);

  const visibleUnits = canManageAssignments ? units : session.availableBusinessUnits;
  const selectedUnit = visibleUnits.find((unit) => unit.id === selectedUnitId) ?? visibleUnits[0] ?? null;
  const selectedUnitIdForRequest = selectedUnit?.id ?? null;

  useEffect(() => {
    if (!canManageAssignments || organizationId == null) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    void listBusinessUnits(organizationId)
      .then((result) => {
        if (!mounted) return;
        setUnits(result);
        setSelectedUnitId((current) => result.some((unit) => unit.id === current) ? current : result[0]?.id ?? null);
      })
      .catch((error) => toast.error('Business Units unavailable', error instanceof Error ? error.message : 'Unable to load business units'))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [canManageAssignments, organizationId]);

  useEffect(() => {
    if (!canManageAssignments || organizationId == null || selectedUnitIdForRequest == null) {
      setAdministrators([]);
      setCandidates([]);
      return;
    }
    let mounted = true;
    setLoadingAssignments(true);
    void Promise.all([
      listBusinessUnitAdministrators(organizationId, selectedUnitIdForRequest),
      listBusinessUnitAdministratorCandidates(organizationId, selectedUnitIdForRequest),
    ])
      .then(([assigned, eligible]) => {
        if (!mounted) return;
        setAdministrators(assigned);
        setCandidates(eligible);
      })
      .catch((error) => toast.error('Administrator list unavailable', error instanceof Error ? error.message : 'Unable to load assignments'))
      .finally(() => { if (mounted) setLoadingAssignments(false); });
    return () => { mounted = false; };
  }, [canManageAssignments, organizationId, selectedUnitIdForRequest]);

  const filteredCandidates = candidates.filter((candidate) =>
    `${candidate.name} ${candidate.email} ${candidate.role}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function assignSelectedUser() {
    if (!canManageAssignments || organizationId == null || selectedUnit == null || !candidateId) return;
    const userId = Number(candidateId);
    setWorkingUserId(userId);
    try {
      await assignBusinessUnitAdministrator(organizationId, selectedUnit.id, userId);
      const [assigned, eligible] = await Promise.all([
        listBusinessUnitAdministrators(organizationId, selectedUnit.id),
        listBusinessUnitAdministratorCandidates(organizationId, selectedUnit.id),
      ]);
      setAdministrators(assigned);
      setCandidates(eligible);
      setCandidateId('');
      toast.success('Business Unit administrator assigned', `${selectedUnit.name} access is limited to its active scope.`);
    } catch (error) {
      toast.error('Assignment failed', error instanceof Error ? error.message : 'Unable to assign this user');
    } finally {
      setWorkingUserId(null);
    }
  }

  async function revokeAssignment(assignment: BusinessUnitAdministrator) {
    if (!canManageAssignments || organizationId == null || selectedUnit == null) return;
    setWorkingUserId(assignment.userId);
    try {
      await revokeBusinessUnitAdministrator(organizationId, selectedUnit.id, assignment.userId);
      setAdministrators((current) => current.filter((item) => item.id !== assignment.id));
      setCandidates((current) => [...current, {
        id: assignment.user.id,
        name: assignment.user.name,
        email: assignment.user.email,
        role: assignment.user.role,
      }].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Assignment revoked', `${assignment.user.name} no longer administers ${selectedUnit.name}.`);
    } catch (error) {
      toast.error('Revocation failed', error instanceof Error ? error.message : 'Unable to revoke this assignment');
    } finally {
      setWorkingUserId(null);
    }
  }

  if (organizationId == null) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Select an organization before opening Business Unit administration.</p>;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-orange-700">Organization administration</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Business Unit Admin</h1>
          <p className="mt-1 text-sm text-slate-600">{session.role === 'ADMIN' ? 'Manage business units and their administrator assignments in your organization.' : session.isBusinessUnitAdmin ? 'Manage business units and administrators across your organization.' : 'Review your assigned units and open the operational areas available to your role.'}</p>
        </div>
        {session.organizationName ? <span className="text-sm font-medium text-slate-600">{session.organizationName}</span> : null}
      </header>

      {!canManageAssignments ? (
        <>
          {!session.isBusinessUnitAdmin ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This account has no active Business Unit administrator assignment.</p> : null}
          {visibleUnits.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">No accessible Business Units are assigned to this account.</p> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleUnits.map((unit) => (
                <Card key={unit.id} className="border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 h-5 w-5 text-orange-700" />
                    <div className="min-w-0"><h2 className="truncate font-semibold text-slate-900">{unit.name}</h2><p className="text-sm text-slate-500">{unit.code}</p></div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{unit.status} · scope includes active descendants</p>
                </Card>
              ))}
            </div>
          )}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Your role-based work areas</h2>
            <nav className="flex flex-wrap gap-2" aria-label="Business Unit work areas">
              {operationalLinks.filter((link) => session.role === 'MANAGER' || ['Attendance', 'Leave requests', 'Projects', 'Tasks'].includes(link.label)).map((link) => (
                <Link key={link.href} href={link.href} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{link.label}</Link>
              ))}
            </nav>
          </section>
        </>
      ) : (
        <>
          <Card className="flex flex-col gap-3 border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-orange-700" /><div><p className="text-sm font-semibold text-slate-900">Business Unit</p><p className="text-xs text-slate-500">Select any active unit in your organization</p></div></div>
            <Select className="sm:max-w-md" aria-label="Select Business Unit" value={selectedUnit?.id ?? ''} onChange={(event) => setSelectedUnitId(Number(event.target.value) || null)} disabled={loading || units.length === 0}>
              {units.length === 0 ? <option value="">No Business Units</option> : units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.code}) · {unit.status}</option>)}
            </Select>
          </Card>

          {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading Business Units...</p> : !selectedUnit ? <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">No active Business Units are available.</p> : (
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /><h2 className="font-semibold text-slate-900">Assigned administrators</h2></div>
                {loadingAssignments ? <p className="py-6 text-sm text-slate-500">Loading assignments...</p> : administrators.length === 0 ? <p className="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">No administrators assigned to this unit.</p> : (
                  <ul className="mt-4 divide-y divide-slate-100">
                    {administrators.map((assignment) => <li key={assignment.id} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{assignment.user.name}</p><p className="truncate text-xs text-slate-500">{assignment.user.email} · {assignment.user.role}</p></div><Button type="button" size="sm" variant="outline" title="Revoke administrator" aria-label={`Revoke ${assignment.user.name}`} disabled={workingUserId === assignment.userId} loading={workingUserId === assignment.userId} onClick={() => void revokeAssignment(assignment)}><UserMinus className="h-4 w-4" /></Button></li>)}
                  </ul>
                )}
              </Card>

              <Card className="space-y-4 border-slate-200 bg-white p-5">
                <div><h2 className="font-semibold text-slate-900">Assign an administrator</h2><p className="mt-1 text-xs text-slate-500">Only active users without organization-wide roles are eligible.</p></div>
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" aria-label="Search eligible users" placeholder="Search name, email, or role" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
                <Select aria-label="Choose eligible user" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
                  <option value="">Select a user</option>
                  {filteredCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email} · {candidate.role}</option>)}
                </Select>
                <Button type="button" disabled={!candidateId || workingUserId !== null || selectedUnit.status !== 'ACTIVE'} loading={workingUserId !== null} onClick={() => void assignSelectedUser()}><UserPlus className="mr-2 h-4 w-4" />Assign administrator</Button>
                {candidates.length === 0 ? <p className="text-xs text-slate-500">No eligible active users are available for this unit.</p> : null}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
