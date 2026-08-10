'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Download, Filter, RotateCcw, TrendingUp, X } from 'lucide-react';
import { getReportsDashboard, type ReportsDashboard, type ReportsFilters } from '@/api/reportsApi';
import { SuperAdminPageShell } from '@/components/super-admin/SuperAdminPageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/Dialog';
import AttendanceTrendChart from '@/components/reports/AttendanceTrendChart';
import PayrollCostChart from '@/components/reports/PayrollCostChart';
import EmployeeGrowthChart from '@/components/reports/EmployeeGrowthChart';
import PerformanceDistributionChart from '@/components/reports/PerformanceDistributionChart';
import { toast } from '@/providers/toast-provider';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function getDefaultFilters(): ReportsFilters {
  return {};
}

function describeFilters(filters: ReportsFilters): string {
  const parts: string[] = [];
  if (filters.month) parts.push(`Month: ${filters.month}`);
  if (filters.from) parts.push(`From: ${filters.from}`);
  if (filters.to) parts.push(`To: ${filters.to}`);
  if (filters.department) parts.push(`Dept: ${filters.department}`);
  if (filters.role) parts.push(`Role: ${filters.role}`);
  if (filters.employeeId) parts.push(`Employee #${filters.employeeId}`);
  return parts.join(' · ') || 'No filters applied';
}

