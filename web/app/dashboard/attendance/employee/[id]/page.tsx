'use client';

import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AttendanceStatus, EmployeeAttendanceDay, EmployeeAttendanceResponse } from '@/api/attendanceApi';
import { useEmployeeAttendance } from '@/hooks/useAttendance';
import { useAuthSession } from '@/stores/auth-store';
import { formatHoursDuration, formatShiftRange } from '@/lib/time-format';
import { buildAttendanceCalendarCells, csvCell } from '@/lib/attendance-format';

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_CELL: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ABSENT: 'bg-red-100 text-red-800 border-red-200',
  HALF_DAY: 'bg-amber-100 text-amber-800 border-amber-200',
  LEAVE: 'bg-sky-100 text-sky-800 border-sky-200',
  HOLIDAY: 'bg-teal-100 text-teal-800 border-teal-200',
  WEEKLY_OFF: 'bg-violet-100 text-violet-800 border-violet-200',
  UPCOMING: 'bg-slate-100 text-slate-600 border-slate-200',
  NOT_STARTED: 'bg-slate-100 text-slate-600 border-slate-200',
  NOT_SCHEDULED: 'bg-slate-100 text-slate-600 border-slate-200',
};

function statusLabel(status: AttendanceStatus) {
  if (status === 'HALF_DAY') return 'Half Day';
  if (status === 'HOLIDAY') return 'Corporate Holiday';
  if (status === 'WEEKLY_OFF') return 'Weekly Holiday';
  if (status === 'NOT_STARTED') return 'Not Started';
  if (status === 'NOT_SCHEDULED') return 'Not Scheduled';
  if (status === 'UPCOMING') return 'Upcoming';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function shiftMonth(month: string, delta: number) {
  const base = new Date(`${month}-01T00:00:00`);
  base.setMonth(base.getMonth() + delta);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
}

function isValidMonth(value: string | null): value is string {
  return value !== null && /^(\d{4})-(0[1-9]|1[0-2])$/.test(value);
}

function formatAttendanceTime(value: string, timezone?: string) {
  return new Intl.DateTimeFormat([], {
    timeZone: timezone || undefined,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

function downloadEmployeeMonthCsv(data: EmployeeAttendanceResponse) {
  const headers = [
    'Employee', 'Employee ID', 'Month', 'Date', 'Status', 'Check In', 'Check Out',
    'Attendance Hours', 'Task Hours', 'Break Hours', 'Late Minutes', 'Overtime Hours',
    'Shortfall Hours', 'Expected Hours', 'Holiday', 'Shoot Day', 'Work From Home Credit',
    'Shift', 'Shift Type', 'Timezone',
  ];
  const rows = data.days.map((day) => {
    const breakHours = (day.breaks ?? []).reduce((total, interval) => {
      if (!interval.endedAt) return total;
      return total + Math.max(0, new Date(interval.endedAt).getTime() - new Date(interval.startedAt).getTime()) / 3_600_000;
    }, 0);
    return [
      data.employee.name,
      data.employee.id,
      data.month,
      day.date.slice(0, 10),
      day.status,
      day.checkIn ?? '',
      day.checkOut ?? '',
      day.workingHours ?? '',
      day.taskHours ?? 0,
      breakHours.toFixed(2),
      day.lateMinutes,
      day.overtimeHours,
      day.shortfallHours ?? '',
      day.expectedHours ?? '',
      day.holidayName ?? '',
      day.isShootDay ? 'Yes' : 'No',
      day.workFromHomeCredit ?? '',
      day.shiftDetails?.name ?? '',
      day.shiftDetails?.type ?? '',
      data.timezone ?? '',
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`${csv}\r\n`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-${data.employee.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-${data.month}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function SummaryMini({ label, value, loading = false }: { label: string; value: number | string; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
      {loading ? <div className="mt-2 h-8 w-16 animate-pulse rounded-lg bg-slate-100" /> : <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>}
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
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [month, setMonth] = useState(() => isValidMonth(searchParams.get('month')) ? searchParams.get('month')! : defaultMonth);
  const [selectedDay, setSelectedDay] = useState<EmployeeAttendanceDay | null>(null);
  const authSession = useAuthSession();
  const session = useMemo(() => ({
    role: (authSession.role as 'SUPER_ADMIN' | 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE') ?? 'EMPLOYEE',
    employeeId: authSession.employeeId ?? null,
  }), [authSession.role, authSession.employeeId]);
  const employeeId = session.role === 'EMPLOYEE' && session.employeeId ? session.employeeId : routeEmployeeId;
  const { data, loading, error } = useEmployeeAttendance(employeeId, month);

  const updateMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    setSelectedDay(null);
    router.replace(`${pathname}?month=${nextMonth}`, { scroll: false });
  };

  const monthStart = new Date(`${month}-01T00:00:00`);
  const calendarCells = buildAttendanceCalendarCells(month, data?.days ?? []);
  const isForbiddenEmployeeView = session.role === 'EMPLOYEE' && session.employeeId !== routeEmployeeId;
  const canDownloadMonthlyCsv = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN' || session.role === 'HR';
  const monthLabel = monthStart.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/dashboard/attendance" className="text-sm text-orange-600 hover:text-orange-700">← Back to Attendance</Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-2">{data?.employee.name ?? 'Employee Attendance'}</h1>
          <p className="text-sm text-slate-500 mt-1">Monthly attendance calendar with daily status and working-hour detail.</p>
          {canDownloadMonthlyCsv && (
            <button
              type="button"
              onClick={() => data && downloadEmployeeMonthCsv(data)}
              disabled={!data || loading || Boolean(error)}
              className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Download monthly CSV
            </button>
          )}
        </div>
      </div>

      {isForbiddenEmployeeView ? (
        <EmptyPanel title="You can only view your own attendance" description="Open your own attendance history from the main attendance page." />
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            <SummaryMini label="Days Present" value={data?.summary.present ?? 0} loading={loading} />
            <SummaryMini label="Days Absent" value={data?.summary.absent ?? 0} loading={loading} />
            <SummaryMini label="Leaves" value={data?.summary.leave ?? 0} loading={loading} />
            <SummaryMini label="Holidays" value={data?.summary.holiday ?? 0} loading={loading} />
            <SummaryMini label="Half Days" value={data?.summary.halfDay ?? 0} loading={loading} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryMini label="Late Count" value={data?.summary.lateCount ?? 0} loading={loading} />
            <SummaryMini label="Overtime" value={formatHoursDuration(data?.summary.overtimeHours ?? 0)} loading={loading} />
            <SummaryMini label="Task Hours" value={formatHoursDuration(data?.summary.totalTaskHours ?? 0)} loading={loading} />
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Assigned Shift</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {data?.employee?.shift?.name ?? 'Unassigned'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data?.employee?.shift?.startTime && data?.employee?.shift?.endTime
                  ? formatShiftRange(data.employee.shift.startTime, data.employee.shift.endTime)
                  : data?.employee?.shift?.type ?? 'No shift'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="h-5 w-5 text-orange-500" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Attendance calendar</h2>
                  <p className="text-xs text-slate-500">Daily status and working-hour detail</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => updateMonth(shiftMonth(month, -1))}
                  aria-label="Previous month"
                  title="Previous month"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
                >
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <label className="sr-only" htmlFor="attendance-month">Attendance month</label>
                <input id="attendance-month" type="month" value={month} onChange={(event) => updateMonth(event.target.value)} className="min-w-36 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200" />
                <span className="sr-only">{monthLabel}</span>
                <button type="button" onClick={() => updateMonth(defaultMonth)} disabled={month === defaultMonth} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-orange-600 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:text-slate-300">Today</button>
                <button
                  type="button"
                  onClick={() => updateMonth(shiftMonth(month, 1))}
                  aria-label="Next month"
                  title="Next month"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>
            {loading ? (
              <div className="py-16 text-center text-slate-400">Loading attendance calendar…</div>
            ) : error ? (
              <EmptyPanel title="Attendance history is unavailable" description={error} />
            ) : (data?.days.length ?? 0) === 0 ? (
              <EmptyPanel title="No attendance records this month" description="Check another month or start tracking attendance from the main page." />
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto pb-1">
                <div className="grid min-w-[46rem] grid-cols-7 gap-2">
                  {DAY_HEADERS.map((header) => (
                    <div key={header} className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-2 py-1">{header}</div>
                  ))}
                  {calendarCells.map((cell) => {
                    if (!cell.day) {
                      return <div key={cell.key} className="min-h-28 rounded-2xl border border-dashed border-slate-100 bg-slate-50/60" />;
                    }
                    const day = cell.day;
                    return <button type="button" key={cell.key} onClick={() => setSelectedDay(day)} aria-label={`${day.date}: ${statusLabel(day.status)}`} className={`min-h-28 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300 ${STATUS_CELL[day.status]} ${selectedDay?.date === day.date ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-lg font-semibold">{day.day}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide">{statusLabel(day.status)}</span>
                      </div>
                      <div className="mt-4 space-y-1 text-xs">
                        {day.checkIn && (
                          <p>{formatAttendanceTime(day.checkIn, data?.timezone)} - {day.checkOut ? formatAttendanceTime(day.checkOut, data?.timezone) : 'In progress'}</p>
                        )}
                        {(day.workingHours != null || (day.taskHours ?? 0) > 0) && (
                          <p>
                            Worked {formatHoursDuration(day.workingHours ?? 0)}
                          </p>
                        )}
                        {(day.taskHours ?? 0) > 0 && (
                          <p className="text-xs text-slate-500">
                            Attendance time · {formatHoursDuration(day.workingHours ?? 0)}
                          </p>
                        )}
                        {(day.taskHours ?? 0) > 0 && (
                          <p className="text-xs text-slate-500">
                            Task hours · {formatHoursDuration(day.taskHours ?? 0)}
                          </p>
                        )}
                        {day.isShootDay && <p className="font-medium text-orange-700">Shoot day · attendance credited</p>}
                        {day.workFromHomeCredit !== undefined && (
                          <p className="font-medium text-sky-700">
                            Work from home · {day.workFromHomeCredit === 1 ? 'full-day' : 'half-day'} attendance credit
                          </p>
                        )}
                        {day.creditedWorkSeconds !== undefined && (
                          <p className="text-[10px] text-teal-700">Flexible credited time</p>
                        )}
                        {day.breaks?.map((interval) => {
                          const start = new Date(interval.startedAt);
                          const end = interval.endedAt ? new Date(interval.endedAt) : null;
                          const durationHours = end ? Math.max(0, end.getTime() - start.getTime()) / 3600000 : null;
                          return (
                            <p key={interval.startedAt} className="text-[11px]">
                              Break {formatAttendanceTime(interval.startedAt, data?.timezone)}
                              {' - '}{end ? formatAttendanceTime(interval.endedAt!, data?.timezone) : 'In progress'}
                              {durationHours !== null && <> · {formatHoursDuration(durationHours)}</>}
                            </p>
                          );
                        })}
                        {day.lateMinutes > 0 && <p className="font-semibold">Late by {day.lateMinutes} mins</p>}
                        {!day.checkIn && day.status === 'ABSENT' && <p>No attendance</p>}
                        {day.status === 'LEAVE' && <p>Approved leave</p>}
                        {day.status === 'HOLIDAY' && <p>{day.holidayName ?? 'Corporate holiday'}</p>}
                      </div>
                    </button>;
                  })}
                </div>
                {selectedDay && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-live="polite">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected day</p>
                        <h3 className="mt-1 text-base font-semibold text-slate-900">{new Date(`${selectedDay.date.slice(0, 10)}T00:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                      </div>
                      <button type="button" onClick={() => setSelectedDay(null)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white hover:text-slate-900">Close</button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                      <div><p className="text-xs text-slate-500">Status</p><p className="mt-1 font-semibold text-slate-900">{statusLabel(selectedDay.status)}</p></div>
                      <div><p className="text-xs text-slate-500">Attendance time</p><p className="mt-1 font-semibold text-slate-900">{formatHoursDuration(selectedDay.workingHours ?? 0)}</p></div>
                      <div><p className="text-xs text-slate-500">Task hours</p><p className="mt-1 font-semibold text-slate-900">{formatHoursDuration(selectedDay.taskHours ?? 0)}</p></div>
                      <div><p className="text-xs text-slate-500">Late / overtime</p><p className="mt-1 font-semibold text-slate-900">{selectedDay.lateMinutes}m / {formatHoursDuration(selectedDay.overtimeHours ?? 0)}</p></div>
                      <div><p className="text-xs text-slate-500">Timezone</p><p className="mt-1 font-semibold text-slate-900">{data?.timezone ?? 'Local time'}</p></div>
                    </div>
                  </div>
                )}
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  {(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKLY_OFF', 'UPCOMING', 'NOT_STARTED', 'NOT_SCHEDULED'] as AttendanceStatus[]).map((status) => (
                    <div key={status} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className={`w-3 h-3 rounded-full border ${STATUS_CELL[status]}`} />
                      <span>{statusLabel(status)}</span>
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
