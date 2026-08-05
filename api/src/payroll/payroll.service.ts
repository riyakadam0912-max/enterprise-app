import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePayrollCycleDto } from './dto/create-payroll-cycle.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { CreateTaxDeclarationDto } from './dto/create-tax-declaration.dto';
import { MarkPayrollEntryPaidDto } from './dto/mark-payroll-entry-paid.dto';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayslipGenerationService } from './payslip-generation.service';
import { UpdateSalaryStructureDto } from './dto/update-salary-structure.dto';
import { DASHBOARD_CACHE_KEY } from '../common/utils/cache-keys';
import type { AuthUser } from '../common/types/auth';

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

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private async getAttendanceMetricsForCycle(
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
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const [attendanceRows, leaveRows] = await Promise.all([
      this.prisma.attendance.findMany({
        where: {
          deletedAt: null,
          employeeId,
          organizationId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          deletedAt: null,
          employeeId,
          organizationId,
          status: 'APPROVED',
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      }),
    ]);

    const presentDays = attendanceRows.filter(
      (row) => row.status === 'PRESENT',
    ).length;
    const halfDays = attendanceRows.filter(
      (row) => row.status === 'HALF_DAY',
    ).length;
    const absentDays = attendanceRows.filter(
      (row) => row.status === 'ABSENT',
    ).length;
    const lateCount = attendanceRows.filter(
      (row) => (row.lateMinutes || 0) > 0,
    ).length;
    const overtimeHours = Number(
      attendanceRows
        .reduce((sum: number, row) => sum + (row.overtimeHours || 0), 0)
        .toFixed(2),
    );

    const paidLeaves = leaveRows
      .filter((row) => (row.isPaid ?? true) === true)
      .reduce((sum: number, row) => {
        const from = new Date(
          Math.max(startDate.getTime(), new Date(row.startDate).getTime()),
        );
        const to = new Date(
          Math.min(endDate.getTime(), new Date(row.endDate).getTime()),
        );
        const days =
          Math.floor((to.getTime() - from.getTime()) / (24 * 3600 * 1000)) + 1;
        return sum + Math.max(0, days);
      }, 0);

    const unpaidLeaves = leaveRows
      .filter((row) => (row.isPaid ?? true) === false)
      .reduce((sum: number, row) => {
        const from = new Date(
          Math.max(startDate.getTime(), new Date(row.startDate).getTime()),
        );
        const to = new Date(
          Math.min(endDate.getTime(), new Date(row.endDate).getTime()),
        );
        const days =
          Math.floor((to.getTime() - from.getTime()) / (24 * 3600 * 1000)) + 1;
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

  async createSalaryStructure(
    dto: CreateSalaryStructureDto,
    user: AuthUser,
  ): Promise<
    Prisma.SalaryStructureGetPayload<{
      include: { employee: true };
    }>
  > {
    const organizationId = this.validateOrganization(user);
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null, organizationId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Deactivate previous active structures
    await this.prisma.salaryStructure.updateMany({
      where: {
        employeeId: dto.employeeId,
        isActive: true,
        deletedAt: null,
        organizationId,
      },
      data: { isActive: false },
    });

    const result = await this.prisma.salaryStructure.create({
      data: {
        organizationId,
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
    user: AuthUser,
  ): Promise<
    Prisma.SalaryStructureGetPayload<{
      include: { employee: true };
    }>
  > {
    const organizationId = this.validateOrganization(user);
    const activeStructure = await this.prisma.salaryStructure.findFirst({
      where: { employeeId, isActive: true, deletedAt: null, organizationId },
    });

    if (!activeStructure) {
      throw new NotFoundException('No active salary structure found');
    }

    // Deactivate old structure
    await this.prisma.salaryStructure.update({
      where: { id: activeStructure.id, organizationId },
      data: { isActive: false },
    });

    // Create new structure with updated values
    const result = await this.prisma.salaryStructure.create({
      data: {
        organizationId,
        employeeId,
        basic: dto.basic ?? activeStructure.basic,
        hra: dto.hra ?? activeStructure.hra,
        allowances: dto.allowances ?? activeStructure.allowances,
        deductions: dto.deductions ?? activeStructure.deductions,
        pf: dto.pf ?? activeStructure.pf,
        esi: dto.esi ?? activeStructure.esi,
        professionalTax: dto.professionalTax ?? activeStructure.professionalTax,
        tds: dto.tds ?? activeStructure.tds,
      },
      include: { employee: true },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async listSalaryStructures(user: AuthUser): Promise<
    Prisma.SalaryStructureGetPayload<{
      include: { employee: true };
    }>[]
  > {
    const organizationId = this.validateOrganization(user);
    return this.prisma.salaryStructure.findMany({
      where: { deletedAt: null, organizationId },
      include: { employee: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getSalaryStructureByEmployee(
    employeeId: number,
    user: AuthUser,
  ): Promise<
    Prisma.SalaryStructureGetPayload<{
      include: { employee: true };
    }>
  > {
    const organizationId = this.validateOrganization(user);
    const structure = await this.prisma.salaryStructure.findFirst({
      where: { employeeId, isActive: true, deletedAt: null, organizationId },
      include: { employee: true },
    });

    if (!structure) {
      throw new NotFoundException(
        'No active salary structure found for this employee',
      );
    }

    return structure;
  }

  async createCycle(
    dto: CreatePayrollCycleDto,
    user: AuthUser,
  ): Promise<Prisma.PayrollCycleGetPayload<object>> {
    const organizationId = this.validateOrganization(user);

    const existingCycle = await this.prisma.payrollCycle.findFirst({
      where: {
        deletedAt: null,
        organizationId,
        month: dto.month,
        year: dto.year,
      },
      select: { id: true },
    });

    if (existingCycle) {
      throw new ConflictException(
        `Payroll cycle for ${dto.month}/${dto.year} already exists`,
      );
    }

    const result = await this.prisma.payrollCycle.create({
      data: {
        organizationId,
        name: dto.name,
        month: dto.month,
        year: dto.year,
        notes: dto.notes,
      },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async listCycles(user: AuthUser): Promise<
    Prisma.PayrollCycleGetPayload<{
      include: { _count: { select: { entries: true } } };
    }>[]
  > {
    const organizationId = this.validateOrganization(user);
    return this.prisma.payrollCycle.findMany({
      where: { deletedAt: null, organizationId },
      include: { _count: { select: { entries: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async runCycle(
    cycleId: number,
    user: AuthUser,
  ): Promise<{
    cycleId: number;
    generatedEntries: number;
    entries: Array<{
      employeeId: number;
      grossPay: number;
      totalDeductions: number;
      netPay: number;
    }>;
  }> {
    const organizationId = this.validateOrganization(user);
    const cycle = await this.prisma.payrollCycle.findFirst({
      where: { id: cycleId, deletedAt: null, organizationId },
    });
    if (!cycle) {
      throw new NotFoundException('Payroll cycle not found');
    }

    const activeStructures = await this.prisma.salaryStructure.findMany({
      where: { isActive: true, deletedAt: null, organizationId },
      include: { employee: true },
    });

    const results: Array<{
      employeeId: number;
      grossPay: number;
      totalDeductions: number;
      netPay: number;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      const txPrisma = tx;
      for (const structure of activeStructures) {
        const attendanceData = await this.getAttendanceMetricsForCycle(
          structure.employeeId,
          cycle.month,
          cycle.year,
          organizationId,
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
            organizationId,
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
        where: { id: cycle.id, organizationId },
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

  async getCycleEntries(
    cycleId: number,
    user: AuthUser,
  ): Promise<
    Prisma.PayrollEntryGetPayload<{
      include: { employee: true; payrollCycle: true };
    }>[]
  > {
    const organizationId = this.validateOrganization(user);
    return this.prisma.payrollEntry.findMany({
      where: { payrollCycleId: cycleId, deletedAt: null, organizationId },
      include: {
        employee: true,
        payrollCycle: true,
      },
      orderBy: { employeeId: 'asc' },
    });
  }

  async markEntryPaid(
    entryId: number,
    dto: MarkPayrollEntryPaidDto,
    user: AuthUser,
  ): Promise<Prisma.PayrollEntryGetPayload<object>> {
    const organizationId = this.validateOrganization(user);
    const entry = await this.prisma.payrollEntry.findFirst({
      where: { id: entryId, deletedAt: null, organizationId },
    });
    if (!entry) {
      throw new NotFoundException('Payroll entry not found');
    }

    const result = await this.prisma.payrollEntry.update({
      where: { id: entryId, organizationId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  // Tax Declaration Management
  async createTaxDeclaration(
    dto: CreateTaxDeclarationDto,
    user: AuthUser,
  ): Promise<
    Prisma.TaxDeclarationGetPayload<{
      include: { employee: true };
    }>
  > {
    const organizationId = this.validateOrganization(user);
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null, organizationId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Deactivate previous declarations for the same year
    await this.prisma.taxDeclaration.updateMany({
      where: {
        employeeId: dto.employeeId,
        year: dto.year,
        organizationId,
      },
      data: {
        approvalStatus: 'SUPERSEDED',
      },
    });

    const result = await this.prisma.taxDeclaration.create({
      data: {
        organizationId,
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

  async getTaxDeclaration(
    employeeId: number,
    year: number,
    user: AuthUser,
  ): Promise<
    Prisma.TaxDeclarationGetPayload<{
      include: { employee: true };
    }>
  > {
    const organizationId = this.validateOrganization(user);
    const declaration = await this.prisma.taxDeclaration.findFirst({
      where: {
        deletedAt: null,
        employeeId,
        year,
        organizationId,
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

  async approveTaxDeclaration(
    declarationId: number,
    approvedBy: number,
    user: AuthUser,
  ): Promise<Prisma.TaxDeclarationGetPayload<object>> {
    const organizationId = this.validateOrganization(user);
    const result = await this.prisma.taxDeclaration.update({
      where: { id: declarationId, organizationId },
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
  async generatePayslips(cycleId: number, user: AuthUser): Promise<unknown[]> {
    const organizationId = this.validateOrganization(user);
    const entries = await this.prisma.payrollEntry.findMany({
      where: { payrollCycleId: cycleId, deletedAt: null, organizationId },
    });

    const results: unknown[] = [];
    for (const entry of entries) {
      const payslip = await this.payslipService.generatePayslip(entry.id);
      results.push(payslip);
    }

    await this.invalidateDashboardCache();
    return results;
  }

  async getPayslip(
    payslipId: number,
    user: AuthUser,
  ): Promise<Prisma.PayslipGetPayload<object>> {
    const organizationId = this.validateOrganization(user);
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, organizationId },
    });
    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }
    return payslip;
  }

  async getEmployeePayslips(
    employeeId: number,
    user: AuthUser,
    year?: number,
  ): Promise<
    Prisma.PayslipGetPayload<{
      include: { payrollEntry: true };
    }>[]
  > {
    const organizationId = this.validateOrganization(user);
    return this.prisma.payslip.findMany({
      where: {
        employeeId,
        organizationId,
        ...(year ? { year } : {}),
      },
      include: { payrollEntry: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async downloadPayslip(payslipId: number, user: AuthUser): Promise<string> {
    const organizationId = this.validateOrganization(user);
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, organizationId },
    });
    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: payslip.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    const html = this.payslipService.generatePayslipHTML(payslip, employee);
    return html;
  }

  // Form 16 Generation
  async generateForm16(
    employeeId: number,
    year: number,
    user: AuthUser,
  ): Promise<
    Prisma.Form16GetPayload<{
      include: { employee: true };
    }>
  > {
    const organizationId = this.validateOrganization(user);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null, organizationId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Get all payslips for the year
    const payslips = await this.prisma.payslip.findMany({
      where: {
        deletedAt: null,
        employeeId,
        year,
        organizationId,
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

    const panNumber = employee.pan ?? '';

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

    const existingForm16 = await this.prisma.form16.findFirst({
      where: {
        employeeId,
        year,
        organizationId,
      },
      select: { id: true },
    });

    const form16 = existingForm16
      ? await this.prisma.form16.update({
          where: { id: existingForm16.id },
          data: {
            organizationId,
            grossIncome,
            totalTaxPaid,
            tfcData: form16Data,
            generatedAt: new Date(),
          },
          include: { employee: true },
        })
      : await this.prisma.form16.create({
          data: {
            organizationId,
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

  async getForm16(
    employeeId: number,
    year: number,
    user: AuthUser,
  ): Promise<
    Prisma.Form16GetPayload<{
      include: { employee: true };
    }>
  > {
    const organizationId = this.validateOrganization(user);
    const form16 = await this.prisma.form16.findFirst({
      where: {
        employeeId,
        year,
        organizationId,
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
