import { api, unwrap } from './client';
import type { AttendanceRecord, AttendanceSummary, AttendanceToday, ShiftSummary, TeamAttendance } from '@/src/types/hr';

const emptyToday: AttendanceToday = { date: new Date().toISOString(), status: 'ABSENT', checkIn: null, checkOut: null, workingHours: null, lateMinutes: 0, overtimeHours: 0, shortfallHours: 0, shift: null };

function recordFromApi(value: unknown): AttendanceRecord | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	if (typeof row.date !== 'string') return null;
	const shiftValue = row.shiftDetails ?? row.shift;
	const shift = shiftValue && typeof shiftValue === 'object' ? shiftValue as Record<string, unknown> : null;
	const shiftSummary: ShiftSummary | null = shift && typeof shift.name === 'string' ? { id: typeof shift.id === 'number' ? shift.id : null, name: shift.name, type: typeof shift.type === 'string' ? shift.type : undefined, startTime: typeof shift.startTime === 'string' ? shift.startTime : '', endTime: typeof shift.endTime === 'string' ? shift.endTime : '', requiredHours: typeof shift.requiredHours === 'number' ? shift.requiredHours : null, minPresentHours: typeof shift.minPresentHours === 'number' ? shift.minPresentHours : null, gracePeriodMinutes: typeof shift.gracePeriodMinutes === 'number' ? shift.gracePeriodMinutes : null } : null;
	const employee = row.employee && typeof row.employee === 'object' ? row.employee as Record<string, unknown> : null;
	return { date: row.date, id: typeof row.id === 'number' ? row.id : null, employeeId: typeof row.employeeId === 'number' ? row.employeeId : undefined, employee: employee && typeof employee.id === 'number' && typeof employee.name === 'string' ? { id: employee.id, name: employee.name, department: typeof employee.department === 'string' ? employee.department : null, designation: typeof employee.designation === 'string' ? employee.designation : null } : undefined, status: typeof row.status === 'string' ? row.status as AttendanceRecord['status'] : 'ABSENT', checkIn: typeof row.checkIn === 'string' ? row.checkIn : null, checkOut: typeof row.checkOut === 'string' ? row.checkOut : null, workingHours: typeof row.workingHours === 'number' ? row.workingHours : null, shortfallHours: typeof row.shortfallHours === 'number' ? row.shortfallHours : 0, lateMinutes: typeof row.lateMinutes === 'number' ? row.lateMinutes : 0, overtimeHours: typeof row.overtimeHours === 'number' ? row.overtimeHours : 0, shift: shiftSummary };
}

export async function checkIn() { return unwrap((await api.post('/attendance/check-in')).data); }
export async function checkOut() { return unwrap((await api.post('/attendance/check-out')).data); }
export async function attendanceToday(): Promise<AttendanceToday> {
	const payload = unwrap<unknown>((await api.get('/attendance/my')).data);
	if (!payload || typeof payload !== 'object') return emptyToday;
	const value = payload as Record<string, unknown>;
	return { date: typeof value.date === 'string' ? value.date : emptyToday.date, status: typeof value.status === 'string' ? value.status as AttendanceToday['status'] : 'ABSENT', checkIn: typeof value.checkIn === 'string' ? value.checkIn : null, checkOut: typeof value.checkOut === 'string' ? value.checkOut : null, workingHours: typeof value.workingHours === 'number' ? value.workingHours : null, lateMinutes: typeof value.lateMinutes === 'number' ? value.lateMinutes : 0, overtimeHours: typeof value.overtimeHours === 'number' ? value.overtimeHours : 0, shortfallHours: typeof value.shortfallHours === 'number' ? value.shortfallHours : 0, shift: recordFromApi({ date: typeof value.date === 'string' ? value.date : emptyToday.date, ...value })?.shift ?? null };
}
export async function attendanceHistory(): Promise<AttendanceRecord[]> {
	const payload = unwrap<unknown>((await api.get('/attendance/me', { params: { limit: 10, page: 1 } })).data);
	const rows = payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown[] }).data) ? (payload as { data: unknown[] }).data : [];
	return rows.map(recordFromApi).filter((record): record is AttendanceRecord => record !== null);
}

export async function attendanceSummary(month?: string): Promise<AttendanceSummary> {
	return unwrap<AttendanceSummary>((await api.get('/attendance/summary', { params: month ? { month } : undefined })).data);
}

export async function teamAttendance(date?: string): Promise<TeamAttendance> {
	const payload = unwrap<unknown>((await api.get('/attendance/today', { params: date ? { date } : undefined })).data);
	const value = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
	const rows = Array.isArray(value.rows) ? value.rows.map(recordFromApi).filter((record): record is AttendanceRecord => record !== null) : [];
	const rawSummary = value.summary && typeof value.summary === 'object' ? value.summary as Record<string, unknown> : {};
	return { date: typeof value.date === 'string' ? value.date : new Date().toISOString(), rows, summary: { present: typeof rawSummary.present === 'number' ? rawSummary.present : 0, absent: typeof rawSummary.absent === 'number' ? rawSummary.absent : 0, leave: typeof rawSummary.leave === 'number' ? rawSummary.leave : 0, halfDay: typeof rawSummary.halfDay === 'number' ? rawSummary.halfDay : 0, lateCount: typeof rawSummary.lateCount === 'number' ? rawSummary.lateCount : 0, overtimeHours: typeof rawSummary.overtimeHours === 'number' ? rawSummary.overtimeHours : 0, shortfallHours: typeof rawSummary.shortfallHours === 'number' ? rawSummary.shortfallHours : 0 } };
}

export type ShiftOption = { id: number; name: string; type: string; startTime: string; endTime: string; requiredHours: number; };
export type CreateShiftPayload = { name: string; type: 'FIXED' | 'FLEXIBLE' | 'ROTATIONAL'; startTime?: string; endTime?: string; requiredHours?: number; minPresentHours?: number; gracePeriodMinutes?: number };
export type AssignShiftPayload = { employeeId: number; shiftId: number };
export async function shifts(): Promise<ShiftOption[]> {
	const payload = unwrap<unknown>((await api.get('/attendance/shifts')).data);
	return Array.isArray(payload) ? payload.filter((value): value is ShiftOption => Boolean(value && typeof value === 'object' && typeof (value as ShiftOption).id === 'number' && typeof (value as ShiftOption).name === 'string')).map((value) => ({ id: value.id, name: value.name, type: value.type ?? 'FIXED', startTime: value.startTime ?? '', endTime: value.endTime ?? '', requiredHours: value.requiredHours ?? 8 })) : [];
}
export async function createShift(payload: CreateShiftPayload) { return unwrap<ShiftOption>((await api.post('/attendance/shifts', payload)).data); }
export async function assignShift(payload: AssignShiftPayload) { return unwrap<unknown>((await api.post('/attendance/shifts/assign', payload)).data); }
export async function monthlyAttendanceReport(params: { month: number; year: number }) { return unwrap<unknown>((await api.get('/attendance/monthly-report', { params })).data); }
