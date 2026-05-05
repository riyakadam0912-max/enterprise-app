'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AttendanceStatus } from '@/api/attendanceApi';
import { useEmployeeAttendance } from '@/hooks/useAttendance';

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_CELL: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ABSENT: 'bg-red-100 text-red-800 border-red-200',
  HALF_DAY: 'bg-amber-100 text-amber-800 border-amber-200',
  LEAVE: 'bg-sky-100 text-sky-800 border-sky-200',
};

function shiftMonth(month: string, delta: number) {
  const base = new Date(`${month}-01T00:00:00`);
  base.setMonth(base.getMonth() + delta);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
}

function SummaryMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">○</div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export default function EmployeeAttendancePage() {
  const params = useParams<{ id: string }>();
  const routeEmployeeId = Number(params.id);
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const session = useMemo(() => {
    if (typeof window === 'undefined') {
      return { role: 'ADMIN' as const, employeeId: null as number | null };
    }

    return {
      role: localStorage.getItem('role') === 'EMPLOYEE' ? ('EMPLOYEE' as const) : ('ADMIN' as const),
      employeeId: localStorage.getItem('employeeId') ? Number(localStorage.getItem('employeeId')) : null,
    };
  }, []);
  const employeeId = session.role === 'EMPLOYEE' && session.employeeId ? session.employeeId : routeEmployeeId;
  const { data, loading, error } = useEmployeeAttendance(employeeId, month);

  const monthStart = new Date(`${month}-01T00:00:00`);
  const leadingBlanks = monthStart.getDay();
  const isForbiddenEmployeeView = session.role === 'EMPLOYEE' && session.employeeId !== routeEmployeeId;
  const monthLabel = monthStart.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/dashboard/attendance" className="text-sm text-orange-600 hover:text-orange-700">← Back to Attendance</Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-2">{data?.employee.name ?? 'Employee Attendance'}</h1>
          <p className="text-sm text-slate-500 mt-1">Monthly attendance calendar with daily status and working-hour detail.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth((current) => shiftMonth(current, -1))} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">Previous</button>
          <div className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 shadow-sm">{monthLabel}</div>
          <button onClick={() => setMonth((current) => shiftMonth(current, 1))} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">Next</button>
        </div>
      </div>

      {isForbiddenEmployeeView ? (
        <EmptyPanel title="You can only view your own attendance" description="Open your own attendance history from the main attendance page." />
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryMini label="Days Present" value={data?.summary.present ?? 0} />
            <SummaryMini label="Days Absent" value={data?.summary.absent ?? 0} />
            <SummaryMini label="Leaves" value={data?.summary.leave ?? 0} />
            <SummaryMini label="Half Days" value={data?.summary.halfDay ?? 0} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryMini label="Late Count" value={data?.summary.lateCount ?? 0} />
            <SummaryMini label="Overtime Hours" value={Number(data?.summary.overtimeHours ?? 0)} />
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Assigned Shift</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {data?.employee?.shift?.name ?? 'Unassigned'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data?.employee?.shift?.startTime && data?.employee?.shift?.endTime
                  ? `${data.employee.shift.startTime} - ${data.employee.shift.endTime}`
                  : data?.employee?.shift?.type ?? 'No shift'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            {loading ? (
              <div className="py-16 text-center text-slate-400">Loading attendance calendar…</div>
            ) : error ? (
              <EmptyPanel title="Attendance history is unavailable" description={error} />
            ) : (data?.days.length ?? 0) === 0 ? (
              <EmptyPanel title="No attendance records this month" description="Check another month or start tracking attendance from the main page." />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-2">
                  {DAY_HEADERS.map((header) => (
                    <div key={header} className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-2 py-1">{header}</div>
                  ))}
                  {Array.from({ length: leadingBlanks }).map((_, index) => (
                    <div key={`blank-${index}`} className="min-h-28 rounded-2xl border border-dashed border-slate-100 bg-slate-50/60" />
                  ))}
                  {data?.days.map((day) => (
                    <div key={day.date} className={`min-h-28 rounded-2xl border p-3 ${STATUS_CELL[day.status]}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-lg font-semibold">{day.day}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide">{day.status === 'HALF_DAY' ? 'Half Day' : day.status.toLowerCase()}</span>
                      </div>
                      <div className="mt-4 space-y-1 text-xs">
                        <p>{day.checkIn ? `In ${new Date(day.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No check-in'}</p>
                        <p>{day.checkOut ? `Out ${new Date(day.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No check-out'}</p>
                        <p>{day.workingHours != null ? `${day.workingHours.toFixed(2)} hrs` : '—'}</p>
                        <p>{day.lateMinutes > 0 ? `Late by ${day.lateMinutes} mins` : 'On time'}</p>
                        <p>{day.overtimeHours > 0 ? `Overtime +${day.overtimeHours.toFixed(2)} hrs` : 'No overtime'}</p>
                        <p>{day.shiftDetails?.name ? `Shift: ${day.shiftDetails.name}` : 'Shift: Unassigned'}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  {(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'] as AttendanceStatus[]).map((status) => (
                    <div key={status} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className={`w-3 h-3 rounded-full border ${STATUS_CELL[status]}`} />
                      <span>{status === 'HALF_DAY' ? 'Half Day' : status.charAt(0) + status.slice(1).toLowerCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}