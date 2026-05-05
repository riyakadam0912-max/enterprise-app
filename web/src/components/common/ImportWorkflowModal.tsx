'use client';

import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { importData } from '@/api/apiClient';
import { type ImportFieldConfig } from './moduleActionConfig';

type Step = 'upload' | 'mapping' | 'preview' | 'done';

interface ImportWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
  endpoint?: string;
  title: string;
  fields?: ImportFieldConfig[];
}

interface ValidationIssue {
  rowIndex: number;
  field: string;
  message: string;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function detectColumns(records: Record<string, unknown>[]) {
  const seen = new Set<string>();
  for (const row of records) {
    for (const key of Object.keys(row)) {
      seen.add(key);
    }
  }
  return Array.from(seen);
}

async function parseUpload(file: File): Promise<Record<string, unknown>[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'json') {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('JSON files must contain an array of objects.');
    }

    return parsed.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row));
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

function asString(value: unknown) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function coerceValue(value: unknown, type: ImportFieldConfig['type']) {
  const text = asString(value);
  if (text === '') return '';
  if (type === 'number') return Number(text);
  if (type === 'boolean') return ['true', '1', 'yes', 'y'].includes(text.toLowerCase());
  if (type === 'date') return new Date(text).toISOString();
  return text;
}

export default function ImportWorkflowModal({ isOpen, onClose, onSuccess, endpoint, title, fields = [] }: ImportWorkflowModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const columns = useMemo(() => detectColumns(records), [records]);
  const activeFields: ImportFieldConfig[] = fields.length > 0 ? fields : columns.map((key) => ({ key, label: key }));
  const previewRows = useMemo(() => records.slice(0, 10), [records]);

  function reset() {
    setStep('upload');
    setFileName('');
    setRecords([]);
    setColumnMap({});
    setIssues([]);
    setImporting(false);
    setMessage(null);
    setError(null);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  }

  function closeModal() {
    reset();
    onClose();
  }

  function buildMappedRecords() {
    return records.map((row) => {
      const mapped: Record<string, unknown> = {};
      for (const field of activeFields) {
        const sourceKey = columnMap[field.key];
        mapped[field.key] = sourceKey ? coerceValue(row[sourceKey], field.type) : '';
      }
      return mapped;
    });
  }

  function validateRows() {
    const nextIssues: ValidationIssue[] = [];
    const mapped = buildMappedRecords();

    mapped.forEach((row, rowIndex) => {
      activeFields.forEach((field) => {
        const value = row[field.key];
        const text = asString(value);

        if (field.required && text === '') {
          nextIssues.push({ rowIndex, field: field.key, message: `${field.label} is required` });
          return;
        }

        if (text === '') return;

        if (field.type === 'number' && Number.isNaN(Number(value))) {
          nextIssues.push({ rowIndex, field: field.key, message: `${field.label} must be a number` });
        }

        if (field.type === 'email' && !isValidEmail(text)) {
          nextIssues.push({ rowIndex, field: field.key, message: `${field.label} must be a valid email` });
        }

        if (field.type === 'date' && Number.isNaN(Date.parse(text))) {
          nextIssues.push({ rowIndex, field: field.key, message: `${field.label} must be a valid date` });
        }
      });
    });

    setIssues(nextIssues);
    return { mapped, nextIssues };
  }

  async function handleFile(file: File) {
    setMessage(null);
    setError(null);
    try {
      const parsed = await parseUpload(file);
      if (parsed.length === 0) {
        setError('No rows found in the uploaded file.');
        return;
      }

      setFileName(file.name);
      setRecords(parsed);
      const autoMap: Record<string, string> = {};
      const availableColumns = detectColumns(parsed);

      activeFields.forEach((field) => {
        const match = availableColumns.find((column) => normalize(column) === normalize(field.label) || normalize(column) === normalize(field.key));
        if (match) autoMap[field.key] = match;
      });

      setColumnMap(autoMap);
      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read file.');
    }
  }

  async function handleConfirmImport() {
    if (!endpoint) {
      setError('Import is not configured for this module.');
      return;
    }

    const { mapped, nextIssues } = validateRows();
    if (nextIssues.length > 0) {
      setStep('preview');
      setError('Fix the validation issues before importing.');
      return;
    }

    setImporting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await importData(endpoint, mapped);
      setMessage(`Imported ${result.imported} record${result.imported === 1 ? '' : 's'}.`);
      setStep('done');
      await onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  if (!isOpen) return null;

  const mappedRows = buildMappedRecords();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Import {title}</h2>
            <p className="mt-1 text-sm text-slate-500">Upload a file, map columns, review validation, then confirm the import.</p>
          </div>
          <button onClick={closeModal} className="text-2xl leading-none text-slate-400 hover:text-slate-600">&times;</button>
        </div>

        <div className="border-b border-slate-100 px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          <span className={step === 'upload' ? 'text-orange-600' : ''}>1. Upload File</span>
          <span className="mx-2 text-slate-300">/</span>
          <span className={step === 'mapping' ? 'text-orange-600' : ''}>2. Column Mapping</span>
          <span className="mx-2 text-slate-300">/</span>
          <span className={step === 'preview' ? 'text-orange-600' : ''}>3. Preview + Validation</span>
          <span className="mx-2 text-slate-300">/</span>
          <span className={step === 'done' ? 'text-orange-600' : ''}>4. Confirm Import</span>
        </div>

        <div className="grid flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            {step === 'upload' && (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-orange-400">
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.json" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFile(file);
                  }
                }} />
                <p className="text-sm font-semibold text-slate-700">Drop a spreadsheet or CSV file here</p>
                <p className="mt-1 text-xs text-slate-500">Supported formats: CSV, XLSX, XLS, JSON</p>
                <button onClick={() => fileRef.current?.click()} className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">Choose File</button>
              </div>
            )}

            {step === 'mapping' && (
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Column Mapping</p>
                    <p className="text-xs text-slate-500">Map each import field to a spreadsheet column.</p>
                  </div>
                  <button onClick={() => setStep('preview')} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">Review Preview</button>
                </div>
                <div className="space-y-3">
                  {activeFields.map((field) => (
                    <label key={field.key} className="grid gap-2 text-sm font-medium text-slate-700">
                      {field.label}
                      <select
                        value={columnMap[field.key] ?? ''}
                        onChange={(event) => setColumnMap((prev) => ({ ...prev, [field.key]: event.target.value }))}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select a column</option>
                        {columns.map((column) => (
                          <option key={column} value={column}>{column}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Preview + Validation</p>
                    <p className="text-xs text-slate-500">{mappedRows.length} rows ready for import.</p>
                  </div>
                  <button onClick={handleConfirmImport} disabled={importing || !endpoint} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{importing ? 'Importing…' : 'Confirm Import'}</button>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        {activeFields.map((field) => (
                          <th key={field.key} className="px-3 py-2 text-left font-semibold">{field.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => {
                        const mappedRow = mappedRows[rowIndex] ?? {};
                        const rowIssues = issues.filter((issue) => issue.rowIndex === rowIndex);
                        return (
                          <tr key={rowIndex} className={rowIssues.length > 0 ? 'bg-red-50' : 'border-t border-slate-100'}>
                            {activeFields.map((field) => (
                              <td key={field.key} className="px-3 py-2 text-slate-700">{String(mappedRow[field.key] ?? '')}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {issues.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {issues.slice(0, 8).map((issue, index) => (
                      <p key={`${issue.rowIndex}-${issue.field}-${index}`}>Row {issue.rowIndex + 1}: {issue.message}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 'done' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                {message ?? 'Import completed successfully.'}
              </div>
            )}

            {(error || message) && step !== 'done' && (
              <div className={`rounded-xl px-4 py-3 text-sm ${error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {error ?? message}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">File</p>
              <p className="mt-2 text-sm text-slate-600">{fileName || 'No file selected yet'}</p>
              <p className="mt-1 text-xs text-slate-400">{records.length} parsed rows</p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Field Summary</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {activeFields.map((field) => (
                  <div key={field.key} className="flex items-center justify-between gap-3">
                    <span>{field.label}</span>
                    <span className="truncate text-xs text-slate-400">{columnMap[field.key] ?? 'Unmapped'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button onClick={closeModal} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
          <div className="flex items-center gap-2">
            {step === 'mapping' && <button onClick={() => setStep('upload')} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>}
            {step === 'preview' && <button onClick={() => setStep('mapping')} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>}
            {step !== 'done' && (
              <button onClick={() => {
                if (step === 'upload') {
                  fileRef.current?.click();
                  return;
                }
                if (step === 'mapping') {
                  setStep('preview');
                  validateRows();
                  return;
                }
                void handleConfirmImport();
              }} disabled={importing} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                {step === 'upload' ? 'Choose File' : step === 'mapping' ? 'Preview Rows' : 'Confirm Import'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
