"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getTimesheetsReport, TimesheetRow } from "@/api/timesheetsApi";
import { reportError } from "@/lib/error-handling";
import { formatHoursDuration } from "@/lib/time-format";

const COLUMNS = [
  { label: "Draft", status: "PENDING" },
  { label: "Submitted", status: "SUBMITTED" },
  { label: "Approved", status: "APPROVED" },
  { label: "Rejected", status: "REJECTED" },
] as const;
type ColStatus = (typeof COLUMNS)[number]["label"];

const COL_STYLE: Record<ColStatus, { header: string; card: string }> = {
  Draft: {
    header: "border-l-4 border-slate-300",
    card: "border-l-2 border-slate-300",
  },
  Submitted: {
    header: "border-l-4 border-amber-400",
    card: "border-l-2 border-amber-300",
  },
  Approved: {
    header: "border-l-4 border-teal-600",
    card: "border-l-2 border-teal-400",
  },
  Rejected: {
    header: "border-l-4 border-rose-400",
    card: "border-l-2 border-rose-300",
  },
};

export default function StatusesPage() {
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTimesheets() {
      try {
        const response = await getTimesheetsReport({ limit: 200 });
        setRows(response.data);
      } catch (error) {
        reportError(error, "Unable to load timesheets");
      } finally {
        setLoading(false);
      }
    }

    loadTimesheets();
  }, []);

  const getColRows = (col: ColStatus) =>
    rows.filter(
      (r) =>
        r.status.toUpperCase() ===
        COLUMNS.find((column) => column.label === col)?.status,
    );

  return (
    <div className="space-y-5 bg-[#f8f7f4] p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Timesheets
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Status board
          </h1>
        </div>
        <Link
          href="/dashboard/timesheets/add"
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          + New entry
        </Link>
      </div>

      {/* Kanban board */}
      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {COLUMNS.map(({ label: col }) => {
            const colRows = getColRows(col);
            const styles = COL_STYLE[col];
            return (
              <div
                key={col}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                {/* Column header */}
                <div className={`px-4 py-3 ${styles.header} bg-white`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-700 text-sm">
                      {col}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-500">
                      {colRows.length}
                    </span>
                  </div>
                </div>
                {/* Cards */}
                <div className="min-h-20 p-3 space-y-3">
                  {colRows.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      No records
                    </p>
                  ) : (
                    colRows.map((row) => (
                      <Link
                        key={row.id}
                        href={`/dashboard/timesheets?entry=${row.id}`}
                        className={`block rounded-xl border border-slate-100 bg-white p-3 transition hover:bg-slate-50 ${styles.card}`}
                      >
                        <p className="line-clamp-2 text-sm font-medium leading-5 text-slate-800">
                          {row.task}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {row.employee?.name ?? "Employee"}
                          {row.project ? ` · ${row.project}` : ""}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs text-slate-400">
                            {new Date(row.date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                          <span className="text-xs font-semibold tabular-nums text-slate-600">
                            {formatHoursDuration(row.hours)}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
