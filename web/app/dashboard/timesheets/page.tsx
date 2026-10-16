"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getTimesheet,
  getTimesheetsReport,
  reviewTimesheet,
  submitTimesheet,
  TimesheetRow,
} from "@/api/timesheetsApi";
import { reportError } from "@/lib/error-handling";
import { useAuthSession } from "@/stores/auth-store";
import { formatHoursDuration } from "@/lib/time-format";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  APPROVED: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLOR[status.toUpperCase()] ?? "bg-slate-400 text-white";
  const label =
    status.toUpperCase() === "PENDING"
      ? "Draft"
      : status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Draft", value: "PENDING" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
] as const;

const REVIEW_STATES = ["PENDING", "SUBMITTED", "APPROVED", "REJECTED"] as const;

function formatDate(dateValue: string) {
  return new Date(dateValue).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function TimesheetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entryParam = searchParams.get("entry");
  const session = useAuthSession();
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [reviewTarget, setReviewTarget] = useState<{
    id: number;
    decision: "APPROVED" | "REJECTED";
  } | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimesheetRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const reloadTimesheets = useCallback(async () => {
    const commonFilters = {
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      project: projectFilter.trim() || undefined,
    };
    const [response, ...counts] = await Promise.all([
      getTimesheetsReport({
        ...commonFilters,
        status: statusFilter || undefined,
        limit: 100,
      }),
      ...REVIEW_STATES.map((status) =>
        getTimesheetsReport({ ...commonFilters, status, limit: 1 }),
      ),
      getTimesheetsReport({ ...commonFilters, limit: 1 }),
    ]);
    setRows(response.data);
    setTotal(response.total);
    setStatusCounts(
      Object.fromEntries([
        ...REVIEW_STATES.map(
          (status, index) => [status, counts[index].total] as const,
        ),
        ["ALL", counts[REVIEW_STATES.length].total] as const,
      ]),
    );
  }, [dateFrom, dateTo, projectFilter, search, statusFilter]);

  useEffect(() => {
    async function loadTimesheets() {
      setLoading(true);
      try {
        await reloadTimesheets();
      } catch (error) {
        reportError(error, "Unable to load timesheets");
      } finally {
        setLoading(false);
      }
    }

    loadTimesheets();
  }, [reloadTimesheets]);

  useEffect(() => {
    if (!entryParam) return;
    const id = Number(entryParam);
    if (!Number.isInteger(id) || id <= 0) {
      setDetailError("Invalid timesheet.");
      return;
    }
    let active = true;
    setDetailLoading(true);
    getTimesheet(id)
      .then((entry) => {
        if (active) {
          setSelectedEntry(entry);
          setDetailError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setDetailError(
            error instanceof Error
              ? error.message
              : "Unable to load timesheet details.",
          );
          reportError(error, "Unable to load timesheet details");
        }
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entryParam]);

  const asyncAction = async (action: () => Promise<TimesheetRow>) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await action();
      if (selectedEntry?.id === updated.id) setSelectedEntry(updated);
      await reloadTimesheets();
      setReviewTarget(null);
      setReviewReason("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update this timesheet.";
      setActionError(message);
      reportError(error, "Timesheet review action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesSearch =
          !search ||
          row.task.toLowerCase().includes(search.toLowerCase()) ||
          String(row.employee?.name ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          String(row.employee?.id ?? row.employeeId ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (row.project ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (row.notes ?? "").toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
      }),
    [rows, search],
  );

  const isReviewer = ["ADMIN", "HR", "SUPER_ADMIN", "MANAGER"].includes(
    session.role,
  );

  const openDetails = async (row: TimesheetRow) => {
    setSelectedEntry(row);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setSelectedEntry(await getTimesheet(row.id));
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Unable to load timesheet details.",
      );
      reportError(error, "Unable to load timesheet details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApproval = () => {
    if (!selectedEntry) return;
    setReviewTarget({ id: selectedEntry.id, decision: "APPROVED" });
    setActionError(null);
  };

  const closeDetails = () => {
    setSelectedEntry(null);
    if (entryParam) router.replace("/dashboard/timesheets", { scroll: false });
  };

  return (
    <div className="space-y-5 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Time & Attendance
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              Timesheets
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Work logs and review status
            </p>
          </div>
          <Link
            href="/dashboard/timesheets/add"
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <span aria-hidden="true" className="mr-2 text-lg leading-none">
              +
            </span>
            New entry
          </Link>
        </div>

        <nav
          aria-label="Timesheet status filters"
          className="mt-6 flex gap-5 overflow-x-auto border-b border-slate-100"
        >
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value || "ALL"}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-0.5 pb-3 text-sm font-medium transition-colors ${
                statusFilter === filter.value
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {isReviewer && filter.value === "SUBMITTED"
                ? "Needs review"
                : filter.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                  statusFilter === filter.value
                    ? "bg-slate-100 text-slate-700"
                    : "bg-slate-50 text-slate-500"
                }`}
              >
                {filter.value
                  ? (statusCounts[filter.value] ?? 0)
                  : (statusCounts.ALL ?? 0)}
              </span>
            </button>
          ))}
        </nav>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_repeat(2,minmax(145px,0.7fr))_minmax(180px,0.9fr)]">
          <label className="relative block">
            <span className="sr-only">Search timesheets</span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search work, project, employee…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </label>
          <label>
            <span className="sr-only">Start date</span>
            <input
              aria-label="Start date"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-slate-400 focus:bg-white"
            />
          </label>
          <label>
            <span className="sr-only">End date</span>
            <input
              aria-label="End date"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-slate-400 focus:bg-white"
            />
          </label>
          <label>
            <span className="sr-only">Filter by project</span>
            <input
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              placeholder="Project"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
            />
          </label>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-medium text-slate-700">
            {statusFilter === "SUBMITTED" && isReviewer
              ? "Needs review"
              : "Work logs"}
          </p>
          <p className="text-xs text-slate-400">
            Showing {filteredRows.length} of {total}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {[
                  "Work log",
                  "Employee",
                  "Date",
                  "Duration",
                  "Status",
                  "Project",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-slate-400"
                  >
                    Loading timesheets…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-slate-400"
                  >
                    No work logs match these filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => void openDetails(row)}
                        className="text-left"
                      >
                        <span className="block max-w-[300px] truncate font-medium text-slate-900">
                          {row.task}
                        </span>
                        <span className="mt-1 block text-xs text-slate-400">
                          {row.source === "TASK_TIMER"
                            ? "Task timer"
                            : row.source === "IMPORT"
                              ? "Imported"
                              : row.source === "MANUAL"
                                ? "Manual entry"
                                : "Legacy entry"}
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {row.employee?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                      {formatDate(row.date)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-medium tabular-nums text-slate-700">
                      {formatHoursDuration(row.hours)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={row.status} />
                      {row.status.toUpperCase() === "SUBMITTED" &&
                        row.submittedAt && (
                          <p className="mt-1 text-xs text-slate-400">
                            {formatDate(row.submittedAt)}
                          </p>
                        )}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {row.project ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEntry && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-950/20"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetails();
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="timesheet-detail-title"
            className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-[#fdfdfb] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Work log
              </p>
              <button
                type="button"
                onClick={closeDetails}
                aria-label="Close details"
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>
            {detailLoading ? (
              <p className="p-6 text-sm text-slate-500">Loading details…</p>
            ) : detailError ? (
              <p role="alert" className="p-6 text-sm text-rose-600">
                {detailError}
              </p>
            ) : (
              <div className="flex-1 space-y-6 p-6">
                <div>
                  <StatusBadge status={selectedEntry.status} />
                  <h2
                    id="timesheet-detail-title"
                    className="mt-4 text-2xl font-semibold tracking-tight text-slate-900"
                  >
                    {selectedEntry.task}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedEntry.createdByUser?.name ??
                      selectedEntry.employee?.name ??
                      "Work log"}{" "}
                    ·{" "}
                    {selectedEntry.project ?? "No project"} ·{" "}
                    {formatDate(selectedEntry.date)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-400">Duration</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                      {formatHoursDuration(selectedEntry.hours)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-400">Source</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {selectedEntry.source === "TASK_TIMER"
                        ? "Task timer"
                        : selectedEntry.source === "IMPORT"
                          ? "Import"
                          : selectedEntry.source === "MANUAL"
                            ? "Manual entry"
                            : "Legacy entry"}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Submission & review
                  </h3>
                  <ol className="mt-4 space-y-3 border-l border-slate-200 pl-4 text-sm">
                    <li className="text-slate-600">
                      <span className="font-medium text-slate-800">Draft</span>
                      {selectedEntry.createdAt && (
                        <span className="ml-2 text-xs text-slate-400">
                          {formatDate(selectedEntry.createdAt)}
                        </span>
                      )}
                    </li>
                    <li
                      className={
                        selectedEntry.submittedAt
                          ? "text-slate-600"
                          : "text-slate-300"
                      }
                    >
                      <span className="font-medium">Submitted</span>
                      {selectedEntry.submittedAt && (
                        <span className="ml-2 text-xs text-slate-400">
                          {formatDate(selectedEntry.submittedAt)}
                        </span>
                      )}
                    </li>
                    <li
                      className={
                        selectedEntry.reviewedAt
                          ? "text-slate-600"
                          : "text-slate-300"
                      }
                    >
                      <span className="font-medium">
                        {selectedEntry.status === "REJECTED"
                          ? "Returned"
                          : "Reviewed"}
                      </span>
                      {selectedEntry.reviewedAt && (
                        <span className="ml-2 text-xs text-slate-400">
                          {selectedEntry.reviewedByUser?.name
                            ? `by ${selectedEntry.reviewedByUser.name} · `
                            : ""}
                          {formatDate(selectedEntry.reviewedAt)}
                        </span>
                      )}
                    </li>
                  </ol>
                  {selectedEntry.rejectionReason && (
                    <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-3">
                      <p className="text-xs font-semibold text-rose-700">
                        Reason for return
                      </p>
                      <p className="mt-1 text-sm text-rose-800">
                        {selectedEntry.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Notes
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {selectedEntry.notes || "No notes added."}
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              {selectedEntry.createdByUserId === session.user?.id &&
                ["PENDING", "REJECTED"].includes(
                  selectedEntry.status.toUpperCase(),
                ) && (
                  <>
                    <Link
                      href={`/dashboard/timesheets/${selectedEntry.id}/edit`}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() =>
                        void asyncAction(() =>
                          submitTimesheet(selectedEntry.id),
                        )
                      }
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {selectedEntry.status === "REJECTED"
                        ? "Resubmit"
                        : "Submit for review"}
                    </button>
                  </>
                )}
              {isReviewer &&
                selectedEntry.createdByUserId !== session.user?.id &&
                selectedEntry.status.toUpperCase() === "SUBMITTED" && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleApproval}
                      className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => {
                        setReviewTarget({
                          id: selectedEntry.id,
                          decision: "REJECTED",
                        });
                        setReviewReason("");
                        setActionError(null);
                      }}
                      className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Return for edits
                    </button>
                  </>
                )}
            </div>
          </aside>
        </div>
      )}

      {reviewTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-timesheet-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h2
              id="reject-timesheet-title"
              className="text-lg font-semibold text-slate-900"
            >
              {reviewTarget.decision === "APPROVED"
                ? "Approve this work log?"
                : "Return for edits?"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {reviewTarget.decision === "APPROVED"
                ? "This confirms the hours and locks the work log from further edits."
                : "Add a short reason so the employee knows what to update."}
            </p>
            {reviewTarget.decision === "REJECTED" && (
              <textarea
                value={reviewReason}
                onChange={(event) => setReviewReason(event.target.value)}
                maxLength={1000}
                rows={4}
                className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                placeholder="Reason for returning this entry"
              />
            )}
            {actionError && (
              <p className="mt-3 text-sm text-rose-600">{actionError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setReviewTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  actionLoading ||
                  (reviewTarget.decision === "REJECTED" && !reviewReason.trim())
                }
                onClick={() =>
                  void asyncAction(() =>
                    reviewTimesheet(
                      reviewTarget.id,
                      reviewTarget.decision,
                      reviewTarget.decision === "REJECTED"
                        ? reviewReason.trim()
                        : undefined,
                    ),
                  )
                }
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${reviewTarget.decision === "APPROVED" ? "bg-teal-700 hover:bg-teal-800" : "bg-rose-600 hover:bg-rose-700"}`}
              >
                {actionLoading
                  ? "Saving…"
                  : reviewTarget.decision === "APPROVED"
                    ? "Confirm approval"
                    : "Return for edits"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
