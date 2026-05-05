'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

interface ExportWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fileName: string;
  rows: object[];
  selectedIds?: Array<string | number>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toPlainValue(value: unknown) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv(rows: Record<string, unknown>[], fileName: string) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escapeCell = (value: unknown) => {
    const text = String(toPlainValue(value));
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ].join('\n');

  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${fileName}.csv`);
}

function exportXlsx(rows: Record<string, unknown>[], fileName: string) {
  const sheet = XLSX.utils.json_to_sheet(rows.map((row) => {
    const entry: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      entry[key] = toPlainValue(value);
    });
    return entry;
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Export');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileName}.xlsx`);
}

export default function ExportWorkflowModal({ isOpen, onClose, title, fileName, rows, selectedIds = [] }: ExportWorkflowModalProps) {
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [exporting, setExporting] = useState(false);

  const exportRows = useMemo(() => {
    const normalizedRows = rows.filter(isRecord);
    if (selectedIds.length === 0) return normalizedRows;
    const selected = new Set(selectedIds.map(String));
    return normalizedRows.filter((row) => row.id != null && selected.has(String(row.id)));
  }, [rows, selectedIds]);

  if (!isOpen) return null;

  function close() {
    setFormat('csv');
    onClose();
  }

  function handleExport() {
    if (exportRows.length === 0) return;
    setExporting(true);
    try {
      if (format === 'xlsx') {
        exportXlsx(exportRows, fileName);
      } else {
        exportCsv(exportRows, fileName);
      }
      close();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Export {title}</h2>
            <p className="mt-1 text-sm text-slate-500">Download spreadsheet data in CSV or XLSX format.</p>
          </div>
          <button onClick={close} className="text-2xl leading-none text-slate-400 hover:text-slate-600">&times;</button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-2">
            {(['csv', 'xlsx'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFormat(option)}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${format === option ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Export scope</p>
            <p className="mt-1">{selectedIds.length > 0 ? `${selectedIds.length} selected row${selectedIds.length === 1 ? '' : 's'}` : `${rows.length} rows available`}</p>
          </div>

          {exportRows.length === 0 && (
            <p className="text-sm text-red-600">No rows are available to export.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={close} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={handleExport} disabled={exporting || exportRows.length === 0} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
            {exporting ? 'Exporting…' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
