'use client';

import { useEffect, useState } from 'react';
import { Database, History, Mail, Save, Server, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/providers/toast-provider';
import {
  getPlatformCapabilities,
  getPlatformSettings,
  getPlatformSettingsHistory,
  updatePlatformSettings,
  type PlatformCapabilities,
  type PlatformSettings,
  type PlatformSettingsHistoryItem,
} from '@/api/platformSettingsApi';

type EditableSettings = Omit<PlatformSettings, 'updatedAt'>;

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description: string }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-slate-100 py-4 last:border-0"><span><span className="block text-sm font-medium text-slate-900">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900" /></label>;
}

function Capability({ label, value, healthy = true }: { label: string; value: string; healthy?: boolean }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0"><span className="text-sm text-slate-600">{label}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${healthy ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{value}</span></div>;
}

export default function SuperAdminSettings() {
  const [settings, setSettings] = useState<EditableSettings | null>(null);
  const [original, setOriginal] = useState<EditableSettings | null>(null);
  const [capabilities, setCapabilities] = useState<PlatformCapabilities | null>(null);
  const [history, setHistory] = useState<PlatformSettingsHistoryItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getPlatformSettings(), getPlatformCapabilities(), getPlatformSettingsHistory()])
      .then(([configuration, capabilityData, historyData]) => {
        if (!active) return;
        const editable = { general: configuration.general, security: configuration.security, notifications: configuration.notifications, features: configuration.features };
        setSettings(editable); setOriginal(editable); setUpdatedAt(configuration.updatedAt); setCapabilities(capabilityData); setHistory(historyData);
      })
      .catch((error) => toast.error('Settings unavailable', error instanceof Error ? error.message : 'Unable to load platform settings'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await updatePlatformSettings(settings);
      const editable = { general: saved.general, security: saved.security, notifications: saved.notifications, features: saved.features };
      setSettings(editable); setOriginal(editable); setUpdatedAt(saved.updatedAt);
      setHistory(await getPlatformSettingsHistory());
      toast.success('Settings saved', 'Platform configuration is now active.');
    } catch (error) { toast.error('Save failed', error instanceof Error ? error.message : 'Unable to save settings'); }
    finally { setSaving(false); }
  };

  const setGroup = <K extends keyof EditableSettings>(group: K, values: Partial<EditableSettings[K]>) => setSettings((current) => current ? ({ ...current, [group]: { ...current[group], ...values } }) : current);

  if (loading || !settings) return <SuperAdminPageShell title="System settings" description="Loading platform configuration…"><Card className="p-10 text-center text-sm text-slate-500">Loading settings…</Card></SuperAdminPageShell>;

  return (
    <SuperAdminPageShell title="System settings" description="Manage safe runtime policies and inspect deployment capabilities. Credentials remain in the deployment secret manager." actions={<><Button variant="outline" onClick={() => original && setSettings(original)} disabled={saving}>Reset changes</Button><Button onClick={save} loading={saving}><Save className="h-4 w-4" />Save settings</Button></>}>
      {updatedAt ? <p className="text-xs text-slate-500">Last updated {new Date(updatedAt).toLocaleString('en-GB')}</p> : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl p-5 shadow-none">
          <div className="mb-5 flex items-center gap-3"><SlidersHorizontal className="h-5 w-5 text-indigo-600" /><div><h2 className="font-semibold text-slate-950">General</h2><p className="text-sm text-slate-500">Branding and platform defaults</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-700">Platform name<Input className="mt-1" value={settings.general.platformName} onChange={(e) => setGroup('general', { platformName: e.target.value })} /></label>
            <label className="text-sm text-slate-700">Support email<Input className="mt-1" type="email" value={settings.general.supportEmail} onChange={(e) => setGroup('general', { supportEmail: e.target.value })} /></label>
            <label className="text-sm text-slate-700">Default timezone<Input className="mt-1" value={settings.general.defaultTimezone} onChange={(e) => setGroup('general', { defaultTimezone: e.target.value })} /></label>
            <label className="text-sm text-slate-700">Currency<Select className="mt-1" value={settings.general.defaultCurrency} onChange={(e) => setGroup('general', { defaultCurrency: e.target.value })}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option><option>AED</option><option>SGD</option></Select></label>
            <label className="text-sm text-slate-700">Locale<Select className="mt-1" value={settings.general.defaultLocale} onChange={(e) => setGroup('general', { defaultLocale: e.target.value })}><option value="en-IN">English (India)</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option></Select></label>
          </div>
        </Card>

        <Card className="rounded-2xl p-5 shadow-none">
          <div className="mb-5 flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-indigo-600" /><div><h2 className="font-semibold text-slate-950">Security policy</h2><p className="text-sm text-slate-500">Authentication defaults for future enforcement</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-700">Minimum password length<Input className="mt-1" type="number" min={8} max={128} value={settings.security.minimumPasswordLength} onChange={(e) => setGroup('security', { minimumPasswordLength: Number(e.target.value) })} /></label>
            <label className="text-sm text-slate-700">Session timeout (minutes)<Input className="mt-1" type="number" min={5} max={10080} value={settings.security.sessionTimeoutMinutes} onChange={(e) => setGroup('security', { sessionTimeoutMinutes: Number(e.target.value) })} /></label>
          </div>
          <Toggle checked={settings.security.requireTwoFactor} onChange={(value) => setGroup('security', { requireTwoFactor: value })} label="Require two-factor authentication" description="Policy flag for authentication clients that support 2FA." />
        </Card>

        <Card className="rounded-2xl p-5 shadow-none">
          <div className="flex items-center gap-3"><Mail className="h-5 w-5 text-indigo-600" /><div><h2 className="font-semibold text-slate-950">Notifications</h2><p className="text-sm text-slate-500">Platform channel defaults</p></div></div>
          <Toggle checked={settings.notifications.emailEnabled} onChange={(value) => setGroup('notifications', { emailEnabled: value })} label="Email notifications" description="Allow platform workflows to request email delivery." />
          <Toggle checked={settings.notifications.smsEnabled} onChange={(value) => setGroup('notifications', { smsEnabled: value })} label="SMS notifications" description="Enable only after an SMS provider and consent workflow are configured." />
          <Toggle checked={settings.notifications.criticalAlertsEnabled} onChange={(value) => setGroup('notifications', { criticalAlertsEnabled: value })} label="Critical alerts" description="Keep high-priority operational alerts enabled." />
        </Card>

        <Card className="rounded-2xl p-5 shadow-none">
          <div className="flex items-center gap-3"><Server className="h-5 w-5 text-indigo-600" /><div><h2 className="font-semibold text-slate-950">Features</h2><p className="text-sm text-slate-500">Platform availability controls</p></div></div>
          <Toggle checked={settings.features.maintenanceMode} onChange={(value) => setGroup('features', { maintenanceMode: value })} label="Maintenance mode" description="Publishes the maintenance policy flag for clients and middleware." />
          <Toggle checked={settings.features.allowOrganizationSignup} onChange={(value) => setGroup('features', { allowOrganizationSignup: value })} label="Organization signup" description="Allow public organization onboarding when a signup flow is installed." />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl p-5 shadow-none"><div className="mb-3 flex items-center gap-3"><Database className="h-5 w-5 text-indigo-600" /><div><h2 className="font-semibold text-slate-950">Infrastructure</h2><p className="text-sm text-slate-500">Read-only deployment status; secrets are never returned.</p></div></div>{capabilities ? <><Capability label="Deployment" value={`${capabilities.deployment.mode} / ${capabilities.deployment.environment}`} /><Capability label="Email" value={capabilities.email.configured ? capabilities.email.provider : 'Not configured'} healthy={capabilities.email.configured} /><Capability label="Storage" value={capabilities.storage.provider} healthy={capabilities.storage.configured} /><Capability label="Redis" value={capabilities.redis.configured ? 'Configured' : 'Not configured'} healthy={capabilities.redis.configured} /><Capability label="Queues" value={capabilities.queues.enabled ? 'Enabled' : 'Disabled'} healthy={capabilities.queues.enabled} /><Capability label="WebSockets" value={capabilities.websockets.enabled ? 'Enabled' : capabilities.websockets.reason ?? 'Disabled'} healthy={capabilities.websockets.enabled} /></> : <p className="py-6 text-sm text-slate-500">Capability status unavailable.</p>}</Card>
        <Card className="rounded-2xl p-5 shadow-none"><div className="mb-3 flex items-center gap-3"><History className="h-5 w-5 text-indigo-600" /><div><h2 className="font-semibold text-slate-950">Change history</h2><p className="text-sm text-slate-500">Latest audited configuration updates.</p></div></div><div className="divide-y divide-slate-100">{history.length === 0 ? <p className="py-6 text-sm text-slate-500">No settings changes recorded yet.</p> : history.map((item) => <div key={item.id} className="py-3"><div className="flex justify-between gap-4"><p className="text-sm font-medium text-slate-800">{item.userName ?? 'System administrator'}</p><span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('en-GB')}</span></div><p className="mt-1 text-xs text-slate-500">{item.description ?? 'Platform configuration updated'}</p></div>)}</div></Card>
      </div>
    </SuperAdminPageShell>
  );
}
