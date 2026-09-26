'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, ChevronDown, ChevronRight, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { listOrganizations, type Organization } from '@/api/organizationsApi';
import {
  createBusinessUnit,
  assignBusinessUnitAdministrator,
  deleteBusinessUnit,
  listBusinessUnitAdministrators,
  listBusinessUnitAdministratorCandidates,
  listBusinessUnits,
  revokeBusinessUnitAdministrator,
  type BusinessUnitAdministrator,
  type BusinessUnitAdministratorCandidate,
  updateBusinessUnit,
  type BusinessUnit,
  type BusinessUnitPayload,
  type BusinessUnitStatus,
} from '@/api/businessUnitsApi';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/providers/toast-provider';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';

const initialForm: BusinessUnitPayload = { name: '', code: '', description: '', type: '', status: 'ACTIVE', parentId: null };

function UnitTree({ units, parentId, onEdit, onDelete, onManage }: { units: BusinessUnit[]; parentId: number | null; onEdit: (unit: BusinessUnit) => void; onDelete: (unit: BusinessUnit) => void; onManage: (unit: BusinessUnit) => void }) {
  return (
    <div className={parentId == null ? 'space-y-2' : 'ml-6 space-y-2 border-l border-slate-200 pl-4'}>
      {units.filter((unit) => unit.parentId === parentId).map((unit) => (
        <div key={unit.id}>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            {units.some((child) => child.parentId === unit.id) ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
            <Building2 className="h-4 w-4 text-indigo-500" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{unit.name}</p>
              <p className="text-xs text-slate-500">{unit.code}{unit.type ? ` · ${unit.type}` : ''} · {unit._count?.employees ?? 0} employees</p>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${unit.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              <CheckCircle2 className="h-3.5 w-3.5" />{unit.status}
            </span>
            <Button type="button" variant="outline" size="sm" title="Manage BU administrators" aria-label={`Manage administrators for ${unit.name}`} onClick={() => onManage(unit)}><ShieldCheck className="h-4 w-4" /></Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(unit)}>Edit</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onDelete(unit)} className="text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
          </div>
          <UnitTree units={units} parentId={unit.id} onEdit={onEdit} onDelete={onDelete} onManage={onManage} />
        </div>
      ))}
    </div>
  );
}

