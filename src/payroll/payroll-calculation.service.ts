import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface TaxSlab {
  minIncome: number;
  maxIncome: number;
  rate: number;
  baseAmount: number;
}

interface PayrollCalculationInput {
  employeeId: number;
  month: number;
  year: number;
  salaryStructure: any;
  attendanceData?: {
    presentDays: number;
    absentDays: number;
    paidLeaves: number;
    unpaidLeaves: number;
    totalWorkingDays: number;
    lateCount?: number;
    overtimeHours?: number;
  };
  reimbursements?: number;
  bonus?: number;
}

interface PayrollCalculationResult {
  grossEarnings: number;
  earnings: {
    basic: number;
    hra: number;
    allowances: number;
    bonus: number;
    overtime: number;
    reimbursements: number;
  };
  deductions: {
    pfEmployee: number;
    pfEmployer: number;
    esi: number;
    professionalTax: number;
    tds: number;
    lossOfPay: number;
    latePenalty: number;
    advance: number;
  };
  totalDeductions: number;
  netPay: number;
  taxableIncome: number;
}

@Injectable()
export class PayrollCalculationService {
  // New Tax Regime Slabs for FY 2024-25 (Income up to 15 lakhs)
  private readonly newTaxRegimeSlabs: TaxSlab[] = [
    { minIncome: 0, maxIncome: 300000, rate: 0, baseAmount: 0 },
    { minIncome: 300000, maxIncome: 600000, rate: 0.05, baseAmount: 0 },
    { minIncome: 600000, maxIncome: 900000, rate: 0.1, baseAmount: 15000 },
    { minIncome: 900000, maxIncome: 1200000, rate: 0.15, baseAmount: 45000 },
    { minIncome: 1200000, maxIncome: 1500000, rate: 0.2, baseAmount: 90000 },
    { minIncome: 1500000, maxIncome: Infinity, rate: 0.3, baseAmount: 180000 },
  ];

  // Old Tax Regime Slabs for FY 2024-25
  private readonly oldTaxRegimeSlabs: TaxSlab[] = [
    { minIncome: 0, maxIncome: 250000, rate: 0, baseAmount: 0 },
    { minIncome: 250000, maxIncome: 500000, rate: 0.05, baseAmount: 0 },
    { minIncome: 500000, maxIncome: 1000000, rate: 0.2, baseAmount: 12500 },
    { minIncome: 1000000, maxIncome: Infinity, rate: 0.3, baseAmount: 112500 },
  ];

  // PT Slabs for Maharashtra (example - should be configurable by state)
  private readonly ptSlabs: TaxSlab[] = [
    { minIncome: 0, maxIncome: 100000, rate: 0, baseAmount: 0 },
    { minIncome: 100000, maxIncome: 150000, rate: 0.0075, baseAmount: 0 },
    { minIncome: 150000, maxIncome: 250000, rate: 0.015, baseAmount: 375 },
    { minIncome: 250000, maxIncome: Infinity, rate: 0.02, baseAmount: 1875 },
  ];

