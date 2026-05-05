import { apiClient } from './apiClient';

export interface TimesheetRow {
  id: number;
  task: string;
  project: string | null;
  date: string;
  hours: number;
  status: string;
  notes: string | null;
  employeeId: number | null;
  employee: { id: number; name: string } | null;
}

export interface TimesheetReportResponse {
  data: TimesheetRow[];
  total: number;
  page: number;
  limit: number;
}

export interface TimesheetFilters {
  page?: number;
  limit?: number;
  employee?: string;
  status?: string;
  project?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function getTimesheetsReport(filters: TimesheetFilters = {}): Promise<TimesheetReportResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return apiClient<TimesheetReportResponse>(`/timesheets/report${qs ? '?' + qs : ''}`);
}
