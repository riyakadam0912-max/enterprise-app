'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { importData } from '@/api/apiClient';

interface ImportResult {
  imported: number;
  errors: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  endpoint: string;
  title?: string;
}

// ── simple CSV → array of objects ──────────────────────────────────────────
function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = splitCsvLine(line);
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const v = vals[i] ?? '';
      obj[h.trim()] = v.trim();
    });
    return obj;
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseJson(text: string): Record<string, unknown>[] | string {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    return 'JSON must be an array of objects';
  } catch {
    return 'Invalid JSON';
  }
}

export default function ImportModal({ isOpen, onClose, onSuccess, endpoint, title = 'Data' }: Props) {
  const [source, setSource] = useState<'local' | 'url' | 'cloud' | 'paste'>('local');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [parseError, setParseError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteFormat, setPasteFormat] = useState<'csv' | 'json'>('csv');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // ── helpers ──────────────────────────────────────────────────────────────
  function reset() {
    setFileName(''); setRecords([]); setParseError('');
    setUrlInput(''); setUrlLoading(false);
    setPasteText(''); setResult(null); setImporting(false);
    setSource('local');
  }

  function handleClose() { reset(); onClose(); }

  function processText(text: string, ext: string) {
    setParseError('');
    let rows: Record<string, unknown>[] | string;
    if (ext === 'json') rows = parseJson(text);
    else rows = parseCsv(text);
    if (typeof rows === 'string') { setParseError(rows); setRecords([]); }
    else if (rows.length === 0) { setParseError('No data rows found.'); setRecords([]); }
    else setRecords(rows);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'csv';
    const reader = new FileReader();
    reader.onload = (e) => processText(e.target?.result as string, ext === 'json' ? 'json' : 'csv');
    reader.readAsText(file);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleParsePaste() {
    processText(pasteText, pasteFormat);
  }

  async function handleLoadFromUrl() {
    if (!urlInput.trim()) {
      setParseError('Please enter a valid URL.');
      return;
    }

    setUrlLoading(true);
    setParseError('');
    setResult(null);

    try {
      const res = await fetch(urlInput.trim());
      if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);
      const text = await res.text();
      const lower = urlInput.toLowerCase();
      const jsonLike = text.trim().startsWith('{') || text.trim().startsWith('[');
      const ext = lower.endsWith('.json') || jsonLike ? 'json' : 'csv';
      processText(text, ext);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Unable to load data from URL');
      setRecords([]);
    } finally {
      setUrlLoading(false);
    }
  }

  async function handleImport() {
    if (records.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await importData(endpoint, records);
      setResult(res);
      if (res.imported > 0) onSuccess?.();
    } catch (err) {
      setResult({ imported: 0, errors: [err instanceof Error ? err.message : 'Import failed'] });
    } finally {
      setImporting(false);
    }
  }

  const previewRows = records.slice(0, 5);
  const headers = records.length > 0 ? Object.keys(records[0]) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Import {title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Choose a data source, then preview and import records</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Choose Data Source</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { key: 'local', label: 'Local storage' },
                { key: 'url', label: 'URL' },
                { key: 'cloud', label: 'Cloud service' },
                { key: 'paste', label: 'Paste Data' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setSource(opt.key as 'local' | 'url' | 'cloud' | 'paste');
                    setRecords([]);
                    setParseError('');
                    setResult(null);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    source === opt.key
                      ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {source === 'local' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-12 cursor-pointer transition-colors
                ${dragging ? 'border-orange-400 bg-orange-50' : 'border-slate-300 hover:border-orange-400 hover:bg-slate-50'}`}>
              <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
              </svg>
              {fileName
                ? <p className="text-sm font-medium text-orange-600">{fileName}</p>
                : <><p className="text-sm font-semibold text-slate-600">Drag & drop a file here</p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse</p></>}
              <p className="text-xs text-slate-400 mt-3">Supported: .csv, .json</p>
              <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={onFileChange} />
            </div>
          )}

          {source === 'url' && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700">Load CSV/JSON from URL</p>
              <div className="flex gap-2">
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/data.csv"
                  className="flex-1 px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <button
                  onClick={handleLoadFromUrl}
                  disabled={urlLoading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {urlLoading ? 'Loading…' : 'Load'}
                </button>
              </div>
              <p className="text-xs text-slate-400">If CORS blocks the URL, download the file and use Local storage instead.</p>
            </div>
          )}

          {source === 'cloud' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">Cloud service import</p>
              <p className="text-xs text-slate-500 mt-1">Cloud connectors are kept as an option in the workflow. Use Local storage, URL, or Paste Data for now.</p>
            </div>
          )}

          {source === 'paste' && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-700">Format:</span>
                {(['csv', 'json'] as const).map((f) => (
                  <label key={f} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-600">
                    <input type="radio" value={f} checked={pasteFormat === f} onChange={() => setPasteFormat(f)} className="accent-orange-500" />
                    {f.toUpperCase()}
                  </label>
                ))}
              </div>
              <textarea
                value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                rows={7} placeholder={pasteFormat === 'csv'
                  ? 'name,email,phone\nJohn Doe,john@example.com,+1234567890'
                  : '[{"name":"John Doe","email":"john@example.com"}]'}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none" />
              <button onClick={handleParsePaste}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">
                Parse Data
              </button>
            </div>
          )}

          {parseError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{parseError}</div>
          )}

          {records.length > 0 && !result && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                Preview — {records.length} row{records.length !== 1 ? 's' : ''} detected
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {headers.map((h) => (
                          <td key={h} className="px-3 py-2 text-slate-700 max-w-37.5 truncate">{String(row[h] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {records.length > 5 && (
                <p className="text-xs text-slate-400 mt-1">Showing first 5 of {records.length} rows</p>
              )}
            </div>
          )}

          {result && (
            <div className={`rounded-xl p-4 border ${result.imported > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`font-semibold text-sm ${result.imported > 0 ? 'text-green-700' : 'text-red-700'}`}>
                {result.imported > 0
                  ? `✓ Successfully imported ${result.imported} record${result.imported !== 1 ? 's' : ''}`
                  : '✗ Import failed'}
              </p>
              {result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-red-600 mb-1">Errors ({result.errors.length}):</p>
                  <ul className="text-xs text-red-600 space-y-0.5 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-400">
            {records.length > 0 ? `${records.length} row${records.length !== 1 ? 's' : ''} ready` : 'No data loaded'}
          </p>
          <div className="flex items-center gap-3">
            <button onClick={handleClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors">
              {result?.imported ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button onClick={handleImport} disabled={records.length === 0 || importing}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                {importing && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {importing ? 'Importing…' : `Import ${records.length > 0 ? records.length + ' Record' + (records.length !== 1 ? 's' : '') : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
