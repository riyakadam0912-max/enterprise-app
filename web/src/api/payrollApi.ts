import { apiClient } from './apiClient';

// ===== INTERFACES =====

export interface SalaryStructure {
  id: number;
  employeeId: number;
  basic: number;
  hra: number;
  allowances: number;
  deductions: number;
  pf: number;
  esi: number;
  professionalTax: number;
  tds: number;
  isActive: boolean;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: number;
    name: string;
    email?: string;
  };
}

export interface PayrollCycle {
  id: number;
  name: string;
  month: number;
  year: number;
  status: string;
  runDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { entries: number };
}

export interface PayrollEntry {
  id: number;
  payrollCycleId: number;
  employeeId: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  status: string;
  paidAt: string | null;
  remarks: string | null;
  employee?: {
    id: number;
    name: string;
    email?: string;
  };
  payrollCycle?: {
    id: number;
    name: string;
    month: number;
    year: number;
  };
}

export interface Payslip {
  id: number;
  payrollEntryId: number;
  employeeId: number;
  month: number;
  year: number;
  basicSalary: number;
  hra: number;
  allowances: number;
  bonus: number;
  overtime: number;
  reimbursements: number;
  grossEarnings: number;
  pfDeduction: number;
  esiDeduction: number;
  professionalTax: number;
  tdsDeduction: number;
  lossOfPay: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  workingDays?: number;
  presentDays?: number;
  absenceDays?: number;
  paidLeaveTaken?: number;
  unpaidLeaveTaken?: number;
  taxRegime: string;
  annualTaxableIncome?: number;
  form16Generated: boolean;
  generatedAt?: string;
  downloadedAt?: string;
  emailSentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxDeclaration {
  id: number;
  employeeId: number;
  year: number;
  investment80C: number;
  investment80D: number;
  investment80CCD: number;
  hraExemption: number;
  standardDeduction: number;
  otherIncome: number;
  otherIncomeTaxed: number;
  exerciseStock: number;
  estimatedTaxableIncome?: number;
  approvalStatus: string;
  approvedBy?: number;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Form16 {
  id: number;
  employeeId: number;
  year: number;
  panNumber?: string;
  grossIncome: number;
  taxableIncome: number;
  totalTaxPaid: number;
  grossSalary: number;
  standardDeduction: number;
  interestIncomeUnderSection80A: number;
  investmentUnder80C: number;
  tfcData?: Record<string, string | number | boolean>;
  generatedAt?: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalaryStructurePayload {
  employeeId: number;
  basic?: number;
  hra?: number;
  allowances?: number;
  deductions?: number;
  pf?: number;
  esi?: number;
  professionalTax?: number;
  tds?: number;
}

export interface UpdateSalaryStructurePayload {
  basic?: number;
  hra?: number;
  allowances?: number;
  deductions?: number;
  pf?: number;
  esi?: number;
  professionalTax?: number;
  tds?: number;
  bonus?: number;
  overtime?: number;
}

export interface CreatePayrollCyclePayload {
  name: string;
  month: number;
  year: number;
  notes?: string;
}

export interface CreateTaxDeclarationPayload {
  employeeId: number;
  year: number;
  investment80C?: number;
  investment80D?: number;
  investment80CCD?: number;
  hraExemption?: number;
  otherIncome?: number;
  exerciseStock?: number;
}

// ===== API FUNCTIONS =====

// Salary Structure APIs
export function getSalaryStructures(): Promise<SalaryStructure[]> {
  return apiClient<SalaryStructure[]>('/payroll/salary-structures');
}

export function createSalaryStructure(payload: CreateSalaryStructurePayload): Promise<SalaryStructure> {
  return apiClient<SalaryStructure>('/payroll/salary-structures', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getSalaryStructureByEmployee(employeeId: number): Promise<SalaryStructure> {
  return apiClient<SalaryStructure>(`/payroll/salary-structures/employee/${employeeId}`);
}

export function updateSalaryStructure(employeeId: number, payload: UpdateSalaryStructurePayload): Promise<SalaryStructure> {
  return apiClient<SalaryStructure>(`/payroll/salary-structures/employee/${employeeId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Payroll Cycle APIs
export function getPayrollCycles(): Promise<PayrollCycle[]> {
  return apiClient<PayrollCycle[]>('/payroll/cycles');
}

export function createPayrollCycle(payload: CreatePayrollCyclePayload): Promise<PayrollCycle> {
  return apiClient<PayrollCycle>('/payroll/cycles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function runPayrollCycle(cycleId: number): Promise<{ generatedEntries: number; entries: PayrollEntry[] }> {
  return apiClient<{ generatedEntries: number; entries: PayrollEntry[] }>(`/payroll/cycles/${cycleId}/run`, {
    method: 'PATCH',
  });
}

export function getPayrollCycleEntries(cycleId: number): Promise<PayrollEntry[]> {
  return apiClient<PayrollEntry[]>(`/payroll/cycles/${cycleId}/entries`);
}

// Payroll Entry APIs
export function markPayrollEntryPaid(entryId: number, remarks?: string): Promise<PayrollEntry> {
  return apiClient<PayrollEntry>(`/payroll/entries/${entryId}/pay`, {
    method: 'PATCH',
    body: JSON.stringify({ remarks }),
  });
}

// Tax Declaration APIs
export function createTaxDeclaration(payload: CreateTaxDeclarationPayload): Promise<TaxDeclaration> {
  return apiClient<TaxDeclaration>('/payroll/tax-declarations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getTaxDeclaration(employeeId: number, year: number): Promise<TaxDeclaration> {
  return apiClient<TaxDeclaration>(`/payroll/tax-declarations/${employeeId}/${year}`);
}

export function approveTaxDeclaration(declarationId: number, approvedBy: number): Promise<TaxDeclaration> {
  return apiClient<TaxDeclaration>(`/payroll/tax-declarations/${declarationId}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ approvedBy }),
  });
}

// Payslip APIs
export function generatePayslips(cycleId: number): Promise<Payslip[]> {
  return apiClient<Payslip[]>(`/payroll/cycles/${cycleId}/generate-payslips`, {
    method: 'POST',
  });
}

export function getPayslip(payslipId: number): Promise<Payslip> {
  return apiClient<Payslip>(`/payroll/payslips/${payslipId}`);
}

export function getEmployeePayslips(employeeId: number): Promise<Payslip[]> {
  return apiClient<Payslip[]>(`/payroll/payslips/employee/${employeeId}`);
}

export function downloadPayslip(payslipId: number): Promise<string> {
  return apiClient<string>(`/payroll/payslips/${payslipId}/download`);
}

// Form 16 APIs
export function generateForm16(employeeId: number, year: number): Promise<Form16> {
  return apiClient<Form16>(`/payroll/form16/employee/${employeeId}/${year}`, {
    method: 'POST',
  });
}

export function getForm16(employeeId: number, year: number): Promise<Form16> {
  return apiClient<Form16>(`/payroll/form16/employee/${employeeId}/${year}`);
}
