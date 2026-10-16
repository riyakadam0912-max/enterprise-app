'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createLeaveRequest, LeaveDuration, LeaveType } from '../../../../src/api/leaveRequestsApi';
import { getEmployees } from '../../../../src/api/employeesApi';
import { getErrorMessage, reportError, retryAsync } from '@/lib/error-handling';
import { useAuthSession } from '@/stores/auth-store';

interface Employee { id: number; name: string }

const LEAVE_TYPES: LeaveType[] = ['PAID', 'CASUAL', 'SICK', 'UNPAID', 'MATERNITY', 'PATERNITY', 'MEDICAL', 'OTHER'];
const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  PAID:      'Paid',
  CASUAL:    'Casual',
  SICK:      'Sick',
  UNPAID:    'Unpaid',
  MATERNITY: 'Maternity',
  PATERNITY: 'Paternity',
  MEDICAL:   'Medical',
  OTHER:     'Other',
};

const EMPTY: {
  employeeId: string;
  startDate: string;
  endDate: string;
  duration: LeaveDuration;
  leaveType: LeaveType | '';
  reason: string;
} = {
  employeeId: '',
  startDate: '',
  endDate: '',
  duration: 'FULL_DAY',
  leaveType: '',
  reason: '',
};

export default function AddLeaveRequestPage() {
  const router = useRouter();
  const session = useAuthSession();
  const isEmployeeRole = session.role === 'EMPLOYEE';
  const isManagerRole = session.role === 'MANAGER';
  const isSelfServiceRole = isEmployeeRole || isManagerRole;
  const [form, setForm]         = useState(EMPTY);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (isSelfServiceRole) {
      setEmployees([]);
      setForm((current) => ({
        ...current,
        employeeId: session.employeeId ? String(session.employeeId) : '',
      }));
      return;
    }

    async function loadEmployees() {
      try {
        setEmployees(await retryAsync(() => getEmployees(), 2, 200));
      } catch (error) {
        reportError(error, 'Unable to load employees');
      }
    }

    loadEmployees();
  }, [isSelfServiceRole, session.employeeId]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const resolvedEmployeeId = isSelfServiceRole
        ? session.employeeId ?? undefined
        : form.employeeId ? parseInt(form.employeeId) : undefined;

      if (!resolvedEmployeeId && !isManagerRole) {
        setError(isEmployeeRole ? 'Your employee profile is not linked to this account.' : 'Please select an employee.');
        return;
      }

      await createLeaveRequest({
        startDate:  form.startDate,
        endDate:    form.endDate,
        duration:   form.duration,
        leaveType:  (form.leaveType || 'OTHER') as LeaveType,
        reason:     form.reason    || undefined,
        employeeId: resolvedEmployeeId,
      });
      router.push('/dashboard/requests');
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to create leave request. Please try again.');
      setError(message);
      reportError(err, 'Leave request submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => setForm({
    ...EMPTY,
    employeeId: isSelfServiceRole && session.employeeId ? String(session.employeeId) : '',
  });

  const employeeDisplayName = isSelfServiceRole ? (session.user?.name || 'Current Employee') : '';

  const inputCls =
    'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-orange-400 bg-white';
  const labelCls = 'w-44 shrink-0 text-sm text-gray-600 font-medium pt-1.5';
  const rowCls   = 'flex items-start gap-3';

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => router.push('/dashboard/requests')}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ‹
        </button>
        <h1 className="text-base font-semibold text-gray-800">Leave Requests</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-lg max-w-2xl"
      >
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <span className="text-sm font-semibold text-gray-700">Leave Request Information</span>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* Employee */}
          {isSelfServiceRole ? (
            <div className={rowCls}>
              <label className={labelCls}>
                Employee <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                readOnly
                value={employeeDisplayName}
                className={`${inputCls} bg-gray-50 text-gray-700 cursor-default`}
              />
            </div>
          ) : (
            <div className={rowCls}>
              <label className={labelCls}>
                Employee <span className="text-red-500">*</span>
              </label>
              <select
                value={form.employeeId}
                onChange={(e) => set('employeeId', e.target.value)}
                className={`${inputCls} focus:border-orange-400`}
              >
                <option value="">-Select-</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Start Date */}
          <div className={rowCls}>
            <label className={labelCls}>
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              placeholder="dd-MMM-yyyy"
              className={inputCls}
            />
          </div>

          {/* End Date */}
          <div className={rowCls}>
            <label className={labelCls}>
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="date"
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
              placeholder="dd-MMM-yyyy"
              className={inputCls}
            />
          </div>

          {/* Request duration */}
          <div className={rowCls}>
            <label className={labelCls}>Duration</label>
            <div className="w-full">
              <select
                value={form.duration}
                onChange={(e) => set('duration', e.target.value)}
                className={inputCls}
              >
                <option value="FULL_DAY">Full day</option>
                <option value="HALF_DAY">Half day (work 5 hours)</option>
              </select>
              {form.duration === 'HALF_DAY' && (
                <p className="mt-1 text-xs text-gray-500">Each date counts as half a day. Work 5 hours per date, excluding breaks.</p>
              )}
            </div>
          </div>

          {/* Leave Type */}
          <div className={rowCls}>
            <label className={labelCls}>Leave Type</label>
            <select
              value={form.leaveType}
              onChange={(e) => set('leaveType', e.target.value)}
              className={inputCls}
            >
              <option value="">-Select-</option>
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div className={rowCls}>
            <label className={labelCls}>Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