  private readonly config = {
    pfEmployeeRate: 0.12,
    pfEmployerRate: 0.12,
    esiRate: 0.0075,
    esiSalaryLimit: 21000,
    standardDeduction2024: 75000,
    defaultLossOfPayRate: 0.5,
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate full payroll for an employee
   */
  async calculatePayroll(input: PayrollCalculationInput): Promise<PayrollCalculationResult> {
    const {
      salaryStructure,
      attendanceData = {
        presentDays: 22,
        absentDays: 0,
        paidLeaves: 0,
        unpaidLeaves: 0,
        totalWorkingDays: 22,
        lateCount: 0,
        overtimeHours: 0,
      },
      reimbursements = 0,
      bonus = 0,
    } = input;

    // Calculate earnings
    const earnings = this.calculateEarnings(
      salaryStructure,
      attendanceData,
      reimbursements,
      bonus,
    );

    // Calculate deductions
    const deductions = this.calculateDeductions(
      salaryStructure,
      earnings.total,
      attendanceData,
    );

    const totalDeductions = Object.values(deductions).reduce((a: number, b: number) => (a as number) + (b as number), 0);
    const netPay = earnings.total - totalDeductions;
    const taxableIncome = this.calculateTaxableIncome(earnings.total, deductions);

    return {
      grossEarnings: earnings.total,
      earnings: earnings.breakdown,
      deductions,
      totalDeductions,
      netPay: Math.max(0, netPay),
      taxableIncome,
    };
  }

  /**
   * Calculate gross earnings based on salary structure and attendance
   */
  private calculateEarnings(
    salaryStructure: any,
    attendanceData: any,
    reimbursements: number,
    bonus: number,
  ) {
    const prorataFactor = attendanceData.presentDays / attendanceData.totalWorkingDays;

    const basic = (salaryStructure.basic || 0) * prorataFactor;
    const hra = (salaryStructure.hra || 0) * prorataFactor;
    const allowances = (salaryStructure.allowances || 0) * prorataFactor;
    const overtimeHours = attendanceData.overtimeHours || 0;
    const overtimeRatePerHour =
      salaryStructure.overtimeRatePerHour ||
      ((salaryStructure.basic || 0) / 30) / 8;
    const overtime = overtimeHours * overtimeRatePerHour;

    const totalEarnings = basic + hra + allowances + overtime + reimbursements + bonus;

    return {
      total: totalEarnings,
      breakdown: {
        basic: Math.round(basic * 100) / 100,
        hra: Math.round(hra * 100) / 100,
        allowances: Math.round(allowances * 100) / 100,
        bonus: bonus,
        overtime: overtime,
        reimbursements: reimbursements,
      },
    };
  }

  /**
   * Calculate all deductions
   */
  private calculateDeductions(
    salaryStructure: any,
    grossEarnings: number,
    attendanceData: any,
  ) {
    const pfEmployee = this.calculatePF(salaryStructure.basic || 0, true);
    const pfEmployer = this.calculatePF(salaryStructure.basic || 0, false);
    const esi = this.calculateESI(grossEarnings);
    const professionalTax = this.calculateProfessionalTax(grossEarnings);
    const lossOfPay = this.calculateLossOfPay(
      salaryStructure.basic || 0,
      attendanceData.absentDays,
    );
    const latePenalty = this.calculateLatePenalty(
      salaryStructure,
      attendanceData.lateCount || 0,
    );

    // TDS is calculated monthly based on annual tax projection
    const tds = (salaryStructure.tds || 0) / 12;

    return {
      pfEmployee: Math.round(pfEmployee * 100) / 100,
      pfEmployer: Math.round(pfEmployer * 100) / 100,
      esi: Math.round(esi * 100) / 100,
      professionalTax: Math.round(professionalTax * 100) / 100,
      tds: Math.round(tds * 100) / 100,
      lossOfPay: Math.round(lossOfPay * 100) / 100,
      latePenalty: Math.round(latePenalty * 100) / 100,
      advance: 0, // Would be fetched from actual advance records
    };
  }

  private calculateLatePenalty(salaryStructure: any, lateCount: number): number {
    const allowedLateMarks = salaryStructure.allowedLateMarks || 0;
    const lateMarkPenalty = salaryStructure.lateMarkPenalty || 0;
    if (lateCount <= allowedLateMarks) return 0;
    const excessLate = lateCount - allowedLateMarks;
    return excessLate * lateMarkPenalty;
  }

  /**
   * Calculate Provident Fund (PF)
   */
  private calculatePF(basicSalary: number, isEmployee: boolean): number {
    const rate = isEmployee ? this.config.pfEmployeeRate : this.config.pfEmployerRate;
    return basicSalary * rate;
  }

  /**
   * Calculate Employee State Insurance (ESI)
   */
  private calculateESI(grossSalary: number): number {
    if (grossSalary > this.config.esiSalaryLimit) {
      return 0; // ESI not applicable for salary above limit
    }
    return grossSalary * this.config.esiRate;
  }

  /**
   * Calculate Professional Tax (State-based)
   */
  private calculateProfessionalTax(grossSalary: number): number {
    const applicableSlab = this.ptSlabs.find(
      (slab) =>
        grossSalary >= slab.minIncome && grossSalary < slab.maxIncome,
    );

    if (!applicableSlab) {
      return 0;
    }

    const taxableAmount = grossSalary - applicableSlab.minIncome;
    return applicableSlab.baseAmount + taxableAmount * applicableSlab.rate;
  }

  /**
   * Calculate Loss of Pay (LOP)
   */
  private calculateLossOfPay(basicSalary: number, absentDays: number): number {
    return (basicSalary / 30) * absentDays * this.config.defaultLossOfPayRate;
  }

  /**
   * Calculate Income Tax (TDS) for the month
   */
  calculateMonthlyTDS(
    annualSalary: number,
    taxDeclaration: any,
    taxRegime: string = 'NEW',
  ): number {
    const taxableIncome = this.calculateAnnualTaxableIncome(
      annualSalary,
      taxDeclaration,
    );
    const annualTax = this.calculateAnnualTax(taxableIncome, taxRegime);
    return Math.max(0, annualTax / 12); // Spread over 12 months
  }

  /**
   * Calculate annual taxable income after all deductions
   */
  private calculateAnnualTaxableIncome(
    annualSalary: number,
    taxDeclaration: any = {},
  ): number {
    const {
      investment80C = 0,
      investment80D = 0,
      investment80CCD = 0,
      hraExemption = 0,
    } = taxDeclaration;

    const deductions = investment80C + investment80D + investment80CCD + hraExemption;
    const standardDeduction = this.config.standardDeduction2024;

    const taxableIncome = Math.max(
      0,
      annualSalary - deductions - standardDeduction,
    );

    return taxableIncome;
  }

  /**
   * Calculate annual tax based on income and regime
   */
  private calculateAnnualTax(
    taxableIncome: number,
    taxRegime: string = 'NEW',
  ): number {
    const slabs =
      taxRegime === 'OLD' ? this.oldTaxRegimeSlabs : this.newTaxRegimeSlabs;

    const applicableSlab = slabs.find(
      (slab) =>
        taxableIncome >= slab.minIncome && taxableIncome < slab.maxIncome,
    );

    if (!applicableSlab || applicableSlab.rate === 0) {
      return 0;
    }

    const taxableAmount = taxableIncome - applicableSlab.minIncome;
    const tax = applicableSlab.baseAmount + taxableAmount * applicableSlab.rate;

    // Add cess (4% for income > 50 lakhs)
    const cess = taxableIncome > 5000000 ? tax * 0.04 : 0;

    return tax + cess;
  }

  /**
   * Calculate total taxable income for payslip
   */
  private calculateTaxableIncome(
    grossEarnings: number,
    deductions: any,
  ): number {
    return Math.max(
      0,
      grossEarnings -
        (deductions.pfEmployee +
          deductions.esi +
          deductions.professionalTax +
          deductions.lossOfPay +
          deductions.latePenalty),
    );
  }

  /**
   * Get New Tax Regime slabs
   */
  getNewTaxRegimeSlabs(): TaxSlab[] {
    return this.newTaxRegimeSlabs;
  }

  /**
   * Get Old Tax Regime slabs
   */
  getOldTaxRegimeSlabs(): TaxSlab[] {
    return this.oldTaxRegimeSlabs;
  }
}
