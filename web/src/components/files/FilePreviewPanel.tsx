'use client';

import { ExternalLink, FileText, Image as ImageIcon, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { ManagedFile } from '@/api/filesApi';

function previewKind(file: ManagedFile) {
  if (file.mimeType.startsWith('image/')) return 'image';
  if (file.mimeType === 'application/pdf') return 'pdf';
  if (file.mimeType.startsWith('text/')) return 'text';
  return 'other';
}

export function FilePreviewPanel({ file, className }: { file: ManagedFile | null; className?: string }) {
  if (!file) {
    return (
      <Card className={cn('border-dashed bg-slate-50/80', className)}>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Select a file to inspect its content and metadata.</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-90 items-center justify-center text-center text-sm text-slate-500">
          Nothing selected yet.
        </CardContent>
      </Card>
    );
  }

  const kind = previewKind(file);
  const previewUrl = file.previewUrl ?? file.downloadUrl ?? '';

  return (
    <Card className={cn('overflow-hidden bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.25)]', className)}>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {kind === 'image' ? <ImageIcon className="h-5 w-5 text-slate-700" /> : <FileText className="h-5 w-5 text-slate-700" />}
              {file.originalName}
            </CardTitle>
            <CardDescription>
              {file.module} · {file.entityType} #{file.entityId} · v{file.version} · {Math.round(file.size / 1024)} KB
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <a href={file.previewUrl ?? file.downloadUrl ?? '#'} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">
              <ExternalLink className="h-4 w-4" />
              Open
            </a>
            <a href={file.downloadUrl ?? file.previewUrl ?? '#'} download className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
              <Download className="h-4 w-4" />
              Download
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/95">
          {kind === 'image' ? (
            <img src={previewUrl} alt={file.originalName} className="max-h-115 w-full object-contain bg-slate-950" />
          ) : kind === 'pdf' ? (
            <iframe title={file.originalName} src={previewUrl} className="h-115 w-full bg-white" />
          ) : kind === 'text' ? (
            <iframe title={file.originalName} src={previewUrl} className="h-115 w-full bg-white" />
          ) : (
            <div className="flex h-115 flex-col items-center justify-center gap-3 bg-linear-to-br from-slate-950 to-slate-900 p-8 text-center text-slate-100">
              <FileText className="h-14 w-14 text-cyan-300" />
              <p className="max-w-md text-sm text-slate-300">
                This file type does not have an inline preview. Use the download action or store a PDF/image rendition alongside it.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Meta label="Category" value={file.category} />
          <Meta label="Provider" value={file.storageProvider} />
          <Meta label="Tags" value={file.tags.length > 0 ? file.tags.join(', ') : '—'} />
          <Meta label="Access" value={file.isPublic ? 'Public' : 'Restricted'} />
        </div>
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 wrap-break-word font-medium text-slate-900">{value}</div>
    </div>
  );
}