export default function SuperAdminReports() {
  const [dashboard, setDashboard] = useState<ReportsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [appliedFilters, setAppliedFilters] = useState<ReportsFilters>(getDefaultFilters());

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftMonth, setDraftMonth] = useState(appliedFilters.month ?? '');
  const [draftFrom, setDraftFrom] = useState(appliedFilters.from ?? '');
  const [draftTo, setDraftTo] = useState(appliedFilters.to ?? '');
  const [draftDepartment, setDraftDepartment] = useState(appliedFilters.department ?? '');
  const [draftRole, setDraftRole] = useState<ReportsFilters['role'] | ''>(appliedFilters.role ?? '');
  const [draftEmployeeId, setDraftEmployeeId] = useState<string>(
    typeof appliedFilters.employeeId === 'number' ? String(appliedFilters.employeeId) : '',
  );
  const [applyLoading, setApplyLoading] = useState(false);

  const openFilters = () => {
    setDraftMonth(appliedFilters.month ?? '');
    setDraftFrom(appliedFilters.from ?? '');
    setDraftTo(appliedFilters.to ?? '');
    setDraftDepartment(appliedFilters.department ?? '');
    setDraftRole(appliedFilters.role ?? '');
    setDraftEmployeeId(typeof appliedFilters.employeeId === 'number' ? String(appliedFilters.employeeId) : '');
    setFiltersOpen(true);
  };

  const loadDashboard = async (filters: ReportsFilters, setLoadingFlag = true) => {
    if (setLoadingFlag) setLoading(true);
    try {
      const data = await getReportsDashboard(filters);
      setDashboard(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load reports';
      toast.error('Reports unavailable', message);
    } finally {
      if (setLoadingFlag) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const data = await getReportsDashboard(appliedFilters);
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
    void init();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = async () => {
    setApplyLoading(true);
    try {
      const parsedEmployeeId = draftEmployeeId.trim()
        ? Number(draftEmployeeId.trim())
        : undefined;
      const normalizedFilters: ReportsFilters = {};
      if (draftMonth.trim()) normalizedFilters.month = draftMonth.trim();
      if (draftFrom.trim()) normalizedFilters.from = draftFrom.trim();
      if (draftTo.trim()) normalizedFilters.to = draftTo.trim();
      if (draftDepartment.trim()) normalizedFilters.department = draftDepartment.trim();
      if (draftRole) normalizedFilters.role = draftRole;
      if (typeof parsedEmployeeId === 'number' && Number.isFinite(parsedEmployeeId)) {
        normalizedFilters.employeeId = parsedEmployeeId;
      }

      await loadDashboard(normalizedFilters, false);
      setAppliedFilters(normalizedFilters);
      toast.success('Filters applied', describeFilters(normalizedFilters));
      setFiltersOpen(false);
    } finally {
      setApplyLoading(false);
    }
  };

  const resetFilters = async () => {
    const empty = getDefaultFilters();
    await loadDashboard(empty, false);
    setAppliedFilters(empty);
    toast.success('Filters reset', 'Using default reporting window.');
    setFiltersOpen(false);
  };

  const actions = (
    <>
      <Button variant="outline" onClick={openFilters}>
        <Filter className="mr-2 h-4 w-4" />
        Filters
        {Object.keys(appliedFilters).length > 0 ? (
          <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            {Object.keys(appliedFilters).length}
          </span>
        ) : null}
      </Button>
      {Object.keys(appliedFilters).length > 0 ? (
        <Button variant="ghost" onClick={resetFilters}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      ) : null}
      <Button>
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
    </>
  );

  if (loading) {
    return (
      <SuperAdminPageShell
        title="Reports"
        description="Monitor growth, churn, and financial health with executive-ready visuals."
        actions={actions}
      >
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-8 text-center text-sm text-slate-500">Loading reports…</div>
      </SuperAdminPageShell>
    );
  }

  if (!dashboard) {
    return (
      <SuperAdminPageShell
        title="Reports"
        description="Monitor growth, churn, and financial health with executive-ready visuals."
        actions={actions}
      >
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-8 text-center text-sm text-slate-500">No reports data is currently available.</div>
      </SuperAdminPageShell>
    );
  }

  const summaryCards = [
    { label: 'Total employees', value: dashboard.summaryCards.totalEmployees, icon: BarChart3 },
    { label: 'Present today', value: dashboard.summaryCards.presentToday, icon: TrendingUp },
    {
      label: 'Monthly payroll',
      value: formatCurrency(dashboard.summaryCards.monthlyPayrollCost),
      icon: BarChart3,
    },
    { label: 'Attrition', value: `${dashboard.summaryCards.attritionRate.toFixed(1)}%`, icon: TrendingUp },
  ];

  return (
    <>
      <SuperAdminPageShell
        title="Reports"
        description="Monitor growth, churn, and financial health with executive-ready visuals."
        actions={actions}
      >
        {Object.keys(appliedFilters).length > 0 ? (
          <Card className="border-indigo-100 bg-indigo-50/40 p-4 text-sm text-indigo-800 shadow-none backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium">Active filters</span>
              <span className="text-indigo-700">{describeFilters(appliedFilters)}</span>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card
                key={metric.label}
                className="border-slate-200/80 bg-white/80 p-5 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
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

      <Dialog
        open={filtersOpen}
        title="Report filters"
        description="Refine the reporting window and scope before exporting or drilling into charts."
        onClose={() => setFiltersOpen(false)}
        onConfirm={applyFilters}
        confirmLabel="Apply filters"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="reports-month">Reporting month</Label>
            <Input
              id="reports-month"
              type="month"
              className="mt-1.5"
              value={draftMonth}
              onChange={(event) => setDraftMonth(event.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">Overrides the date range when provided.</p>
          </div>
          <div>
            <Label htmlFor="reports-role">Role</Label>
            <Select
              id="reports-role"
              className="mt-1.5"
              value={draftRole}
              onChange={(event) => setDraftRole(event.target.value as ReportsFilters['role'] | '')}
            >
              <option value="">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="HR">HR</option>
              <option value="MANAGER">Manager</option>
              <option value="EMPLOYEE">Employee</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="reports-from">From date</Label>
            <Input
              id="reports-from"
              type="date"
              className="mt-1.5"
              value={draftFrom}
              onChange={(event) => setDraftFrom(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="reports-to">To date</Label>
            <Input
              id="reports-to"
              type="date"
              className="mt-1.5"
              value={draftTo}
              onChange={(event) => setDraftTo(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="reports-department">Department</Label>
            <Input
              id="reports-department"
              className="mt-1.5"
              placeholder="e.g. Engineering"
              value={draftDepartment}
              onChange={(event) => setDraftDepartment(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="reports-employee">Employee ID</Label>
            <Input
              id="reports-employee"
              type="number"
              min="1"
              className="mt-1.5"
              placeholder="Numeric employee id"
              value={draftEmployeeId}
              onChange={(event) => setDraftEmployeeId(event.target.value)}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
}