export default function BusinessUnitsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessUnit | null>(null);
  const [form, setForm] = useState<BusinessUnitPayload>(initialForm);
  const [managedUnit, setManagedUnit] = useState<BusinessUnit | null>(null);
  const [administrators, setAdministrators] = useState<BusinessUnitAdministrator[]>([]);
  const [administratorCandidates, setAdministratorCandidates] = useState<BusinessUnitAdministratorCandidate[]>([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [loadingAdministrators, setLoadingAdministrators] = useState(false);
  const [administratorActionId, setAdministratorActionId] = useState<number | null>(null);

  useEffect(() => {
    void listOrganizations().then((items) => {
      setOrganizations(items);
      setOrganizationId(items.find((item) => item.status === 'ACTIVE')?.id ?? items[0]?.id ?? null);
    }).catch((error) => toast.error('Organizations unavailable', error instanceof Error ? error.message : 'Unable to load organizations')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (organizationId == null) return;
    setLoading(true);
    void listBusinessUnits(organizationId).then(setUnits).catch((error) => {
      setUnits([]);
      toast.error('Business Units unavailable', error instanceof Error ? error.message : 'Unable to load Business Units');
    }).finally(() => setLoading(false));
  }, [organizationId]);

  const parentOptions = useMemo(() => units.filter((unit) => unit.id !== editing?.id), [units, editing]);

  function openCreate() {
    setEditing(null);
    setForm(initialForm);
    setFormOpen(true);
  }

  function openEdit(unit: BusinessUnit) {
    setEditing(unit);
    setForm({ name: unit.name, code: unit.code, description: unit.description ?? '', type: unit.type ?? '', status: unit.status, parentId: unit.parentId });
    setFormOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (organizationId == null || !form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    try {
      if (editing) await updateBusinessUnit(editing.id, form);
      else await createBusinessUnit(organizationId, form);
      setUnits(await listBusinessUnits(organizationId));
      setFormOpen(false);
      toast.success(editing ? 'Business Unit updated' : 'Business Unit created', 'The hierarchy has been refreshed.');
    } catch (error) {
      toast.error('Business Unit save failed', error instanceof Error ? error.message : 'Unable to save Business Unit');
    } finally {
      setSaving(false);
    }
  }

  async function remove(unit: BusinessUnit) {
    try {
      await deleteBusinessUnit(unit.id);
      if (organizationId != null) setUnits(await listBusinessUnits(organizationId));
      toast.success('Business Unit deleted', `${unit.name} was removed.`);
    } catch (error) {
      toast.error('Business Unit delete failed', error instanceof Error ? error.message : 'Remove child units first.');
    }
  }

  async function openAdministratorManager(unit: BusinessUnit) {
    if (organizationId == null) return;
    setManagedUnit(unit);
    setCandidateSearch('');
    setSelectedCandidateId('');
    setLoadingAdministrators(true);
    try {
      const [assigned, candidates] = await Promise.all([
        listBusinessUnitAdministrators(organizationId, unit.id),
        listBusinessUnitAdministratorCandidates(organizationId, unit.id),
      ]);
      setAdministrators(assigned);
      setAdministratorCandidates(candidates);
    } catch (error) {
      toast.error('Administrators unavailable', error instanceof Error ? error.message : 'Unable to load BU administrators');
      setAdministrators([]);
      setAdministratorCandidates([]);
    } finally {
      setLoadingAdministrators(false);
    }
  }

  async function assignAdministrator() {
    if (organizationId == null || managedUnit == null || !selectedCandidateId) return;
    const userId = Number(selectedCandidateId);
    setAdministratorActionId(userId);
    try {
      await assignBusinessUnitAdministrator(organizationId, managedUnit.id, userId);
      await openAdministratorManager(managedUnit);
      toast.success('BU administrator assigned', 'The user is limited to this unit and its active descendants.');
    } catch (error) {
      toast.error('Assignment failed', error instanceof Error ? error.message : 'Unable to assign this user');
    } finally {
      setAdministratorActionId(null);
      setSelectedCandidateId('');
    }
  }

  async function revokeAdministrator(assignment: BusinessUnitAdministrator) {
    if (organizationId == null || managedUnit == null) return;
    setAdministratorActionId(assignment.userId);
    try {
      await revokeBusinessUnitAdministrator(organizationId, managedUnit.id, assignment.userId);
      await openAdministratorManager(managedUnit);
      toast.success('BU administrator revoked', `${assignment.user.name} no longer has this unit assignment.`);
    } catch (error) {
      toast.error('Revocation failed', error instanceof Error ? error.message : 'Unable to revoke this assignment');
    } finally {
      setAdministratorActionId(null);
    }
  }

  const filteredCandidates = administratorCandidates.filter((candidate) =>
    `${candidate.name} ${candidate.email} ${candidate.role}`.toLowerCase().includes(candidateSearch.trim().toLowerCase()),
  );

  return (
    <SuperAdminPageShell title="Business Units" description="Manage nested business units inside the selected organization." actions={<Button onClick={openCreate} disabled={organizationId == null}><Plus className="mr-2 h-4 w-4" />Create Business Unit</Button>}>
      <Card className="border-slate-200/80 bg-white/80 p-4">
        <label className="block text-sm font-medium text-slate-700">Organization</label>
        <Select className="mt-2 max-w-xl" value={organizationId == null ? '' : String(organizationId)} onChange={(event) => setOrganizationId(Number(event.target.value) || null)}>
          <option value="">Select organization</option>
          {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} ({organization.code})</option>)}
        </Select>
      </Card>

      <Card className="border-slate-200/80 bg-white/80 p-5">
        {loading ? <p className="py-10 text-center text-sm text-slate-500">Loading Business Units...</p> : units.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No Business Units in this organization yet.</p> : <UnitTree units={units} parentId={null} onEdit={openEdit} onDelete={(unit) => void remove(unit)} onManage={(unit) => void openAdministratorManager(unit)} />}
      </Card>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={submit} className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold text-slate-900">{editing ? 'Edit' : 'Create'} Business Unit</h2><p className="mt-1 text-sm text-slate-500">Organization ownership is enforced by the API.</p></div><button type="button" onClick={() => setFormOpen(false)} aria-label="Close"><X className="h-5 w-5 text-slate-500" /></button></div>
            <Input required placeholder="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <Input required placeholder="Code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
            <Input placeholder="Type, for example Region or Division" value={form.type ?? ''} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} />
            <Textarea placeholder="Description" value={form.description ?? ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            <Select value={form.parentId == null ? '' : String(form.parentId)} onChange={(event) => setForm((current) => ({ ...current, parentId: Number(event.target.value) || null }))}><option value="">Top-level unit</option>{parentOptions.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>)}</Select>
            <Select value={form.status ?? 'ACTIVE'} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as BusinessUnitStatus }))}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></Select>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" loading={saving}><Save className="mr-2 h-4 w-4" />Save</Button></div>
          </form>
        </div>
      ) : null}

      {managedUnit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setManagedUnit(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="bu-admin-dialog-title" className="w-full max-w-xl space-y-5 rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="bu-admin-dialog-title" className="text-xl font-semibold text-slate-900">Administrators · {managedUnit.name}</h2>
                <p className="mt-1 text-sm text-slate-500">Assignments are limited to this unit and its active descendants. Organization-wide roles are not eligible.</p>
              </div>
              <button type="button" onClick={() => setManagedUnit(null)} aria-label="Close administrator manager"><X className="h-5 w-5 text-slate-500" /></button>
            </div>

            {loadingAdministrators ? <p className="py-6 text-center text-sm text-slate-500">Loading administrators...</p> : (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-800">Assigned administrators</h3>
                  {administrators.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">No administrators assigned.</p> : administrators.map((assignment) => (
                    <div key={assignment.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{assignment.user.name}</p><p className="truncate text-xs text-slate-500">{assignment.user.email} · {assignment.user.role}</p></div>
                      <Button type="button" size="sm" variant="outline" disabled={administratorActionId === assignment.userId} loading={administratorActionId === assignment.userId} onClick={() => void revokeAdministrator(assignment)}>Revoke</Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-800">Assign a user</h3>
                  <Input aria-label="Search eligible users" placeholder="Search name, email, or role" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} />
                  <div className="flex gap-2">
                    <Select className="min-w-0 flex-1" aria-label="Eligible user" value={selectedCandidateId} onChange={(event) => setSelectedCandidateId(event.target.value)}>
                      <option value="">Select an eligible user</option>
                      {filteredCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email} · {candidate.role}</option>)}
                    </Select>
                    <Button type="button" disabled={!selectedCandidateId || administratorActionId !== null} loading={administratorActionId !== null} onClick={() => void assignAdministrator()}><Plus className="mr-2 h-4 w-4" />Assign</Button>
                  </div>
                  {administratorCandidates.length === 0 ? <p className="text-xs text-slate-500">No eligible active users are available.</p> : null}
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </SuperAdminPageShell>
  );
}
