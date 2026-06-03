'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as XLSX from 'xlsx';
import { ChevronLeft, ChevronRight, Columns3, Download, MoreHorizontal, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';
import { TableSkeleton } from '@/components/loaders/Loaders';
import { EmptyState } from '@/components/empty-states/EmptyState';

export type DataTableBulkAction<TData> = {
  label: string;
  onClick: (rows: TData[]) => void;
  variant?: 'default' | 'destructive' | 'secondary';
};

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  isLoading?: boolean;
  enableRowSelection?: boolean;
  bulkActions?: Array<DataTableBulkAction<TData>>;
  rowActions?: (row: TData) => React.ReactNode;
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  manualPagination?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  exportFileName?: string;
  className?: string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = 'Search records',
  searchValue,
  onSearchChange,
  isLoading = false,
  enableRowSelection = true,
  bulkActions = [],
  rowActions,
  pageCount,
  pagination,
  onPaginationChange,
  manualPagination = false,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your filters or create a new record.',
  exportFileName = 'export',
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [internalSearch, setInternalSearch] = React.useState('');

  const controlledPagination = pagination ?? internalPagination;
  const globalFilter = searchValue ?? internalSearch;
  const setGlobalFilter = onSearchChange ?? setInternalSearch;
  const handlePaginationChange: OnChangeFn<PaginationState> = (updaterOrValue) => {
    const nextPagination = typeof updaterOrValue === 'function' ? updaterOrValue(controlledPagination) : updaterOrValue;
    if (onPaginationChange) {
      onPaginationChange(nextPagination);
      return;
    }

    setInternalPagination(nextPagination);
  };

  const actionColumn = React.useMemo<ColumnDef<TData> | null>(() => {
    if (!rowActions) return null;
    return {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open row actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="z-50 min-w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
              {React.Children.map(rowActions(row.original), (child) => child)}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ),
    };
  }, [rowActions]);

  const tableColumns = React.useMemo(() => {
    const selectionColumn: ColumnDef<TData> | null = enableRowSelection
      ? {
          id: 'select',
          header: ({ table }) => (
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected()}
              onChange={(event) => table.toggleAllPageRowsSelected(event.target.checked)}
              aria-label="Select all rows"
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onChange={(event) => row.toggleSelected(event.target.checked)}
              aria-label="Select row"
            />
          ),
        }
      : null;

    return [selectionColumn, ...columns, actionColumn].filter(Boolean) as ColumnDef<TData, TValue>[];
  }, [actionColumn, columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination: controlledPagination,
    },
    pageCount,
    manualPagination,
    enableRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const visibleRows = table.getRowModel().rows;

  function exportToCsv() {
    const columnsForExport = table.getAllLeafColumns().filter((column) => column.id !== 'select' && column.id !== 'actions' && column.getIsVisible());
    const headers = columnsForExport.map((column) => String(column.columnDef.header ?? column.id));
    const rows = table.getRowModel().rows.map((row) =>
      columnsForExport.map((column) => {
        const value = row.getValue(column.id);
        return typeof value === 'object' ? JSON.stringify(value ?? '') : String(value ?? '');
      }),
    );

    const csv = [headers, ...rows]
      .map((record) => record.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${exportFileName}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportToExcel() {
    const columnsForExport = table.getAllLeafColumns().filter((column) => column.id !== 'select' && column.id !== 'actions' && column.getIsVisible());
    const rows = table.getRowModel().rows.map((row) => {
      const record: Record<string, string> = {};
      columnsForExport.forEach((column) => {
        const value = row.getValue(column.id);
        record[String(column.columnDef.header ?? column.id)] = typeof value === 'object' ? JSON.stringify(value ?? '') : String(value ?? '');
      });
      return record;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${exportFileName}.xlsx`);
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" className="gap-2">
                <Columns3 className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 min-w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                {table.getAllLeafColumns().filter((column) => column.id !== 'select' && column.id !== 'actions').map((column) => (
                  <DropdownMenu.CheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm outline-none hover:bg-slate-50"
                  >
                    {String(column.columnDef.header ?? column.id)}
                  </DropdownMenu.CheckboxItem>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <Button variant="outline" onClick={exportToCsv} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportToExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Excel
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {bulkActions.length > 0 && selectedRows.length > 0 ? (
            bulkActions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant ?? 'secondary'}
                onClick={() => action.onClick(selectedRows)}
              >
                {action.label}
              </Button>
            ))
          ) : null}
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {visibleRows.length} visible
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-200">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={table.getVisibleFlatColumns().length} className="px-4 py-5">
                    <TableSkeleton rows={5} columns={Math.max(table.getVisibleFlatColumns().length, 3)} />
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={table.getVisibleFlatColumns().length} className="px-4 py-8">
                    <EmptyState
                      title={emptyTitle}
                      description={emptyDescription}
                      icon={<Search className="h-5 w-5" />}
                    />
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 transition hover:bg-slate-50/70">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle text-slate-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          {selectedRows.length > 0 ? `${selectedRows.length} selected` : `${table.getRowModel().rows.length} rows`}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
