'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { downloadPayslip, getEmployeePayslips, type Payslip } from '@/api/payrollApi';

type DashboardRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

type Session = {
  role: DashboardRole;
  userId: number | null;
  employeeId: number | null;
  name: string;
};

function readSession(): Session {
  if (typeof window === 'undefined') {
    return { role: 'ADMIN', userId: null, employeeId: null, name: 'User' };
  }

  const role = (localStorage.getItem('role') ?? 'ADMIN') as DashboardRole;
  let userId: number | null = null;
  let employeeId: number | null = null;
  let name = 'User';

  try {
    const rawUser = localStorage.getItem('currentUser');
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as { id?: number; name?: string };
      userId = parsed.id ?? null;
      name = parsed.name ?? 'User';
    }
    const employeeIdRaw = localStorage.getItem('employeeId');
    employeeId = employeeIdRaw ? Number(employeeIdRaw) : null;
  } catch {
    userId = null;
    employeeId = null;
    name = 'User';
  }

  return { role, userId, employeeId, name };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function formatMonthYear(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export default function PayslipsPage() {
  const session = readSession();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadPayslips = useCallback(async () => {
    if (!session.employeeId) {
      setPayslips([]);
      setLoading(false);
      setError('Employee profile is not linked yet.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setPayslips(await getEmployeePayslips(session.employeeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payslips');
    } finally {
      setLoading(false);
    }
  }, [session.employeeId]);

  useEffect(() => {
    void loadPayslips();
  }, [loadPayslips]);

  const latestPayslip = useMemo(() => payslips[0] ?? null, [payslips]);

  const handleDownload = useCallback(async (payslipId: number) => {
    setBusyId(payslipId);
    try {
      const url = await downloadPayslip(payslipId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setBusyId(null);
    }
  }, []);

  if (session.role !== 'EMPLOYEE') {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Employee access only</p>
          <p className="mt-2 text-sm text-slate-500">Payslips are only available to the logged-in employee account.</p>
          <Link href="/dashboard" className="mt-4 inline-flex rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600">Go back to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Payroll</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">My payslips</h1>
          <p className="mt-2 text-sm text-slate-500">View your salary slips, download PDFs, and track recent payroll runs.</p>
        </div>
        <Link href="/dashboard/profile" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">Profile</Link>
      </div>

      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total Payslips</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">{payslips.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Latest Net Pay</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">{latestPayslip ? formatCurrency(latestPayslip.netPay) : 'N/A'}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Form 16</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">{payslips.some((payslip) => payslip.form16Generated) ? 'Ready' : 'Pending'}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Latest Month</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">{latestPayslip ? formatMonthYear(latestPayslip.month, latestPayslip.year) : 'N/A'}</p>
        </div>
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Payslip history</h2>
          <p className="mt-1 text-sm text-slate-500">Most recent salary records appear first.</p>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="text-sm text-slate-500">Loading payslips...</div>
          ) : payslips.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No payslips are available yet.</div>
          ) : (
            <div className="space-y-3">
              {payslips.map((payslip) => (
                <div key={payslip.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{formatMonthYear(payslip.month, payslip.year)}</p>
                      <p className="mt-1 text-sm text-slate-500">Net pay {formatCurrency(payslip.netPay)} · Gross {formatCurrency(payslip.grossEarnings)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{payslip.taxRegime}</span>
                      {payslip.form16Generated ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Form 16 ready</span> : null}
                      <button
                        onClick={() => void handleDownload(payslip.id)}
                        disabled={busyId === payslip.id}
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                      >
                        {busyId === payslip.id ? 'Opening...' : 'Download'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-white px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Working Days</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{payslip.workingDays ?? 'N/A'}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Present Days</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{payslip.presentDays ?? 'N/A'}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Deductions</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(payslip.totalDeductions)}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Generated</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{payslip.generatedAt ? new Date(payslip.generatedAt).toLocaleDateString('en-GB') : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}