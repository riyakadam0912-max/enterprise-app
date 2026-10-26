'use client';

import { useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CheckCircle2, Plus, XCircle } from 'lucide-react';
import { getEmployees, type Employee } from '@/api/employeesApi';
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
import { isSuperAdminSession, useAuthSession } from '@/stores/auth-store';
import {
  createLeaveRequest,
  getLeaveRequests,
  getCompOffClaims,
  hrApproveLeaveRequest,
  managerApproveLeaveRequest,
  rejectLeaveRequest,
  reviewCompOffClaim,
  type LeaveRequest,
  type LeaveCompOffClaim,
  type LeaveDuration,
  type LeaveStatus,
  type LeaveType,
} from '@/api/leaveRequestsApi';

const leaveSchema = z.object({
  employeeId: z.string().optional(),
  requestType: z.enum(['LEAVE', 'WORK_FROM_HOME']),
  leaveType: z.enum(['SICK', 'CASUAL', 'PAID', 'UNPAID', 'MATERNITY', 'PATERNITY', 'MEDICAL', 'OTHER', 'COMP_OFF']).optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  duration: z.enum(['FULL_DAY', 'HALF_DAY']),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
})
  .refine((values) => values.requestType === 'WORK_FROM_HOME' || Boolean(values.leaveType), {
    message: 'Leave type is required',
    path: ['leaveType'],
  })
  .refine((values) => new Date(values.endDate).getTime() >= new Date(values.startDate).getTime(), {
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
  { label: 'Comp-off', value: 'COMP_OFF' },
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

export default function ScopedLeavePage() {
  const session = useAuthSession();
  return <LeavePage key={`${session.user?.id}:${session.organizationId}:${session.activeBusinessUnitId}`} />;
}

function LeavePage() {
  const session = useAuthSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [compOffClaims, setCompOffClaims] = useState<LeaveCompOffClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const role = isSuperAdminSession(session) ? 'SUPER_ADMIN' : session.role ?? '';
  const employeeId = session.employeeId;
  const isEmployee = role.toUpperCase() === 'EMPLOYEE';
  const canCreateForEmployee = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(role.toUpperCase());
  const canCreateOwnRequest = isEmployee || role.toUpperCase() === 'MANAGER' || canCreateForEmployee;
  const isManager = ['MANAGER', 'ADMIN', 'HR', 'SUPER_ADMIN'].includes(role.toUpperCase());

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      requestType: 'LEAVE',
      leaveType: 'CASUAL',
      startDate: '',
      endDate: '',
      duration: 'FULL_DAY',
      reason: '',
    },
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [data, claims] = await Promise.all([
          getLeaveRequests(),
          getCompOffClaims(),
        ]);
        setRequests(data);
        setCompOffClaims(claims);
      } catch {
        setRequests([]);
        setCompOffClaims([]);
      } finally {
        setLoading(false);
      }
    }

    if (role) {
      void load();
    }
  }, [role, session.organizationId, session.activeBusinessUnitId]);

  useEffect(() => {
    let active = true;
    setEmployees([]); setDirectoryError(null);
    if (canCreateForEmployee) {
      getEmployees().then(rows => { if (active) setEmployees(rows); })
        .catch(error => { if (active) setDirectoryError(error instanceof Error ? error.message : 'Unable to load employees.'); });
    }
    return () => { active = false; };
  }, [canCreateForEmployee, session.organizationId, session.activeBusinessUnitId]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const searchMatch = !search || [
        request.requestType === 'WORK_FROM_HOME' ? 'work from home' : request.leaveType,
        request.reason,
        request.employee?.name ?? '',
        request.employee?.organization?.name ?? '',
      ]
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
      cell: ({ row }) => (
        <div>
          <div>{row.original.employee?.name ?? 'N/A'}</div>
          {row.original.employee?.organization?.name && (
            <div className="text-xs text-slate-500">{row.original.employee.organization.name}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'requestType',
      header: 'Type',
      cell: ({ row }) => row.original.status === 'APPROVED' && row.original.requestType !== 'WORK_FROM_HOME'
        ? `${leaveTypeOptions.find(option => option.value === row.original.leaveType)?.label ?? row.original.leaveType} (${row.original.isPaid === false ? 'Unpaid' : 'Paid'})`
        : row.original.requestType === 'WORK_FROM_HOME'
        ? 'Work from home'
        : leaveTypeOptions.find((option) => option.value === row.original.leaveType)?.label ?? row.original.leaveType,
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
      accessorKey: 'duration',
      header: 'Duration',
      cell: ({ row }) => row.original.duration === 'HALF_DAY' ? 'Half day (5 hrs/date)' : 'Full day',
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
        const isOwnManagerRequest =
          role.toUpperCase() === 'MANAGER' && request.employeeId === employeeId;
        const canApprove =
          !isOwnManagerRequest &&
          ((request.status === 'PENDING_MANAGER' &&
            ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role.toUpperCase())) ||
            (request.status === 'PENDING_HR' &&
              ['HR', 'ADMIN', 'SUPER_ADMIN'].includes(role.toUpperCase())));
        const canReject =
          ['ADMIN', 'HR', 'SUPER_ADMIN'].includes(role.toUpperCase()) &&
          request.status !== 'REJECTED' &&
          request.status !== 'CANCELLED';

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
                    toast.success(updated.status === 'APPROVED' ? `Leave approved${updated.requestType === 'WORK_FROM_HOME' ? '' : updated.isPaid === false ? ' as unpaid' : ' as paid'}` : 'Manager approval recorded; awaiting HR approval');
                  } catch (error) {
                    toast.error('Action failed', error instanceof Error ? error.message : 'Unable to approve leave request.');
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
  ], [employeeId, role]);

  const totalDays = filteredRequests.reduce((total, request) => {
    const days = Math.max(1, Math.floor((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / 86400000) + 1);
    return total + (request.duration === 'HALF_DAY' ? days * 0.5 : days);
  }, 0);

  async function onCreate(values: LeaveFormValues) {
    if (canCreateForEmployee && !values.employeeId) { form.setError('employeeId', { message: 'Select an employee' }); return; }
    try {
      const created = await createLeaveRequest({
        requestType: values.requestType,
        startDate: values.startDate,
        endDate: values.endDate,
        reason: values.reason,
        ...(values.requestType === 'LEAVE'
          ? {
              leaveType: values.leaveType ?? 'OTHER',
              duration: values.duration,
            }
          : {}),
        employeeId: canCreateForEmployee ? Number(values.employeeId) : employeeId ?? undefined,
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

  async function reviewClaim(claimId: number, decision: 'approve' | 'reject') {
    try {
      await reviewCompOffClaim(claimId, decision);
      setCompOffClaims((current) =>
        current.filter((claim) => claim.id !== claimId),
      );
      toast.success(
        decision === 'approve' ? 'Comp-off approved' : 'Comp-off rejected',
      );
    } catch {
      toast.error('Action failed', `Unable to ${decision} comp-off claim.`);
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
          {canCreateOwnRequest ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-6">
        {isManager && compOffClaims.length > 0 ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Comp-off claims</h2>
            <p className="mt-1 text-sm text-slate-600">
              Holiday work of 4+ hours earns 0.5 day; 8+ hours earns 1 day after approval.
            </p>
            <div className="mt-4 space-y-3">
              {compOffClaims.map((claim) => (
                <div key={claim.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4">
                  <div>
                    <p className="font-medium text-slate-900">{claim.employee.name}</p>
                    <p className="text-sm text-slate-600">
                      Worked {claim.hours} hours on {formatDate(claim.workDate)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="success" size="sm" onClick={() => void reviewClaim(claim.id, 'approve')}>
                      Approve
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => void reviewClaim(claim.id, 'reject')}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {!isManager && compOffClaims.length > 0 ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Comp-off claims awaiting approval
            </h2>
            <div className="mt-3 space-y-2">
              {compOffClaims.map((claim) => (
                <p key={claim.id} className="text-sm text-slate-700">
                  {claim.hours} hours worked on {formatDate(claim.workDate)} · pending manager/HR review
                </p>
              ))}
            </div>
          </section>
        ) : null}
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

      <Dialog open={createOpen} title="New Leave Request" description="Submit a leave or work-from-home request for approval." onClose={() => setCreateOpen(false)}>
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
            {canCreateForEmployee && <div className="md:col-span-2">
              <FormSelect name="employeeId" label="Employee" options={employees.map(employee => ({ value: String(employee.id), label: `${employee.name}${employee.organization?.name ? ` - ${employee.organization.name}` : ''}` }))} />
              {directoryError && <p role="alert" className="text-sm text-rose-600">{directoryError}</p>}
            </div>}
            {form.watch('requestType') === 'LEAVE' && form.watch('leaveType') !== 'COMP_OFF' && <p className="text-sm text-slate-600 md:col-span-2">If the paid balance cannot cover the full request, the entire request is approved as unpaid. The remaining paid balance is preserved.</p>}
            <FormSelect
              name="requestType"
              label="Request type"
              options={[
                { label: 'Leave', value: 'LEAVE' },
                { label: 'Work from home', value: 'WORK_FROM_HOME' },
              ]}
            />
            {form.watch('requestType') === 'LEAVE' ? (
              <>
                <FormSelect name="leaveType" label="Leave type" options={leaveTypeOptions} />
                <FormSelect
                  name="duration"
                  label="Duration"
                  options={[
                    { label: 'Full day', value: 'FULL_DAY' as LeaveDuration },
                    { label: 'Half day (work 5 hours)', value: 'HALF_DAY' as LeaveDuration },
                  ]}
                />
              </>
            ) : (
              <p className="text-sm text-slate-600 md:col-span-2">
                The first two approved scheduled WFH dates per calendar month receive full-day attendance credit; additional dates receive half-day credit.
              </p>
            )}
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
        description={rejectTarget ? `${rejectTarget.employee?.name ?? 'Employee'} • ${formatDate(rejectTarget.startDate)} - ${formatDate(rejectTarget.endDate)} • ${rejectTarget.duration === 'HALF_DAY' ? 'Half day per date, 5 work hours each date' : 'Full day'}` : undefined}
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
              <p className="mt-3 text-xs text-slate-500">{rejectTarget.duration === 'HALF_DAY' ? 'Employee is expected to work 5 hours per requested date, excluding breaks.' : 'Full-day leave'}</p>
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
