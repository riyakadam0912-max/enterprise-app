import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  calculateAbsenteeism(totalAbsent: number, totalWorkingDays: number): number {
    if (totalWorkingDays <= 0) {
      return 0;
    }

    return Number(((totalAbsent / totalWorkingDays) * 100).toFixed(2));
  }

  calculateRevenuePerLead(totalRevenue: number, totalLeads: number): number {
    if (totalLeads <= 0) {
      return 0;
    }

    return Number((totalRevenue / totalLeads).toFixed(2));
  }

  calculateConversionRate(dealsWon: number, totalLeads: number): number {
    if (totalLeads <= 0) {
      return 0;
    }

    return Number(((dealsWon / totalLeads) * 100).toFixed(2));
  }
}