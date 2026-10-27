import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PayrollCalculationService } from './payroll-calculation.service';
import { getPayrollAttendanceMetrics } from './payroll-attendance.utils';

@Injectable()
export class PayslipGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationService: PayrollCalculationService,
  ) {}

  /**
   * Generate payslip for an employee for a specific month
   */
  async generatePayslip(payrollEntryId: number): Promise<
    Prisma.PayslipGetPayload<{
      include: { employee: true };
    }>
  > {
    const payrollEntry = await this.prisma.payrollEntry.findUnique({
      where: { id: payrollEntryId },
      include: {
        employee: true,
        payrollCycle: true,
      },
    });

    if (!payrollEntry) {
      throw new NotFoundException('Payroll entry not found');
    }

    // Get salary structure
    const salaryStructure = await this.prisma.salaryStructure.findFirst({
      where: {
        employeeId: payrollEntry.employeeId,
        isActive: true,
      },
    });

    if (!salaryStructure) {
      throw new NotFoundException('Salary structure not found for employee');
    }

    // Get attendance data
    const attendanceData = await this.getAttendanceData(
      payrollEntry.employeeId,
      payrollEntry.payrollCycle.month,
      payrollEntry.payrollCycle.year,
      payrollEntry.employee.organizationId,
    );

    // Calculate payroll
    const calculation = await this.calculationService.calculatePayroll({
      employeeId: payrollEntry.employeeId,
      month: payrollEntry.payrollCycle.month,
      year: payrollEntry.payrollCycle.year,
      salaryStructure,
      attendanceData,
    });

    // Determine tax regime
    const taxRegime = 'NEW';

    const monthlyTds = calculation.deductions.tds;

    // Create payslip record
    const payslip = await this.prisma.payslip.upsert({
      where: { payrollEntryId },
      update: {
        basicSalary: calculation.earnings.basic,
        hra: calculation.earnings.hra,
        allowances: calculation.earnings.allowances,
        bonus: calculation.earnings.bonus,
        overtime: calculation.earnings.overtime,
        reimbursements: calculation.earnings.reimbursements,
        grossEarnings: calculation.grossEarnings,
        pfDeduction: calculation.deductions.pfEmployee,
        esiDeduction: calculation.deductions.esi,
        professionalTax: calculation.deductions.professionalTax,
        tdsDeduction: monthlyTds,
        lossOfPay: calculation.deductions.lossOfPay,
        otherDeductions:
          calculation.deductions.advance + calculation.deductions.other,
        totalDeductions: calculation.totalDeductions,
        netPay: calculation.netPay,
        workingDays: attendanceData.totalWorkingDays,
        presentDays: attendanceData.presentDays,
        absenceDays: attendanceData.absentDays,
        paidLeaveTaken: attendanceData.paidLeaves,
        unpaidLeaveTaken: attendanceData.unpaidLeaves,
        lateCount: attendanceData.lateCount,
        overtimeHours: attendanceData.overtimeHours,
        overtimeBonus: calculation.earnings.overtime,
        lateMarkPenalty: calculation.deductions.latePenalty,
        taxRegime,
        generatedAt: new Date(),
      },
      create: {
        payrollEntryId,
        employeeId: payrollEntry.employeeId,
        organizationId: payrollEntry.employee.organizationId,
        month: payrollEntry.payrollCycle.month,
        year: payrollEntry.payrollCycle.year,
        basicSalary: calculation.earnings.basic,
        hra: calculation.earnings.hra,
        allowances: calculation.earnings.allowances,
        bonus: calculation.earnings.bonus,
        overtime: calculation.earnings.overtime,
        reimbursements: calculation.earnings.reimbursements,
        grossEarnings: calculation.grossEarnings,
        pfDeduction: calculation.deductions.pfEmployee,
        esiDeduction: calculation.deductions.esi,
        professionalTax: calculation.deductions.professionalTax,
        tdsDeduction: monthlyTds,
        lossOfPay: calculation.deductions.lossOfPay,
        otherDeductions:
          calculation.deductions.advance + calculation.deductions.other,
        totalDeductions: calculation.totalDeductions,
        netPay: calculation.netPay,
        workingDays: attendanceData.totalWorkingDays,
        presentDays: attendanceData.presentDays,
        absenceDays: attendanceData.absentDays,
        paidLeaveTaken: attendanceData.paidLeaves,
        unpaidLeaveTaken: attendanceData.unpaidLeaves,
        lateCount: attendanceData.lateCount,
        overtimeHours: attendanceData.overtimeHours,
        overtimeBonus: calculation.earnings.overtime,
        lateMarkPenalty: calculation.deductions.latePenalty,
        taxRegime,
        generatedAt: new Date(),
      },
      include: { employee: true },
    });

    // Create earnings breakdown
    await this.prisma.payrollEarnings.upsert({
      where: { payrollEntryId },
      update: {
        basicSalary: calculation.earnings.basic,
        hra: calculation.earnings.hra,
        specialAllowance: 0,
        da: 0,
        bonus: calculation.earnings.bonus,
        overtime: calculation.earnings.overtime,
        incentive: 0,
        reimbursements: calculation.earnings.reimbursements,
        totalEarnings: calculation.grossEarnings,
      },
      create: {
        payrollEntryId,
        organizationId: payrollEntry.employee.organizationId,
        basicSalary: calculation.earnings.basic,
        hra: calculation.earnings.hra,
        specialAllowance: 0,
        da: 0,
        bonus: calculation.earnings.bonus,
        overtime: calculation.earnings.overtime,
        incentive: 0,
        reimbursements: calculation.earnings.reimbursements,
        totalEarnings: calculation.grossEarnings,
      },
    });

    // Create deductions breakdown
    await this.prisma.payrollDeduction.upsert({
      where: { payrollEntryId },
      update: {
        pfEmployeeContribution: calculation.deductions.pfEmployee,
        pfEmployerContribution: calculation.deductions.pfEmployer,
        esiContribution: calculation.deductions.esi,
        professionalTax: calculation.deductions.professionalTax,
        tdsDeducted: monthlyTds,
        lossOfPay: calculation.deductions.lossOfPay,
        advanceRecovery: calculation.deductions.advance,
        otherDeductions: calculation.deductions.other,
        totalDeductions: calculation.totalDeductions,
      },
      create: {
        payrollEntryId,
        organizationId: payrollEntry.employee.organizationId,
        pfEmployeeContribution: calculation.deductions.pfEmployee,
        pfEmployerContribution: calculation.deductions.pfEmployer,
        esiContribution: calculation.deductions.esi,
        professionalTax: calculation.deductions.professionalTax,
        tdsDeducted: monthlyTds,
        lossOfPay: calculation.deductions.lossOfPay,
        advanceRecovery: calculation.deductions.advance,
        otherDeductions: calculation.deductions.other,
        totalDeductions: calculation.totalDeductions,
      },
    });

    return payslip;
  }

  /**
   * Get payslip in HTML format (can be rendered as PDF)
   */
  generatePayslipHTML(
    payslip: Prisma.PayslipGetPayload<object>,
    employee: Prisma.EmployeeGetPayload<object>,
  ): string {
    const month = new Date(payslip.year, payslip.month - 1).toLocaleString(
      'default',
      { month: 'long' },
    );

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .container { max-width: 900px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .title { font-size: 24px; font-weight: bold; }
    .subtitle { font-size: 12px; color: #666; }
    .section { margin-top: 20px; }
    .section-title { font-weight: bold; font-size: 14px; background: #f0f0f0; padding: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    .label { width: 50%; }
    .value { text-align: right; }
    .total-row { font-weight: bold; background: #f0f0f0; }
    .net-pay { font-size: 18px; font-weight: bold; color: #00aa00; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">PAYSLIP</div>
      <div class="subtitle">${month} ${payslip.year}</div>
    </div>

    <div class="section">
      <table>
        <tr>
          <td class="label">Employee Name:</td>
          <td>${employee.name}</td>
          <td class="label">Employee ID:</td>
          <td>${employee.id}</td>
        </tr>
        <tr>
          <td class="label">Designation:</td>
          <td>${employee.designation || '-'}</td>
          <td class="label">Department:</td>
          <td>${employee.department || '-'}</td>
        </tr>
        <tr>
          <td class="label">Working Days:</td>
          <td>${payslip.workingDays}</td>
          <td class="label">Present Days:</td>
          <td>${payslip.presentDays}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">EARNINGS</div>
      <table>
        <tr>
          <td class="label">Basic Salary</td>
          <td class="value">₹ ${payslip.basicSalary.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label">House Rent Allowance (HRA)</td>
          <td class="value">₹ ${payslip.hra.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label">Allowances</td>
          <td class="value">₹ ${payslip.allowances.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label">Bonus</td>
          <td class="value">₹ ${payslip.bonus?.toFixed(2) || '0.00'}</td>
        </tr>
        <tr>
          <td class="label">Overtime</td>
          <td class="value">₹ ${payslip.overtime?.toFixed(2) || '0.00'}</td>
        </tr>
        <tr>
          <td class="label">Reimbursements</td>
          <td class="value">₹ ${payslip.reimbursements?.toFixed(2) || '0.00'}</td>
        </tr>
        <tr class="total-row">
          <td class="label">Gross Earnings</td>
          <td class="value">₹ ${payslip.grossEarnings.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">DEDUCTIONS</div>
      <table>
        <tr>
          <td class="label">Provident Fund (PF) - Employee</td>
          <td class="value">₹ ${payslip.pfDeduction.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label">Employee State Insurance (ESI)</td>
          <td class="value">₹ ${payslip.esiDeduction.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label">Professional Tax</td>
          <td class="value">₹ ${payslip.professionalTax.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label">Tax Deducted at Source (TDS)</td>
          <td class="value">₹ ${payslip.tdsDeduction.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label">Late Mark Penalty</td>
          <td class="value">₹ ${payslip.lateMarkPenalty?.toFixed(2) || '0.00'}</td>
        </tr>
        <tr>
          <td class="label">Loss of Pay</td>
          <td class="value">₹ ${payslip.lossOfPay?.toFixed(2) || '0.00'}</td>
        </tr>
        <tr class="total-row">
          <td class="label">Total Deductions</td>
          <td class="value">₹ ${payslip.totalDeductions.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <table>
        <tr class="net-pay">
          <td class="label" style="font-size: 16px;">NET PAY</td>
          <td class="value" style="font-size: 16px;">₹ ${payslip.netPay.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div class="section" style="color: #666; font-size: 12px;">
      <p>This is a system-generated payslip. No signature is required.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Get attendance data for a specific month
   */
  private async getAttendanceData(
    employeeId: number,
    month: number,
    year: number,
    organizationId: number,
  ): Promise<{
    presentDays: number;
    absentDays: number;
    paidLeaves: number;
    unpaidLeaves: number;
    totalWorkingDays: number;
    lateCount: number;
    overtimeHours: number;
  }> {
    return getPayrollAttendanceMetrics(
      this.prisma,
      employeeId,
      month,
      year,
      organizationId,
    );
  }

  /**
   * Get payslip by ID
   */
  async getPayslip(id: number): Promise<
    Prisma.PayslipGetPayload<{
      include: {
        employee: true;
        payrollEntry: {
          include: {
            payrollCycle: true;
          };
        };
      };
    }>
  > {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id },
      include: {
        employee: true,
        payrollEntry: {
          include: {
            payrollCycle: true,
          },
        },
      },
    });

    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }

    return payslip;
  }

  /**
   * Get all payslips for an employee
   */
  async getEmployeePayslips(
    employeeId: number,
    year?: number,
  ): Promise<
    Prisma.PayslipGetPayload<{
      include: {
        employee: true;
        payrollEntry: {
          include: {
            payrollCycle: true;
          };
        };
      };
    }>[]
  > {
    const where: { employeeId: number; year?: number } = { employeeId };
    if (year) {
      where.year = year;
    }

    return this.prisma.payslip.findMany({
      where,
      include: {
        employee: true,
        payrollEntry: {
          include: {
            payrollCycle: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }
}
