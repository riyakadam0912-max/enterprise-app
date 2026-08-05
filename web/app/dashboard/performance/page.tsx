'use client';

import { useEffect, useMemo, useState } from 'react';
import { getGoalCycles, getGoals, getReviews, type Goal, type GoalCycle, type PerformanceReview } from '@/api/performanceApi';
import { getEmployees, type Employee } from '@/api/employeesApi';

export default function PerformancePage() {
  const [goalCycles, setGoalCycles] = useState<GoalCycle[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [cycles, allGoals, allReviews, employeeList] = await Promise.all([
          getGoalCycles(),
          getGoals(selectedEmployeeId ? Number(selectedEmployeeId) : undefined),
          getReviews(selectedEmployeeId ? Number(selectedEmployeeId) : undefined),
          getEmployees().catch(() => []),
        ]);

        if (!active) return;
        setGoalCycles(cycles);
        setGoals(allGoals);
        setReviews(allReviews);
        setEmployees(employeeList);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load performance data');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [selectedEmployeeId]);

  const employeeOptions = useMemo(() => employees.filter(Boolean), [employees]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Performance</p>
          <h1 className="text-2xl font-semibold text-slate-900">Goal cycles and reviews</h1>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <label className="text-sm font-medium text-slate-600" htmlFor="employee-filter">Filter by employee</label>
          <select
            id="employee-filter"
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All employees</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Active goal cycles</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{goalCycles.length}</p>
          <p className="mt-2 text-sm text-slate-500">Cycles currently available for the organization.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Goals</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{goals.length}</p>
          <p className="mt-2 text-sm text-slate-500">Goal records visible to the selected scope.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Reviews</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{reviews.length}</p>
          <p className="mt-2 text-sm text-slate-500">Submitted reviews in the current view.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Goal cycles</h2>
            <span className="text-sm text-slate-500">{loading ? 'Loading...' : `${goalCycles.length} records`}</span>
          </div>
          <div className="mt-4 space-y-3">
            {goalCycles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No goal cycles available yet.</div>
            ) : (
              goalCycles.map((cycle) => (
                <div key={cycle.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{cycle.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{cycle.startDate} → {cycle.endDate}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-600">{cycle.status}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">Goals: {cycle._count?.goals ?? 0} · Reviews: {cycle._count?.reviews ?? 0}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent reviews</h2>
            <span className="text-sm text-slate-500">{loading ? 'Loading...' : `${reviews.length} records`}</span>
          </div>
          <div className="mt-4 space-y-3">
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No reviews submitted yet.</div>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{review.employee?.name ?? 'Employee'}</p>
                      <p className="mt-1 text-sm text-slate-500">{review.goalCycle?.name ?? 'Goal cycle'}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">{review.status ?? 'SUBMITTED'}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">Rating: {review.rating ?? 'N/A'} · Submitted: {review.submittedAt ? new Date(review.submittedAt).toLocaleDateString() : 'N/A'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
