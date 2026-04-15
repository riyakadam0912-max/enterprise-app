import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../common/services/metrics.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  private get db(): any {
    return this.prisma;
  }

  async getOverview() {
    const [
      leads, deals, invoices, payments, expenses, contacts, campaigns, attendanceCount, absentAttendanceCount,
    ] = await Promise.all([
      this.db.lead.findMany(),
      this.db.deal.findMany(),
      this.db.invoice.findMany(),
      this.db.payment.findMany(),
      this.db.expense.findMany({ select: { amount: true } }),
      this.db.contact.count(),
      this.db.marketingCampaign.findMany({ select: { campaignName: true, budget: true, status: true } }),
      this.db.attendance.count(),
      this.db.attendance.count({ where: { status: 'ABSENT' } }),
    ]);

    // Revenue by month (last 6 months from payments)
    const revenueByMonth = this._groupByMonth(payments, 'paymentDate', 'amount');

    // Deals by stage
    const dealsByStage: Record<string, number> = {};
    for (const deal of deals) {
      dealsByStage[deal.stage] = (dealsByStage[deal.stage] ?? 0) + 1;
    }

    // Pipeline value by stage
    const pipelineValue: Record<string, number> = {};
    for (const deal of deals) {
      pipelineValue[deal.stage] = (pipelineValue[deal.stage] ?? 0) + deal.value;
    }

    // Lead conversion rate
    const convertedLeads  = leads.filter((l) => l.status === 'CONVERTED').length;
    const conversionRate  = leads.length > 0 ? (convertedLeads / leads.length) * 100 : 0;
    const revenuePerLead = this.metricsService.calculateRevenuePerLead(
      invoices.reduce((s, i) => s + i.totalAmount, 0),
      leads.length,
    );
    const absenteeismRate = this.metricsService.calculateAbsenteeism(absentAttendanceCount, attendanceCount);
    const dealConversionRate = this.metricsService.calculateConversionRate(
      deals.filter((deal) => deal.stage === 'WON').length,
      leads.length,
    );

    // Invoice revenue totals
    const totalRevenue  = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalPaid     = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

    // Invoice status breakdown
    const invoicesByStatus: Record<string, number> = {};
    for (const invoice of invoices) {
      invoicesByStatus[invoice.status] = (invoicesByStatus[invoice.status] ?? 0) + 1;
    }

    return {
      summary: {
        totalLeads:      leads.length,
        totalDeals:      deals.length,
        totalInvoices:   invoices.length,
        totalContacts:   contacts,
        totalRevenue,
        totalPaid,
        totalExpenses,
        conversionRate:  +conversionRate.toFixed(1),
        dealConversionRate,
        revenuePerLead,
        absenteeismRate,
      },
      revenueByMonth,
      dealsByStage,
      pipelineValue,
      invoicesByStatus,
      campaigns: campaigns.slice(0, 10),
    };
  }

  private _groupByMonth(
    records: Array<Record<string, any>>,
    dateField: string,
    valueField: string,
  ) {
    const map: Record<string, number> = {};
    records.forEach((r) => {
      const d = new Date(r[dateField]);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] ?? 0) + (r[valueField] ?? 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, total]) => ({ month, total }));
  }
}
