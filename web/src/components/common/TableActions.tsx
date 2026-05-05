'use client';

import { useMemo, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import ImportWorkflowModal from './ImportWorkflowModal';
import ExportWorkflowModal from './ExportWorkflowModal';
import { getModuleActionConfig } from './moduleActionConfig';

interface TableActionsProps {
  moduleKey: string;
  rows?: object[];
  selectedIds?: Array<string | number>;
  onRefresh?: () => void | Promise<void>;
  currentView?: string;
  onViewChange?: (value: string) => void;
}

const VIEW_OPTIONS = ['List', 'Calendar', 'Timeline', 'Spreadsheet', 'Kanban'];

export default function TableActions({ moduleKey, rows = [], selectedIds = [], onRefresh, currentView = 'List', onViewChange }: TableActionsProps) {
  const config = useMemo(() => getModuleActionConfig(moduleKey), [moduleKey]);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const canImport = config.supportsImport && Boolean(config.importEndpoint);
  const canExport = rows.length > 0;

  return (
    <>
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Table actions"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          >
            <span className="text-lg leading-none">···</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-52 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-xl">
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="flex cursor-default items-center justify-between rounded-lg px-3 py-2 text-slate-700 outline-none hover:bg-slate-50">
              <span>Show As</span>
              <span className="text-slate-400">›</span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="z-50 min-w-44 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-xl">
                {VIEW_OPTIONS.map((option) => (
                  <DropdownMenu.Item
                    key={option}
                    className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 outline-none hover:bg-slate-50 ${currentView === option ? 'text-orange-600 font-medium' : 'text-slate-700'}`}
                    onSelect={() => onViewChange?.(option)}
                  >
                    <span>{option}</span>
                    {currentView === option ? <span>✓</span> : null}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          <DropdownMenu.Item className="cursor-pointer rounded-lg px-3 py-2 text-slate-700 outline-none hover:bg-slate-50" onSelect={() => window.print()}>
            Print
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={`cursor-pointer rounded-lg px-3 py-2 outline-none hover:bg-slate-50 ${canImport ? 'text-slate-700' : 'cursor-not-allowed text-slate-300'}`}
            onSelect={(event) => {
              if (!canImport) {
                event.preventDefault();
                return;
              }
              setImportOpen(true);
            }}
          >
            Import
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={`cursor-pointer rounded-lg px-3 py-2 outline-none hover:bg-slate-50 ${canExport ? 'text-slate-700' : 'cursor-not-allowed text-slate-300'}`}
            onSelect={(event) => {
              if (!canExport) {
                event.preventDefault();
                return;
              }
              setExportOpen(true);
            }}
          >
            Export
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <ImportWorkflowModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={onRefresh}
        endpoint={config.importEndpoint}
        title={config.label}
        fields={config.importFields}
      />

      <ExportWorkflowModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        title={config.label}
        fileName={config.exportFileName}
        rows={rows}
        selectedIds={selectedIds}
      />
    </>
  );
}
