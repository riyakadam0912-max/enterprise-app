import { api, unwrap } from "./client";

export type PayslipSummary = {
  id: number;
  month: number;
  year: number;
  grossEarnings: number;
  netPay: number;
  status: string;
  generatedAt: string;
  downloadedAt: string | null;
};
export type PayslipDetails = {
  month: number;
  year: number;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  netPay: number;
  attendance: Record<string, number>;
  generatedAt: string;
};
export type UpdatePayslipPayload = {
  month?: number;
  year?: number;
  basicSalary?: number;
  hra?: number;
  allowances?: number;
  bonus?: number;
  overtime?: number;
  reimbursements?: number;
  pfDeduction?: number;
  esiDeduction?: number;
  professionalTax?: number;
  tdsDeduction?: number;
  lossOfPay?: number;
  otherDeductions?: number;
};
export type CreateProjectPayload = {
  projectName: string;
  startDate?: string;
  endDate?: string;
  manager?: string;
  managerId?: number;
  status?: string;
  description?: string;
  client?: string;
  clientName?: string;
  category?: string;
  projectType?: string;
  specificTask?: string;
  priority?: string;
  budget?: number;
  remarks?: string;
  finalDeliverablesLink?: string;
  driveLink?: string;
};
export type CreateTimesheetPayload = {
  task: string;
  date: string;
  hours: number;
  status?: string;
  project?: string;
  notes?: string;
};
export type Timesheet = {
  id: number;
  task: string;
  date: string;
  hours: number;
  status: string;
  project?: string | null;
  notes?: string | null;
  employee?: { name?: string | null } | null;
};
export type Lead = {
  id: number;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  source?: string;
  notes?: string;
  leadOwner?: string;
  contactedDate?: string;
  nextFollowUp?: string;
  assignedTo?: string;
  leadScore?: number;
  createdAt?: string;
  updatedAt?: string;
};
export type CreateLeadPayload = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  source?: string;
  leadOwner?: string;
  contactedDate?: string;
  nextFollowUp?: string;
  assignedTo?: string;
  leadScore?: number;
  notes?: string;
};

export async function payslips() {
  return unwrap<PayslipSummary[]>((await api.get("/ess/payslip/list")).data);
}
export async function payslip(id: number) {
  return unwrap<PayslipDetails>((await api.get(`/ess/payslip/${id}`)).data);
}
export async function project(id: number) {
  return unwrap<Record<string, unknown>>(
    (await api.get(`/projects/${id}`)).data,
  );
}
export async function projectProgress(id: number) {
  return unwrap<Record<string, unknown>>(
    (await api.get(`/projects/${id}/progress`)).data,
  );
}
export async function createProject(payload: CreateProjectPayload) {
  return unwrap<Record<string, unknown>>(
    (await api.post("/projects", payload)).data,
  );
}
export async function updateProjectStatus(id: number, status: string) {
  return unwrap<Record<string, unknown>>(
    (await api.patch(`/projects/${id}/status`, { status })).data,
  );
}
export async function assignProjectEmployee(
  id: number,
  employeeId: number,
  driveLink?: string,
) {
  return unwrap<Record<string, unknown>>(
    (await api.post(`/projects/${id}/employees`, { employeeId, driveLink }))
      .data,
  );
}
export async function removeProjectEmployee(id: number, employeeId: number) {
  return unwrap<Record<string, unknown>>(
    (await api.delete(`/projects/${id}/employees/${employeeId}`)).data,
  );
}
export async function assignProjectManager(id: number, managerId: number) {
  return unwrap<Record<string, unknown>>(
    (await api.patch(`/projects/${id}/assign-manager`, { managerId })).data,
  );
}
export type ProjectMessage = {
  id: string;
  projectId: number;
  senderId: number;
  content: string;
  createdAt: string;
  sender?: { id: number; name: string; email: string };
};
export async function projectMessages(id: number) {
  return unwrap<ProjectMessage[]>(
    (await api.get(`/projects/${id}/messages`)).data,
  );
}
export async function sendProjectMessage(id: number, content: string) {
  return unwrap<ProjectMessage>(
    (await api.post(`/projects/${id}/messages`, { content })).data,
  );
}
export async function downloadPayslip(id: number) {
  return unwrap<string>(
    (
      await api.get(`/payroll/payslips/${id}/download`, {
        responseType: "text",
      })
    ).data,
  );
}
export async function updatePayslip(id: number, payload: UpdatePayslipPayload) {
  return unwrap<Record<string, unknown>>(
    (await api.patch(`/payroll/payslips/${id}`, payload)).data,
  );
}
export async function createTimesheet(payload: CreateTimesheetPayload) {
  return unwrap<Record<string, unknown>>(
    (await api.post("/timesheets", payload)).data,
  );
}
export async function timesheet(id: number) {
  return unwrap<Timesheet>((await api.get(`/timesheets/${id}`)).data);
}
export async function updateTimesheet(
  id: number,
  payload: Partial<CreateTimesheetPayload>,
) {
  return unwrap<Timesheet>(
    (await api.patch(`/timesheets/${id}`, payload)).data,
  );
}
export async function leads() {
  return unwrap<Lead[]>((await api.get("/leads")).data);
}
export async function lead(id: number) {
  return unwrap<Lead>((await api.get(`/leads/${id}`)).data);
}
export async function createLead(payload: CreateLeadPayload) {
  return unwrap<Lead>((await api.post("/leads", payload)).data);
}
export async function updateLead(
  id: number,
  payload: Partial<CreateLeadPayload>,
) {
  return unwrap<Lead>((await api.patch(`/leads/${id}`, payload)).data);
}
export async function importLeads(records: Record<string, unknown>[]) {
  return unwrap<unknown>((await api.post("/leads/import", { records })).data);
}
export async function convertLead(id: number) {
  return unwrap<unknown>((await api.post(`/leads/${id}/convert`)).data);
}
export async function removeLead(id: number) {
  return unwrap<unknown>((await api.delete(`/leads/${id}`)).data);
}
export const listEndpoint = async (path: string) =>
  unwrap<unknown>((await api.get(path)).data);
