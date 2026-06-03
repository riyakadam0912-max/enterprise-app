'use client';

import { useRef, useState } from 'react';
import { UploadCloud, FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type FileUploadFormState = {
  module: string;
  entityType: string;
  entityId: string;
  category: string;
  tags: string;
  isPublic: boolean;
};

export function FileUploadDropzone({
  onUpload,
  multiple = false,
}: {
  onUpload: (files: File[], formState: FileUploadFormState) => Promise<void>;
  multiple?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<FileUploadFormState>({
    module: 'Projects',
    entityType: 'Project',
    entityId: '',
    category: 'GENERAL_ATTACHMENT',
    tags: '',
    isPublic: false,
  });

  async function submitFiles() {
    if (selectedFiles.length === 0) return;
    setIsSubmitting(true);
    try {
      await onUpload(selectedFiles, formState);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-slate-200 bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-cyan-700" />
          Upload documents
        </CardTitle>
        <CardDescription>Drop one or more files and attach them to an ERP record.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label
          className={`flex min-h-45 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition ${
            dragActive ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 bg-slate-50/70 hover:border-cyan-300 hover:bg-cyan-50/40'
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const nextFiles = Array.from(event.dataTransfer.files ?? []);
            setSelectedFiles(multiple ? nextFiles : nextFiles.slice(0, 1));
          }}
        >
          <FilePlus2 className="mb-3 h-10 w-10 text-cyan-700" />
          <p className="text-base font-semibold text-slate-900">Drag files here</p>
          <p className="mt-1 text-sm text-slate-500">or click to browse from your device.</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            className="sr-only"
            onChange={(event) => {
              const nextFiles = Array.from(event.target.files ?? []);
              setSelectedFiles(multiple ? nextFiles : nextFiles.slice(0, 1));
            }}
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <InputField label="Module" value={formState.module} onChange={(value) => setFormState((current) => ({ ...current, module: value }))} />
          <InputField label="Entity type" value={formState.entityType} onChange={(value) => setFormState((current) => ({ ...current, entityType: value }))} />
          <InputField label="Entity id" type="number" value={formState.entityId} onChange={(value) => setFormState((current) => ({ ...current, entityId: value }))} />
          <InputField label="Category" value={formState.category} onChange={(value) => setFormState((current) => ({ ...current, category: value }))} />
          <InputField label="Tags" value={formState.tags} onChange={(value) => setFormState((current) => ({ ...current, tags: value }))} placeholder="comma,separated,tags" />
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={formState.isPublic}
              onChange={(event) => setFormState((current) => ({ ...current, isPublic: event.target.checked }))}
            />
            Public access
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div>
            <div className="font-semibold text-slate-900">{selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected</div>
            <div className="text-slate-500">{selectedFiles.length > 0 ? selectedFiles.map((file) => file.name).join(', ') : 'Choose files to continue'}</div>
          </div>
          <Button onClick={submitFiles} disabled={selectedFiles.length === 0 || isSubmitting} loading={isSubmitting}>
            {multiple ? 'Upload files' : 'Upload file'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
      />
    </label>
  );
}
