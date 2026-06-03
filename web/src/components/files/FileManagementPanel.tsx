'use client';

import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Trash2, Download, Eye, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/Dialog';
import { deleteFile, getFileDashboard, listFiles, uploadMultipleFiles, type FileDashboard, type ManagedFile } from '@/api/filesApi';
import { FileUploadDropzone } from './FileUploadDropzone';
import { FilePreviewPanel } from './FilePreviewPanel';

export function FileManagementPanel() {
  const [dashboard, setDashboard] = useState<FileDashboard | null>(null);
  const [files, setFiles] = useState<ManagedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ManagedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ManagedFile | null>(null);

  async function loadData(searchValue = search) {
    setLoading(true);
    try {
      const [dashboardResponse, filesResponse] = await Promise.all([
        getFileDashboard(),
        listFiles({ search: searchValue, limit: 24 }),
      ]);
      setDashboard(dashboardResponse);
      setFiles(filesResponse.items);
      setSelectedFile((current) => current ?? filesResponse.items[0] ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div
        className="rounded-4xl border border-cyan-200 p-6 text-white shadow-[0_30px_90px_-45px_rgba(8,15,30,0.85)]"
        style={{
          backgroundImage:
            'radial-gradient(circle at top left, rgba(34, 211, 238, 0.14), transparent 35%), linear-gradient(135deg, #082f49, #0f172a 68%)',
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <BarChart3 className="h-3.5 w-3.5" />
              Enterprise file hub
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Secure document storage, preview, and attachments</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 md:text-base">
              Organize uploaded files by ERP module, preview documents inline, and keep the storage backend swappable so local disk can later move to cloud storage without changing business code.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:max-w-3xl">
            <Stat label="Files" value={dashboard ? String(dashboard.totalFiles) : '—'} />
            <Stat label="Storage" value={dashboard ? formatBytes(dashboard.totalStorageBytes) : '—'} />
            <Stat label="Recent" value={dashboard ? String(dashboard.recentFiles.length) : '—'} />
            <Stat label="Top" value={dashboard ? String(dashboard.mostDownloaded.length) : '—'} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <FileUploadDropzone
            multiple
            onUpload={async (filesToUpload, formState) => {
              if (!formState.entityId) return;
              const formData = new FormData();
              filesToUpload.forEach((file) => formData.append('files', file));
              formData.append('module', formState.module);
              formData.append('entityType', formState.entityType);
              formData.append('entityId', formState.entityId);
              formData.append('category', formState.category);
              formData.append('tags', formState.tags);
              formData.append('isPublic', String(formState.isPublic));
              await uploadMultipleFiles(formData);
              await loadData(search);
            }}
          />

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Document library</CardTitle>
                  <CardDescription>Search, preview, and manage files from any ERP module.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search files"
                    className="h-11 w-64 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      void loadData(search);
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? <p className="text-sm text-slate-500">Loading files...</p> : null}
              {!loading && files.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No files found for this filter.
                </div>
              ) : null}
              <div className="grid gap-3">
                {files.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelectedFile(file)}
                    className={`group flex items-center justify-between gap-4 rounded-3xl border p-4 text-left transition ${
                      selectedFile?.id === file.id ? 'border-cyan-400 bg-cyan-50 shadow-sm' : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-950">{file.originalName}</div>
                        <div className="truncate text-sm text-slate-500">
                          {file.module} · {file.entityType} #{file.entityId} · {file.category}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setSelectedFile(file); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <a
                        href={file.downloadUrl}
                        download
                        aria-label={`Download ${file.originalName}`}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setDeleteTarget(file); }}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <FilePreviewPanel file={selectedFile} />

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Category breakdown</CardTitle>
              <CardDescription>Files uploaded by category across the active workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard?.byCategory.map((item) => (
                <div key={item.category} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">{item.category}</span>
                  <span className="text-sm font-semibold text-slate-950">{item.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete file"
        description={deleteTarget ? `This will remove ${deleteTarget.originalName} from the file library.` : undefined}
        destructive
        confirmLabel="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteFile(deleteTarget.id);
          setDeleteTarget(null);
          await loadData(search);
        }}
      >
        <p className="text-sm text-slate-600">Deleted files are soft-removed in the database and can still be audited from the platform logs.</p>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
