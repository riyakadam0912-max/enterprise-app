'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Mail, RefreshCw, Smartphone } from 'lucide-react';
import {
  listEmailTemplates,
  previewEmailTemplate,
  type EmailPreviewResponse,
  type EmailTemplateOption,
} from '@/api/emailPreviewApi';
import { useAuthSession } from '@/stores/auth-store';

const SAMPLE_VALUES: Record<string, string> = {
  firstName: 'Asha',
  organization: 'Enterprise ERP',
  ctaUrl: 'https://example.com/dashboard',
  ctaText: 'Open dashboard',
  role: 'Manager',
  message: 'Please review this update in your workspace.',
};

export default function EmailPreviewPage() {
  const session = useAuthSession();
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([]);
  const [template, setTemplate] = useState('welcome');
  const [values, setValues] = useState<Record<string, string>>(SAMPLE_VALUES);
  const [preview, setPreview] = useState<EmailPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN' || session.isPlatformAdmin;
  const selectedTemplate = useMemo(
    () => templates.find((item) => item.name === template),
    [template, templates],
  );

  useEffect(() => {
    let mounted = true;
    listEmailTemplates()
      .then((items) => {
        if (!mounted) return;
        setTemplates(items);
        setTemplate((current) => items.some((item) => item.name === current) ? current : items[0]?.name ?? 'welcome');
      })
      .catch((reason: unknown) => {
        if (mounted) setError(reason instanceof Error ? reason.message : 'Unable to load templates.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function selectTemplate(nextTemplate: string) {
    setTemplate(nextTemplate);
    setPreview(null);
    setError('');
  }

  function updateValue(field: string, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handlePreview() {
    setPreviewing(true);
    setError('');
    try {
      setPreview(await previewEmailTemplate(template, values));
    } catch (reason: unknown) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : 'Unable to render this template.');
    } finally {
      setPreviewing(false);
    }
  }

  if (!isAdmin) {
    return <div className="p-8 text-slate-700">You do not have permission to preview email templates.</div>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Communications</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Email template preview</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Render the exact Handlebars email before it reaches a recipient.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            <Mail className="h-4 w-4 text-amber-600" /> Preview only
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <label className="text-sm font-semibold text-slate-900" htmlFor="email-template">Template</label>
            <select id="email-template" value={template} onChange={(event) => selectTemplate(event.target.value)} disabled={loading} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
              {templates.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>

            <div className="mt-6 space-y-4">
              {selectedTemplate?.requiredFields.map((field) => (
                <label key={field} className="block text-sm font-medium text-slate-700">
                  {field}
                  <input value={values[field] ?? ''} onChange={(event) => updateValue(field, event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
                </label>
              ))}
            </div>

            <button type="button" onClick={() => void handlePreview()} disabled={previewing || loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              {previewing ? 'Rendering...' : 'Render preview'}
            </button>
            {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          </section>

          <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold text-slate-950">Rendered message</h2><p className="text-sm text-slate-500">Review the layout and populated values.</p></div>
              <div className="flex items-center gap-2 text-xs text-slate-500"><Smartphone className="h-4 w-4" /> Responsive email canvas</div>
            </div>
            {preview ? <iframe title="Rendered email preview" sandbox="" srcDoc={preview.html} className="h-[680px] w-full rounded-xl border border-slate-200 bg-slate-50" /> : <div className="flex h-[680px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500"><div><RefreshCw className="mx-auto mb-3 h-5 w-5" /><p>Choose values, then render the preview.</p></div></div>}
          </section>
        </div>
      </div>
    </main>
  );
}