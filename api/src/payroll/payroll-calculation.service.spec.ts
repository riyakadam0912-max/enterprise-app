import { PayrollCalculationService } from './payroll-calculation.service';

describe('PayrollCalculationService', () => {
  it('does not deduct period shortfall a second time after hourly proration', async () => {
    const service = new PayrollCalculationService({} as never);

    const result = await service.calculatePayroll({
      employeeId: 1,
      month: 8,
      year: 2026,
      salaryStructure: { basic: 2400, hra: 0, allowances: 0 },
      attendanceData: {
        presentDays: 22,
        absentDays: 0,
        paidLeaves: 0,
        unpaidLeaves: 0,
        totalWorkingDays: 22,
        totalWorkedHours: 168,
        totalExpectedHours: 176,
        totalShortfallHours: 8,
      },
    });

    expect(result.deductions.lossOfPay).toBe(0);
    expect(result.grossEarnings).toBeCloseTo((2400 * 168) / 176, 2);
  });

  it('uses manual monthly statutory deductions without deducting employer PF', async () => {
    const service = new PayrollCalculationService({} as never);
    const result = await service.calculatePayroll({
      employeeId: 1,
      month: 10,
      year: 2026,
      salaryStructure: {
        basic: 50000,
        hra: 10000,
        allowances: 5000,
        manualPf: 1000,
        manualEsi: 200,
        manualProfessionalTax: 250,
        manualTds: 3000,
        manualOtherDeductions: 500,
      },
      attendanceData: {
        presentDays: 22,
        absentDays: 0,
        paidLeaves: 0,
        unpaidLeaves: 0,
        totalWorkingDays: 22,
        totalWorkedHours: 176,
        totalExpectedHours: 176,
        totalShortfallHours: 0,
      },
    });

    expect(result.deductions.pfEmployee).toBe(1000);
    expect(result.deductions.pfEmployer).toBe(6000);
    expect(result.totalDeductions).toBe(4950);
    expect(result.netPay).toBe(60050);
  });
});
