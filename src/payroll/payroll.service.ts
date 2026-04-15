import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePayrollCycleDto } from './dto/create-payroll-cycle.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { CreateTaxDeclarationDto } from './dto/create-tax-declaration.dto';
import { MarkPayrollEntryPaidDto } from './dto/mark-payroll-entry-paid.dto';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayslipGenerationService } from './payslip-generation.service';
import { UpdateSalaryStructureDto } from './dto/update-salary-structure.dto';
import { DASHBOARD_CACHE_KEY } from '../common/utils/cache-keys';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationService: PayrollCalculationService,
    private readonly payslipService: PayslipGenerationService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async invalidateDashboardCache() {
    await this.cacheManager.del(DASHBOARD_CACHE_KEY);
  }

  private async getAttendanceMetricsForCycle(
    employeeId: number,
    month: number,
    year: number,
  ) {
    const prisma = this.prisma as any;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const [attendanceRows, leaveRows] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          employeeId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      }),
    ]);

    const presentDays = attendanceRows.filter((row: any) => row.status === 'PRESENT').length;
    const halfDays = attendanceRows.filter((row: any) => row.status === 'HALF_DAY').length;
    const absentDays = attendanceRows.filter((row: any) => row.status === 'ABSENT').length;
    const lateCount = attendanceRows.filter((row: any) => (row.lateMinutes || 0) > 0).length;
    const overtimeHours = Number(
      attendanceRows
        .reduce((sum: number, row: any) => sum + (row.overtimeHours || 0), 0)
        .toFixed(2),
    );

    const paidLeaves = leaveRows
      .filter((row: any) => (row.isPaid ?? true) === true)
      .reduce((sum: number, row: any) => {
        const from = new Date(Math.max(startDate.getTime(), new Date(row.startDate).getTime()));
        const to = new Date(Math.min(endDate.getTime(), new Date(row.endDate).getTime()));
        const days = Math.floor((to.getTime() - from.getTime()) / (24 * 3600 * 1000)) + 1;
        return sum + Math.max(0, days);
      }, 0);

    const unpaidLeaves = leaveRows
      .filter((row: any) => (row.isPaid ?? true) === false)
      .reduce((sum: number, row: any) => {
        const from = new Date(Math.max(startDate.getTime(), new Date(row.startDate).getTime()));
        const to = new Date(Math.min(endDate.getTime(), new Date(row.endDate).getTime()));
        const days = Math.floor((to.getTime() - from.getTime()) / (24 * 3600 * 1000)) + 1;
        return sum + Math.max(0, days);
      }, 0);

    const totalWorkingDays = 22;

    return {
      presentDays: presentDays + halfDays * 0.5,
      absentDays: absentDays + unpaidLeaves,
      paidLeaves,
      unpaidLeaves,
      totalWorkingDays,
      lateCount,
      overtimeHours,
    };
  }

  async createSalaryStructure(dto: CreateSalaryStructureDto) {
    const prisma = this.prisma as any;
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Deactivate previous active structures
    await prisma.salaryStructure.updateMany({
      where: { employeeId: dto.employeeId, isActive: true },
      data: { isActive: false },
    });

    const result = await prisma.salaryStructure.create({
      data: {
        employeeId: dto.employeeId,
        basic: dto.basic ?? 0,
        hra: dto.hra ?? 0,
        allowances: dto.allowances ?? 0,
        deductions: dto.deductions ?? 0,
        pf: dto.pf ?? 0,
        esi: dto.esi ?? 0,
        professionalTax: dto.professionalTax ?? 0,
        tds: dto.tds ?? 0,
      },
      include: { employee: true },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async updateSalaryStructure(
    employeeId: number,
    dto: UpdateSalaryStructureDto,
  ) {
    const prisma = this.prisma as any;

    const activeStructure = await prisma.salaryStructure.findFirst({
      where: { employeeId, isActive: true },
    });

    if (!activeStructure) {
      throw new NotFoundException('No active salary structure found');
    }

    // Deactivate old structure
    await prisma.salaryStructure.update({
      where: { id: activeStructure.id },
      data: { isActive: false },
    });

    // Create new structure with updated values
    const result = await prisma.salaryStructure.create({
      data: {
        employeeId,
        basic: dto.basic ?? activeStructure.basic,
        hra: dto.hra ?? activeStructure.hra,
        allowances: dto.allowances ?? activeStructure.allowances,
        deductions: dto.deductions ?? activeStructure.deductions,
        pf: dto.pf ?? activeStructure.pf,
        esi: dto.esi ?? activeStructure.esi,
        professionalTax:
          dto.professionalTax ?? activeStructure.professionalTax,
        tds: dto.tds ?? activeStructure.tds,
      },
      include: { employee: true },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async listSalaryStructures() {
    const prisma = this.prisma as any;
    return prisma.salaryStructure.findMany({
      include: { employee: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getSalaryStructureByEmployee(employeeId: number) {
    const prisma = this.prisma as any;

    const structure = await prisma.salaryStructure.findFirst({
      where: { employeeId, isActive: true },
      include: { employee: true },
    });

    if (!structure) {
      throw new NotFoundException(
        'No active salary structure found for this employee',
      );
    }

    return structure;
  }

  async createCycle(dto: CreatePayrollCycleDto) {
    const prisma = this.prisma as any;
    const result = await prisma.payrollCycle.create({
      data: {
        name: dto.name,
        month: dto.month,
        year: dto.year,
        notes: dto.notes,
      },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async listCycles() {
    const prisma = this.prisma as any;
    return prisma.payrollCycle.findMany({
      include: { _count: { select: { entries: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async runCycle(cycleId: number) {
    const prisma = this.prisma as any;
    const cycle = await prisma.payrollCycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle) {
      throw new NotFoundException('Payroll cycle not found');
    }

    const activeStructures = await prisma.salaryStructure.findMany({
      where: { isActive: true },
      include: { employee: true },
    });

    const results: Array<{
      employeeId: number;
      grossPay: number;
      totalDeductions: number;
      netPay: number;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      const txPrisma = tx as any;
      for (const structure of activeStructures) {
        const attendanceData = await this.getAttendanceMetricsForCycle(
          structure.employeeId,
          cycle.month,
          cycle.year,
        );

        const calculation = await this.calculationService.calculatePayroll({
          employeeId: structure.employeeId,
          month: cycle.month,
          year: cycle.year,
          salaryStructure: structure,
          attendanceData,
        });

        await txPrisma.payrollEntry.upsert({
          where: {
            payrollCycleId_employeeId: {
              payrollCycleId: cycle.id,
              employeeId: structure.employeeId,
            },
          },
          update: {
            grossPay: calculation.grossEarnings,
            totalDeductions: calculation.totalDeductions,
            netPay: calculation.netPay,
            totalPresentDays: attendanceData.presentDays,
            totalAbsentDays: attendanceData.absentDays,
            lateCount: attendanceData.lateCount,
            overtimeHours: attendanceData.overtimeHours,
            status: 'PENDING',
          },
          create: {
            payrollCycleId: cycle.id,
            employeeId: structure.employeeId,
            grossPay: calculation.grossEarnings,
            totalDeductions: calculation.totalDeductions,
            netPay: calculation.netPay,
            totalPresentDays: attendanceData.presentDays,
            totalAbsentDays: attendanceData.absentDays,
            lateCount: attendanceData.lateCount,
            overtimeHours: attendanceData.overtimeHours,
            status: 'PENDING',
          },
        });

        results.push({
          employeeId: structure.employeeId,
          grossPay: calculation.grossEarnings,
          totalDeductions: calculation.totalDeductions,
          netPay: calculation.netPay,
        });
      }

      await txPrisma.payrollCycle.update({
        where: { id: cycle.id },
        data: {
          status: 'RUN',
          runDate: new Date(),
        },
      });
    });

    const payload = {
      cycleId: cycle.id,
      generatedEntries: results.length,
      entries: results,
    };

    await this.invalidateDashboardCache();
    return payload;
  }

  async getCycleEntries(cycleId: number) {
    const prisma = this.prisma as any;
    return prisma.payrollEntry.findMany({
      where: { payrollCycleId: cycleId },
      include: {
        employee: true,
        payrollCycle: true,
      },
      orderBy: { employeeId: 'asc' },
    });
  }

  async markEntryPaid(entryId: number, dto: MarkPayrollEntryPaidDto) {
    const prisma = this.prisma as any;
    const entry = await prisma.payrollEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry) {
      throw new NotFoundException('Payroll entry not found');
    }

    const result = await prisma.payrollEntry.update({
      where: { id: entryId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  // Tax Declaration Management
  async createTaxDeclaration(dto: CreateTaxDeclarationDto) {
    const prisma = this.prisma as any;

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Deactivate previous declarations for the same year
    await prisma.taxDeclaration.updateMany({
      where: {
        employeeId: dto.employeeId,
        year: dto.year,
      },
      data: {
        approvalStatus: 'SUPERSEDED',
      },
    });

    const result = await prisma.taxDeclaration.create({
      data: {
        employeeId: dto.employeeId,
        year: dto.year,
        investment80C: dto.investment80C ?? 0,
        investment80D: dto.investment80D ?? 0,
        investment80CCD: dto.investment80CCD ?? 0,
        hraExemption: dto.hraExemption ?? 0,
        otherIncome: dto.otherIncome ?? 0,
        exerciseStock: dto.exerciseStock ?? 0,
      },
      include: { employee: true },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async getTaxDeclaration(employeeId: number, year: number) {
    const prisma = this.prisma as any;

    const declaration = await prisma.taxDeclaration.findFirst({
      where: {
        employeeId,
        year,
        approvalStatus: { in: ['PENDING', 'APPROVED'] },
      },
      include: { employee: true },
    });

    if (!declaration) {
      throw new NotFoundException(
        'No tax declaration found for this employee and year',
      );
    }

    return declaration;
  }

  async approveTaxDeclaration(declarationId: number, approvedBy: number) {
    const prisma = this.prisma as any;

    const result = await prisma.taxDeclaration.update({
      where: { id: declarationId },
      data: {
        approvalStatus: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  // Payslip Generation
  async generatePayslips(cycleId: number) {
    const prisma = this.prisma as any;

    const entries = await prisma.payrollEntry.findMany({
      where: { payrollCycleId: cycleId },
    });

    const results: any[] = [];
    for (const entry of entries) {
      const payslip = await this.payslipService.generatePayslip(entry.id);
      results.push(payslip);
    }

    await this.invalidateDashboardCache();
    return results;
  }

  async getPayslip(payslipId: number) {
    return this.payslipService.getPayslip(payslipId);
  }

  async getEmployeePayslips(employeeId: number, year?: number) {
    return this.payslipService.getEmployeePayslips(employeeId, year);
  }

  async downloadPayslip(payslipId: number) {
    const payslip = await this.payslipService.getPayslip(payslipId);
    const html = this.payslipService.generatePayslipHTML(
      payslip,
      payslip.employee,
    );
    return html;
  }

  // Form 16 Generation
  async generateForm16(employeeId: number, year: number) {
    const prisma = this.prisma as any;

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Get all payslips for the year
    const payslips = await prisma.payslip.findMany({
      where: {
        employeeId,
        year,
      },
    });

    if (!payslips || payslips.length === 0) {
      throw new NotFoundException(
        'No payslips found for this employee in the specified year',
      );
    }

    // Calculate totals
    const grossIncome = payslips.reduce(
      (sum, p) => sum + (p.grossEarnings || 0),
      0,
    );
    const totalTaxPaid = payslips.reduce(
      (sum, p) => sum + (p.tdsDeduction || 0),
      0,
    );

    const panNumber = (employee as any).pan ?? '';

    const form16Data = {
      panNumber,
      panHash: '0',
      addressLine1: '',
      addressLine2: '',
      pin: '',
      deducteeState: 'MAHARASHTRA',
      gross: grossIncome,
      standard: 75000,
      taxableIncome: Math.max(0, grossIncome - 75000),
      totalTax: totalTaxPaid,
      reliefU89: 0,
      totalDeduction: totalTaxPaid,
      surrenderedAt: '',
      lastUpdated: new Date().toISOString(),
      tfcCapital: 0,
      tfcSupQty: 0,
      tfcValues: [],
    };

    const form16 = await prisma.form16.upsert({
      where: {
        employeeId_year: {
          employeeId,
          year,
        },
      },
      update: {
        grossIncome,
        totalTaxPaid,
        tfcData: form16Data,
        generatedAt: new Date(),
      },
      create: {
        employeeId,
        year,
        grossIncome,
        totalTaxPaid,
        tfcData: form16Data,
        generatedAt: new Date(),
      },
      include: { employee: true },
    });

    await this.invalidateDashboardCache();
    return form16;
  }

  async getForm16(employeeId: number, year: number) {
    const prisma = this.prisma as any;

    const form16 = await prisma.form16.findUnique({
      where: {
        employeeId_year: {
          employeeId,
          year,
        },
      },
      include: { employee: true },
    });

    if (!form16) {
      throw new NotFoundException(
        'Form 16 not found for this employee and year',
      );
    }

    return form16;
  }
}
