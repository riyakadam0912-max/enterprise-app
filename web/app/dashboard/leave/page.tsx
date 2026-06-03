'use client';

import { useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CheckCircle2, Plus, XCircle } from 'lucide-react';
import { ModuleTemplate } from '@/components/ModuleTemplate';
import { DataTable } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/Dialog';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { FormDatePicker } from '@/components/forms/FormDatePicker';
import { FormSelect } from '@/components/forms/FormSelect';
import { FormTextarea } from '@/components/forms/FormTextarea';
import { SearchBar } from '@/components/navigation/SearchBar';
import { FilterPanel } from '@/components/navigation/FilterPanel';
import { toast } from '@/providers/toast-provider';
import {
  createLeaveRequest,
  getLeaveRequests,
  hrApproveLeaveRequest,
  managerApproveLeaveRequest,
  rejectLeaveRequest,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from '@/api/leaveRequestsApi';

const leaveSchema = z.object({
  leaveType: z.enum(['SICK', 'CASUAL', 'PAID', 'UNPAID', 'MATERNITY', 'PATERNITY', 'MEDICAL', 'OTHER']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
}).refine((values) => new Date(values.endDate).getTime() >= new Date(values.startDate).getTime(), {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});

type LeaveFormValues = z.infer<typeof leaveSchema>;

const leaveTypeOptions: Array<{ label: string; value: LeaveType }> = [
  { label: 'Sick leave', value: 'SICK' },
  { label: 'Casual leave', value: 'CASUAL' },
  { label: 'Paid leave', value: 'PAID' },
  { label: 'Unpaid leave', value: 'UNPAID' },
  { label: 'Maternity leave', value: 'MATERNITY' },
  { label: 'Paternity leave', value: 'PATERNITY' },
  { label: 'Medical leave', value: 'MEDICAL' },
  { label: 'Other', value: 'OTHER' },
];

const statusFilters: Array<{ label: string; value: LeaveStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending manager', value: 'PENDING_MANAGER' },
  { label: 'Pending HR', value: 'PENDING_HR' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const isEmployee = role.toUpperCase() === 'EMPLOYEE';
  const isManager = ['MANAGER', 'ADMIN', 'HR'].includes(role.toUpperCase());

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leaveType: 'CASUAL',
      startDate: '',
      endDate: '',
      reason: '',
    },
  });

  useEffect(() => {
    setRole(localStorage.getItem('role') ?? '');
    const storedEmployeeId = localStorage.getItem('employeeId');
    setEmployeeId(storedEmployeeId ? Number(storedEmployeeId) || null : null);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getLeaveRequests();
        setRequests(data);
      } catch {
        setRequests([]);
      } finally {
        setLoading(false);
      }
    }

    if (role) {
      void load();
    }
  }, [isEmployee, role]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const searchMatch = !search || [request.leaveType, request.reason, request.employee?.name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase());
      const statusMatch = statusFilter === 'all' || request.status === statusFilter;
      return searchMatch && statusMatch;
    });
  }, [requests, search, statusFilter]);

  const columns = useMemo<ColumnDef<LeaveRequest>[]>(() => [
    {
      accessorKey: 'employee.name',
      header: 'Employee',
      cell: ({ row }) => row.original.employee?.name ?? 'N/A',
    },
    {
      accessorKey: 'leaveType',
      header: 'Type',
    },
    {
      accessorKey: 'startDate',
      header: 'Start',
      cell: ({ row }) => formatDate(row.original.startDate),
    },
    {
      accessorKey: 'endDate',
      header: 'End',
      cell: ({ row }) => formatDate(row.original.endDate),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => <span className="line-clamp-2 text-slate-600">{row.original.reason ?? 'N/A'}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const request = row.original;
        const canApprove = isManager && (request.status === 'PENDING_MANAGER' || request.status === 'PENDING_HR');
        const canReject = isManager && request.status !== 'REJECTED' && request.status !== 'CANCELLED';

        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectTarget(request)}>
              View
            </Button>
            {canApprove ? (
              <Button
                variant="success"
                size="sm"
                onClick={async () => {
                  try {
                    const updated = request.status === 'PENDING_HR'
                      ? await hrApproveLeaveRequest(request.id)
                      : await managerApproveLeaveRequest(request.id);
                    setRequests((current) => current.map((item) => (item.id === request.id ? updated : item)));
                    toast.success('Leave approved');
                  } catch {
                    toast.error('Action failed', 'Unable to approve leave request.');
                  }
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            ) : null}
            {canReject ? (
              <Button variant="destructive" size="sm" onClick={() => setRejectTarget(request)}>
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ], [isManager]);

  const totalDays = filteredRequests.reduce((total, request) => {
    const days = Math.max(1, Math.floor((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / 86400000) + 1);
    return total + days;
  }, 0);

  async function onCreate(values: LeaveFormValues) {
    try {
      const created = await createLeaveRequest({
        ...values,
        employeeId: employeeId ?? undefined,
      });
      setRequests((current) => [created, ...current]);
      setCreateOpen(false);
      form.reset();
      toast.success('Leave request created');
    } catch {
      toast.error('Submission failed', 'Please try again.');
    }
  }

  async function submitReject() {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.warning('Reason required', 'Enter a rejection reason before continuing.');
      return;
    }

    try {
      const updated = await rejectLeaveRequest(rejectTarget.id, rejectReason);
      setRequests((current) => current.map((item) => (item.id === rejectTarget.id ? updated : item)));
      setRejectTarget(null);
      setRejectReason('');
      toast.success('Leave rejected');
    } catch {
      toast.error('Action failed', 'Unable to reject leave request.');
    }
  }

  return (
    <ModuleTemplate
      title="Leave Requests"
      description="Standardized leave workflow, approvals, and request tracking for the ERP."
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Leave Requests' }]}
      actions={
        <>
          <Button variant="outline" onClick={() => void 0}>Export</Button>
          {isEmployee ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requests</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{requests.length}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filtered</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{filteredRequests.length}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Days</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{totalDays}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{role || 'Unknown'}</p>
          </div>
        </div>

        <FilterPanel onClear={() => {
          setSearch('');
          setStatusFilter('all');
        }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search leave requests" />
          <div className="min-w-48">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as LeaveStatus | 'all')}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
            >
              {statusFilters.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </FilterPanel>

        <DataTable
          columns={columns}
          data={filteredRequests}
          isLoading={loading}
          enableRowSelection={false}
          emptyTitle="No leave requests"
          emptyDescription="Create a request or adjust filters to view leave data."
          exportFileName="leave-requests"
          searchPlaceholder="Search leave requests"
          onSearchChange={setSearch}
          searchValue={search}
        />
      </div>

      <Dialog open={createOpen} title="New Leave Request" description="Submit a standardized leave request for approval." onClose={() => setCreateOpen(false)}>
        <FormWrapper
          form={form}
          onSubmit={onCreate}
          footer={
            <>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit request</Button>
            </>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormSelect name="leaveType" label="Leave type" options={leaveTypeOptions} />
            <FormDatePicker name="startDate" label="Start date" />
            <FormDatePicker name="endDate" label="End date" />
            <div className="md:col-span-2">
              <FormTextarea name="reason" label="Reason" rows={4} placeholder="Tell us why you need this leave" />
            </div>
          </div>
        </FormWrapper>
      </Dialog>

      <Dialog
        open={Boolean(rejectTarget)}
        title={rejectTarget ? `Review leave request #${rejectTarget.id}` : 'Leave request'}
        description={rejectTarget ? `${rejectTarget.employee?.name ?? 'Employee'} • ${formatDate(rejectTarget.startDate)} - ${formatDate(rejectTarget.endDate)}` : undefined}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
        confirmLabel="Reject request"
        cancelLabel="Close"
        destructive
        onConfirm={submitReject}
      >
        {rejectTarget ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Reason</p>
              <p className="mt-2">{rejectTarget.reason ?? 'N/A'}</p>
              <p className="mt-3 text-xs text-slate-500">Status: {rejectTarget.status}</p>
            </div>
            {isManager ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Rejection reason</span>
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                  placeholder="Explain why the request is being rejected"
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </ModuleTemplate>
  );
}
