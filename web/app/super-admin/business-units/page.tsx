'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, ChevronDown, ChevronRight, Plus, Save, Trash2, X } from 'lucide-react';
import { listOrganizations, type Organization } from '@/api/organizationsApi';
import {
  createBusinessUnit,
  deleteBusinessUnit,
  listBusinessUnits,
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

function UnitTree({ units, parentId, onEdit, onDelete }: { units: BusinessUnit[]; parentId: number | null; onEdit: (unit: BusinessUnit) => void; onDelete: (unit: BusinessUnit) => void }) {
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
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(unit)}>Edit</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onDelete(unit)} className="text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
          </div>
          <UnitTree units={units} parentId={unit.id} onEdit={onEdit} onDelete={onDelete} />
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
        {loading ? <p className="py-10 text-center text-sm text-slate-500">Loading Business Units...</p> : units.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No Business Units in this organization yet.</p> : <UnitTree units={units} parentId={null} onEdit={openEdit} onDelete={(unit) => void remove(unit)} />}
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
    </SuperAdminPageShell>
  );
}
