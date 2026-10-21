import { dayKey } from './workday-schedule.utils';

export type WorkFromHomeRequest = {
  employeeId: number | null;
  requestType: string;
  status: string;
  startDate: Date;
  endDate: Date;
};

export function buildApprovedWorkFromHomeCredits(
  requests: WorkFromHomeRequest[],
  isScheduledWorkday: (employeeId: number, date: Date) => boolean,
): Map<string, number> {
  const datesByEmployeeMonth = new Map<string, Set<string>>();

  for (const request of requests) {
    if (
      request.requestType !== 'WORK_FROM_HOME' ||
      request.status !== 'APPROVED' ||
      request.employeeId === null
    ) {
      continue;
    }

    const start = new Date(
      Date.UTC(
        request.startDate.getUTCFullYear(),
        request.startDate.getUTCMonth(),
        request.startDate.getUTCDate(),
      ),
    );
    const end = new Date(
      Date.UTC(
        request.endDate.getUTCFullYear(),
        request.endDate.getUTCMonth(),
        request.endDate.getUTCDate(),
      ),
    );
    for (
      const date = new Date(start);
      date <= end;
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      if (!isScheduledWorkday(request.employeeId, date)) continue;
      const dateKey = dayKey(date);
      const employeeMonthKey = `${request.employeeId}:${dateKey.slice(0, 7)}`;
      const dates = datesByEmployeeMonth.get(employeeMonthKey) ?? new Set();
      dates.add(dateKey);
      datesByEmployeeMonth.set(employeeMonthKey, dates);
    }
  }

  const credits = new Map<string, number>();
  for (const [employeeMonthKey, dates] of datesByEmployeeMonth) {
    const employeeId = Number(employeeMonthKey.slice(0, employeeMonthKey.indexOf(':')));
    [...dates]
      .sort()
      .forEach((dateKey, index) => {
        credits.set(`${employeeId}:${dateKey}`, index < 2 ? 1 : 0.5);
      });
  }
  return credits;
}
