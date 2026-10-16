import { apiClient } from "./apiClient";

export interface TimesheetRow {
  id: number;
  task: string;
  project: string | null;
  projectId: number | null;
  taskId: number | null;
  date: string;
  hours: number;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" | string;
  source?: "MANUAL" | "TASK_TIMER" | "IMPORT" | string;
  notes: string | null;
  employeeId: number | null;
  createdAt?: string;
  createdByUserId?: number | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedByUserId?: number | null;
  reviewedByUser?: { id: number; name: string } | null;
  rejectionReason?: string | null;
  organization?: { id: number; name: string };
  employee: { id: number; name: string } | null;
  createdByUser?: { id: number; name: string } | null;
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
  projectId?: number;
  taskId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface CreateTimesheetPayload {
  task: string;
  project?: string | null;
  projectId?: number | null;
  taskId?: number | null;
  date: string;
  hours: number;
  notes?: string | null;
}

export async function createTimesheet(
  payload: CreateTimesheetPayload,
): Promise<TimesheetRow> {
  return apiClient<TimesheetRow>("/timesheets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getTimesheet(id: number): Promise<TimesheetRow> {
  return apiClient<TimesheetRow>(`/timesheets/${id}`);
}

export async function updateTimesheet(
  id: number,
  payload: Partial<CreateTimesheetPayload>,
): Promise<TimesheetRow> {
  return apiClient<TimesheetRow>(`/timesheets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function submitTimesheet(id: number): Promise<TimesheetRow> {
  return apiClient<TimesheetRow>(`/timesheets/${id}/submit`, {
    method: "POST",
  });
}

export async function reviewTimesheet(
  id: number,
  decision: "APPROVED" | "REJECTED",
  reason?: string,
): Promise<TimesheetRow> {
  return apiClient<TimesheetRow>(`/timesheets/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, reason }),
  });
}

export async function getTimesheetsReport(
  filters: TimesheetFilters = {},
): Promise<TimesheetReportResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return apiClient<TimesheetReportResponse>(
    `/timesheets/report${qs ? "?" + qs : ""}`,
  );
}
