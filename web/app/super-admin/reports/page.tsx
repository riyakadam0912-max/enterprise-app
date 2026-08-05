'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Download, Filter, TrendingUp } from 'lucide-react';
import { getReportsDashboard, type ReportsDashboard } from '@/api/reportsApi';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import AttendanceTrendChart from '@/components/reports/AttendanceTrendChart';
import PayrollCostChart from '@/components/reports/PayrollCostChart';
import EmployeeGrowthChart from '@/components/reports/EmployeeGrowthChart';
import PerformanceDistributionChart from '@/components/reports/PerformanceDistributionChart';
import { toast } from '@/providers/toast-provider';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export default function SuperAdminReports() {
  const [dashboard, setDashboard] = useState<ReportsDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const data = await getReportsDashboard();
        if (!active) return;
        setDashboard(data);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Unable to load reports';
        toast.error('Reports unavailable', message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <SuperAdminPageShell title="Reports" description="Monitor growth, churn, and financial health with executive-ready visuals." actions={<><Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filters</Button><Button><Download className="mr-2 h-4 w-4" />Export</Button></>}>
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-8 text-center text-sm text-slate-500">Loading reports…</div>
      </SuperAdminPageShell>
    );
  }

  if (!dashboard) {
    return (
      <SuperAdminPageShell title="Reports" description="Monitor growth, churn, and financial health with executive-ready visuals." actions={<><Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filters</Button><Button><Download className="mr-2 h-4 w-4" />Export</Button></>}>
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-8 text-center text-sm text-slate-500">No reports data is currently available.</div>
      </SuperAdminPageShell>
    );
  }

  const summaryCards = [
    { label: 'Total employees', value: dashboard.summaryCards.totalEmployees, icon: BarChart3 },
    { label: 'Present today', value: dashboard.summaryCards.presentToday, icon: TrendingUp },
    { label: 'Monthly payroll', value: formatCurrency(dashboard.summaryCards.monthlyPayrollCost), icon: BarChart3 },
    { label: 'Attrition', value: `${dashboard.summaryCards.attritionRate.toFixed(1)}%`, icon: TrendingUp },
  ];

  return (
    <SuperAdminPageShell title="Reports" description="Monitor growth, churn, and financial health with executive-ready visuals." actions={<><Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filters</Button><Button><Download className="mr-2 h-4 w-4" />Export</Button></>}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="border-slate-200/80 bg-white/80 p-5 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700"><Icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm text-slate-500">{metric.label}</p>
                  <p className="text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200/80 bg-white/80 p-6 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Attendance trend</h3>
              <p className="text-sm text-slate-500">Present and absent days across the selected window.</p>
            </div>
          </div>
          <AttendanceTrendChart data={dashboard.charts.attendanceTrend} />
        </Card>
        <Card className="border-slate-200/80 bg-white/80 p-6 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Payroll cost</h3>
              <p className="text-sm text-slate-500">Net pay and deductions for recent months.</p>
            </div>
          </div>
          <PayrollCostChart data={dashboard.charts.payrollCost} />
        </Card>
        <Card className="border-slate-200/80 bg-white/80 p-6 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Employee growth</h3>
              <p className="text-sm text-slate-500">Hiring trend across recent periods.</p>
            </div>
          </div>
          <EmployeeGrowthChart data={dashboard.charts.employeeGrowth} />
        </Card>
        <Card className="border-slate-200/80 bg-white/80 p-6 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Performance distribution</h3>
              <p className="text-sm text-slate-500">Distribution of top and low performers.</p>
            </div>
          </div>
          <PerformanceDistributionChart data={dashboard.charts.performanceDistribution} />
        </Card>
      </div>
    </SuperAdminPageShell>
  );
}
