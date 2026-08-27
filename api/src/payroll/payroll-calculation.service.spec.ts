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
});
