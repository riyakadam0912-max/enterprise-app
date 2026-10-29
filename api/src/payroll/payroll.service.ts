import {
  ConflictException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePayrollCycleDto } from './dto/create-payroll-cycle.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { CreateTaxDeclarationDto } from './dto/create-tax-declaration.dto';
import { MarkPayrollEntryPaidDto } from './dto/mark-payroll-entry-paid.dto';
import {
  PayrollCalculationService,
  STANDARD_DEDUCTION_2024,
} from './payroll-calculation.service';
import { PayslipGenerationService } from './payslip-generation.service';
import { UpdateSalaryStructureDto } from './dto/update-salary-structure.dto';
import { UpdatePayslipDto } from './dto/update-payslip.dto';
import { DASHBOARD_CACHE_KEY } from '../common/utils/cache-keys';
import type { AuthUser } from '../common/types/auth';
import { Role } from '../common/enums/role.enum';
import { BusinessUnitsService } from '../business-units/business-units.service';
import { getPayrollAttendanceMetrics } from './payroll-attendance.utils';
import { CreateSalaryTemplateDto } from './dto/create-salary-template.dto';
import type { SalaryComponentDto } from './dto/salary-component.dto';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationService: PayrollCalculationService,
    private readonly payslipService: PayslipGenerationService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly businessUnitsService: BusinessUnitsService,
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

  private validateForm16Employee(employee: {
    pan?: string | null;
    address?: string | null;
  }) {
    const pan = employee.pan?.trim().toUpperCase();
    if (!pan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      throw new BadRequestException(
        'A valid PAN is required before generating Form 16',
      );
    }
    if (!employee.address?.trim()) {
      throw new BadRequestException(
        'Employee address is required before generating Form 16',
      );
    }
    return pan;
  }

  private resolveReadOrganization(user: AuthUser): number | null {
    if (
      !user.organizationId &&
      (user.isSuperAdmin || user.role === Role.SUPER_ADMIN)
    ) {
      return null;
    }
    return this.validateOrganization(user);
  }

  private async getAttendanceMetricsForCycle(
    employeeId: number,
    month: number,
    year: number,
    organizationId: number,
  ) {
    return getPayrollAttendanceMetrics(
      this.prisma,
      employeeId,
      month,
      year,
      organizationId,
    );
  }

  private normalizeComponents(components: SalaryComponentDto[]) {
    const seen = new Set<string>();
    return components.map((component, index) => {
      const code = component.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if (!code || seen.has(code)) {
        throw new BadRequestException(`Salary component code must be unique: ${code || 'blank'}`);
      }
      seen.add(code);
      const monthlyAmount = Number(component.monthlyAmount.toFixed(2));
      return {
        code,
        name: component.name.trim(),
        payslipName: (component.payslipName || component.name).trim(),
        category: component.category,
        calculationType: component.calculationType,
        calculationValue: component.calculationValue,
        monthlyAmount,
        annualAmount: Number((monthlyAmount * 12).toFixed(2)),
        taxable: component.taxable ?? component.category === 'EARNING',
        prorated: component.prorated ?? component.category === 'EARNING',
        includedInCtc: component.includedInCtc ?? true,
        showInPayslip: component.showInPayslip ?? true,
        isManualOverride: component.isManualOverride ?? false,
        displayOrder: index,
      };
    });
  }

  private validateCtc(annualCtc: number, components: ReturnType<PayrollService['normalizeComponents']>) {
    const allocated = components
      .filter((component) => component.includedInCtc && component.category !== 'DEDUCTION')
      .reduce((sum, component) => sum + component.annualAmount, 0);
    if (allocated > annualCtc + 0.01) {
      throw new BadRequestException(
        `Salary components exceed annual CTC by ${(allocated - annualCtc).toFixed(2)}`,
      );
    }
  }

  async createSalaryTemplate(dto: CreateSalaryTemplateDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const components = this.normalizeComponents(dto.components);
    this.validateCtc(dto.annualCtc, components);
    return this.prisma.salaryTemplate.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        annualCtc: dto.annualCtc,
        components: {
          create: components.map((component) => ({ organizationId, ...component })),
        },
      },
      include: { components: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async listSalaryTemplates(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.salaryTemplate.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      include: { components: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
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
    const scope = await this.businessUnitsService.resolveScope(user as any);
    const employeeBUWhere =
      this.businessUnitsService.buildEmployeeBUWhere(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, ...employeeBUWhere },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    const template = dto.templateId
      ? await this.prisma.salaryTemplate.findFirst({
          where: { id: dto.templateId, organizationId, deletedAt: null, isActive: true },
          include: { components: { orderBy: { displayOrder: 'asc' } } },
        })
      : null;
    if (dto.templateId && !template) {
      throw new NotFoundException('Salary template not found');
    }
    const sourceComponents: ReturnType<PayrollService['normalizeComponents']> = dto.components?.length
      ? this.normalizeComponents(dto.components)
      : (template?.components.map(({ id: _id, templateId: _templateId, organizationId: _organizationId, createdAt: _createdAt, updatedAt: _updatedAt, ...component }) => component) ?? []) as ReturnType<PayrollService['normalizeComponents']>;
    const annualCtc = dto.annualCtc ?? template?.annualCtc ??
      ((dto.basic ?? 0) + (dto.hra ?? 0) + (dto.allowances ?? 0)) * 12;
    if (sourceComponents.length) this.validateCtc(annualCtc, sourceComponents);
    const findAmount = (code: string) =>
      sourceComponents.find((component) => component.code === code)?.monthlyAmount;
    const findManualAmount = (code: string) =>
      sourceComponents.find(
        (component) => component.code === code && component.isManualOverride,
      )?.monthlyAmount;
    const otherEarnings = sourceComponents
      .filter((component) => component.category === 'EARNING' && !['BASIC', 'HRA'].includes(component.code))
      .reduce((sum, component) => sum + component.monthlyAmount, 0);

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
        templateId: template?.id,
        employeeId: dto.employeeId,
        annualCtc,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        basic: findAmount('BASIC') ?? dto.basic ?? 0,
        hra: findAmount('HRA') ?? dto.hra ?? 0,
        allowances: sourceComponents.length ? otherEarnings : dto.allowances ?? 0,
        deductions: dto.deductions ?? 0,
        pf: dto.pf ?? 0,
        esi: dto.esi ?? 0,
        professionalTax: dto.professionalTax ?? 0,
        tds: dto.tds ?? 0,
        manualPf: dto.manualPf ?? findManualAmount('PF'),
        manualEsi: dto.manualEsi ?? findManualAmount('ESI'),
        manualProfessionalTax:
          dto.manualProfessionalTax ?? findManualAmount('PROFESSIONAL_TAX'),
        manualTds: dto.manualTds ?? findManualAmount('TDS'),
        manualOtherDeductions:
          dto.manualOtherDeductions ?? findManualAmount('OTHER_DEDUCTION'),
        components: sourceComponents.length
          ? { create: sourceComponents.map((component) => ({ organizationId, ...component })) }
          : undefined,
      },
      include: { employee: true, components: { orderBy: { displayOrder: 'asc' } }, template: true },
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
    const scope = await this.businessUnitsService.resolveScope(user as any);
    const employeeBUWhere =
      this.businessUnitsService.buildEmployeeBUWhere(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, ...employeeBUWhere },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found in authorized BU scope');
    }
    let buStructureWhere: Prisma.SalaryStructureWhereInput = {};
    if (!scope.allUnits) {
      buStructureWhere = {
        employee: { businessUnitId: { in: scope.unitIds } },
      };
    }
    const activeStructure = await this.prisma.salaryStructure.findFirst({
      where: {
        employeeId,
        isActive: true,
        deletedAt: null,
        organizationId,
        ...buStructureWhere,
      },
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
      include: { employee: true, components: { orderBy: { displayOrder: 'asc' } }, template: true },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async listSalaryStructures(user: AuthUser): Promise<
    Prisma.SalaryStructureGetPayload<{
      include: { employee: true };
    }>[]
  > {
    const organizationId = this.resolveReadOrganization(user);
    const scope = await this.businessUnitsService.resolveScope(user as any);
    let buWhere: Prisma.SalaryStructureWhereInput = {};
    if (!scope.allUnits) {
      buWhere = {
        employee: { businessUnitId: { in: scope.unitIds } },
      };
    }
    return this.prisma.salaryStructure.findMany({
      where: {
        deletedAt: null,
        ...(organizationId == null ? {} : { organizationId }),
        ...buWhere,
      },
      include: {
        employee: true,
        template: true,
        components: { orderBy: { displayOrder: 'asc' } },
      },
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
    const organizationId = this.resolveReadOrganization(user);
    const scope = await this.businessUnitsService.resolveScope(user as any);
    let buWhere: Prisma.SalaryStructureWhereInput = {};
    if (!scope.allUnits) {
      buWhere = {
        employee: { businessUnitId: { in: scope.unitIds } },
      };
    }
    const structure = await this.prisma.salaryStructure.findFirst({
      where: {
        employeeId,
        isActive: true,
        deletedAt: null,
        ...(organizationId == null ? {} : { organizationId }),
        ...buWhere,
      },
      include: {
        employee: true,
        template: true,
        components: { orderBy: { displayOrder: 'asc' } },
      },
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
    const organizationId = this.resolveReadOrganization(user);
    return this.prisma.payrollCycle.findMany({
      where: {
        deletedAt: null,
        ...(organizationId == null ? {} : { organizationId }),
      },
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
    if (cycle.status === 'FINALIZED') {
      throw new ConflictException('Finalized payroll cycles cannot be rerun');
    }
    const paidEntry = await this.prisma.payrollEntry.findFirst({
      where: {
        payrollCycleId: cycle.id,
        organizationId,
        deletedAt: null,
        status: 'PAID',
      },
      select: { id: true },
    });
    if (paidEntry) {
      throw new ConflictException(
        'Payroll cycles with paid entries cannot be rerun',
      );
    }

    const scope = await this.businessUnitsService.resolveScope(user as any);
    let buStructureWhere: Prisma.SalaryStructureWhereInput = {};
    if (!scope.allUnits) {
      buStructureWhere = {
        employee: { businessUnitId: { in: scope.unitIds } },
      };
    }
    const activeStructures = await this.prisma.salaryStructure.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        organizationId,
        ...buStructureWhere,
      },
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

  async finalizeCycle(cycleId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const cycle = await this.prisma.payrollCycle.findFirst({
      where: { id: cycleId, deletedAt: null, organizationId },
      include: { entries: { where: { deletedAt: null }, select: { status: true } } },
    });
    if (!cycle) {
      throw new NotFoundException('Payroll cycle not found');
    }
    if (cycle.status === 'FINALIZED') {
      return cycle;
    }
    if (
      cycle.entries.length === 0 ||
      cycle.entries.some((entry) => entry.status !== 'PAID')
    ) {
      throw new ConflictException(
        'All payroll entries must be paid before finalizing the cycle',
      );
    }
    const result = await this.prisma.payrollCycle.update({
      where: { id: cycleId, organizationId },
      data: { status: 'FINALIZED' },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.userId,
        userRole: user.role,
        module: 'PAYROLL',
        entityType: 'PayrollCycle',
        entityId: cycleId,
        action: 'FINALIZE_PAYROLL_CYCLE',
        fieldName: 'status',
        oldValue: { status: cycle.status },
        newValue: { status: 'FINALIZED' },
        description: `Finalized payroll cycle ${cycleId}`,
        status: 'SUCCESS',
        organizationId,
      },
    });
    await this.invalidateDashboardCache();
    return result;
  }

  async getCycleEntries(
    cycleId: number,
    user: AuthUser,
  ): Promise<
    Prisma.PayrollEntryGetPayload<{
      include: { employee: true; payrollCycle: true };
    }>[]
  > {
    const organizationId = this.resolveReadOrganization(user);
    const scope = await this.businessUnitsService.resolveScope(user as any);
    let buEntryWhere: Prisma.PayrollEntryWhereInput = {};
    if (!scope.allUnits) {
      buEntryWhere = { employee: { businessUnitId: { in: scope.unitIds } } };
    }
    return this.prisma.payrollEntry.findMany({
      where: {
        payrollCycleId: cycleId,
        deletedAt: null,
        ...(organizationId == null ? {} : { organizationId }),
        ...buEntryWhere,
      },
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
    const scope = await this.businessUnitsService.resolveScope(user as any);
    let buEntryWhere: Prisma.PayrollEntryWhereInput = {};
    if (!scope.allUnits) {
      buEntryWhere = { employee: { businessUnitId: { in: scope.unitIds } } };
    }
    const entry = await this.prisma.payrollEntry.findFirst({
      where: { id: entryId, deletedAt: null, organizationId, ...buEntryWhere },
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
    if (user.role === Role.EMPLOYEE && user.employeeId !== dto.employeeId) {
      throw new ForbiddenException(
        'Employees can only submit their own tax declaration',
      );
    }
    const scope = await this.businessUnitsService.resolveScope(user as any);
    const employeeBUWhere =
      this.businessUnitsService.buildEmployeeBUWhere(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, ...employeeBUWhere },
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
    if (user.role === Role.EMPLOYEE && user.employeeId !== employeeId) {
      throw new ForbiddenException(
        'Employees can only view their own tax declaration',
      );
    }
    const scope = await this.businessUnitsService.resolveScope(user as any);
    let buDeclWhere: Prisma.TaxDeclarationWhereInput = {};
    if (!scope.allUnits) {
      buDeclWhere = { employee: { businessUnitId: { in: scope.unitIds } } };
    }
    const declaration = await this.prisma.taxDeclaration.findFirst({
      where: {
        deletedAt: null,
        employeeId,
        year,
        organizationId,
        approvalStatus: { in: ['PENDING', 'APPROVED'] },
        ...buDeclWhere,
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
    const scope = await this.businessUnitsService.resolveScope(user as any);
    let buDeclWhere: Prisma.TaxDeclarationWhereInput = {};
    if (!scope.allUnits) {
      buDeclWhere = { employee: { businessUnitId: { in: scope.unitIds } } };
    }
    const scopedDecl = await this.prisma.taxDeclaration.findFirst({
      where: { id: declarationId, organizationId, ...buDeclWhere },
    });
    if (!scopedDecl) {
      throw new NotFoundException('Tax declaration not found');
    }
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
    const scope = await this.businessUnitsService.resolveScope(user as any);
    let buEntryWhere: Prisma.PayrollEntryWhereInput = {};
    if (!scope.allUnits) {
      buEntryWhere = { employee: { businessUnitId: { in: scope.unitIds } } };
    }
    const entries = await this.prisma.payrollEntry.findMany({
      where: {
        payrollCycleId: cycleId,
        deletedAt: null,
        organizationId,
        ...buEntryWhere,
      },
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
    const scope = await this.businessUnitsService.resolveScope(user as any);
    let buPayslipWhere: Prisma.PayslipWhereInput = {};
    if (!scope.allUnits) {
      buPayslipWhere = { employee: { businessUnitId: { in: scope.unitIds } } };
    }
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, organizationId, ...buPayslipWhere },
    });
    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }
    return payslip;
  }

  async updatePayslip(
    payslipId: number,
    dto: UpdatePayslipDto,
    user: AuthUser,
  ) {
    const current = await this.getPayslip(payslipId, user);
    const payrollEntry = await this.prisma.payrollEntry.findFirst({
      where: {
        id: current.payrollEntryId,
        organizationId: this.validateOrganization(user),
      },
      select: { status: true },
    });
    if (payrollEntry?.status === 'PAID') {
      throw new ConflictException('Paid payslips cannot be edited');
    }
    const earnings = {
      basicSalary: dto.basicSalary ?? current.basicSalary,
      hra: dto.hra ?? current.hra,
      allowances: dto.allowances ?? current.allowances,
      bonus: dto.bonus ?? current.bonus,
      overtime: dto.overtime ?? current.overtime,
      reimbursements: dto.reimbursements ?? current.reimbursements,
    };
    const deductions = {
      pfDeduction: dto.pfDeduction ?? current.pfDeduction,
      esiDeduction: dto.esiDeduction ?? current.esiDeduction,
      professionalTax: dto.professionalTax ?? current.professionalTax,
      tdsDeduction: dto.tdsDeduction ?? current.tdsDeduction,
      lossOfPay: dto.lossOfPay ?? current.lossOfPay,
      otherDeductions: dto.otherDeductions ?? current.otherDeductions,
    };
    const grossEarnings = Object.values(earnings).reduce(
      (sum, value) => sum + value,
      0,
    );
    const totalDeductions = Object.values(deductions).reduce(
      (sum, value) => sum + value,
      0,
    );
    return this.prisma.payslip.update({
      where: { id: payslipId },
      data: {
        ...(dto.month !== undefined && { month: dto.month }),
        ...(dto.year !== undefined && { year: dto.year }),
        ...earnings,
        ...deductions,
        grossEarnings,
        totalDeductions,
        netPay: grossEarnings - totalDeductions,
      },
    });
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
    const scope = await this.businessUnitsService.resolveScope(user as any);
    const employeeBUWhere =
      this.businessUnitsService.buildEmployeeBUWhere(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, ...employeeBUWhere },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found in authorized BU scope');
    }
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
    const scope = await this.businessUnitsService.resolveScope(user as any);
    let buPayslipWhere: Prisma.PayslipWhereInput = {};
    if (!scope.allUnits) {
      buPayslipWhere = { employee: { businessUnitId: { in: scope.unitIds } } };
    }
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, organizationId, ...buPayslipWhere },
    });
    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }
    const employeeBUWhere =
      this.businessUnitsService.buildEmployeeBUWhere(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: payslip.employeeId, ...employeeBUWhere },
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
    const scope = await this.businessUnitsService.resolveScope(user as any);
    const employeeBUWhere =
      this.businessUnitsService.buildEmployeeBUWhere(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, ...employeeBUWhere },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    const panNumber = this.validateForm16Employee(employee);

    let buPayslipWhere: Prisma.PayslipWhereInput = {};
    if (!scope.allUnits) {
      buPayslipWhere = { employee: { businessUnitId: { in: scope.unitIds } } };
    }
    // Get all payslips for the year
    const payslips = await this.prisma.payslip.findMany({
      where: {
        deletedAt: null,
        employeeId,
        year,
        organizationId,
        ...buPayslipWhere,
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

    const standardDeduction = STANDARD_DEDUCTION_2024;

    const form16Data = {
      panNumber,
      panHash: panNumber
        ? createHash('sha256').update(panNumber).digest('hex')
        : null,
      addressLine1: employee.address ?? '',
      addressLine2: '',
      pin: '',
      deducteeState: null,
      gross: grossIncome,
      standard: standardDeduction,
      taxableIncome: Math.max(0, grossIncome - standardDeduction),
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
    const scope = await this.businessUnitsService.resolveScope(user as any);
    let buForm16Where: Prisma.Form16WhereInput = {};
    if (!scope.allUnits) {
      buForm16Where = { employee: { businessUnitId: { in: scope.unitIds } } };
    }
    const form16 = await this.prisma.form16.findFirst({
      where: {
        employeeId,
        year,
        organizationId,
        ...buForm16Where,
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
