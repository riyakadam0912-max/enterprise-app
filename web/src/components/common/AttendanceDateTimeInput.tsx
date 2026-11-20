"use client";

import { useEffect, useState } from "react";
import {
  joinTwelveHourDateTime,
  splitTwelveHourDateTime,
} from "@/lib/attendance-format";
import { CalendarDays, Clock3, X } from "lucide-react";

export function AttendanceDateTimeInput({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [parts, setParts] = useState(() => splitTwelveHourDateTime(value));
  useEffect(() => {
    setParts(splitTwelveHourDateTime(value));
  }, [value]);
  function change(key: keyof typeof parts, next: string) {
    const updated = { ...parts, [key]: next };
    setParts(updated);
    onChange(joinTwelveHourDateTime(updated, value, key === "date"));
  }
  return (
    <fieldset disabled={disabled} className="group min-w-0 space-y-2.5 disabled:opacity-70">
      <legend className="sr-only">{label}</legend>
      <div className="flex min-h-6 items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Clear ${label.toLowerCase()}`}
            title={`Clear ${label.toLowerCase()}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm transition focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 group-disabled:bg-slate-100">
        <label htmlFor={id} className="flex items-center gap-3 border-b border-slate-200 px-3 py-2.5 text-slate-500 group-disabled:border-slate-200">
          <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="sr-only">{label} date</span>
          <input
            id={id}
            type="date"
            aria-label={`${label} date`}
            value={parts.date}
            onChange={(event) => change("date", event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none disabled:text-slate-500"
          />
        </label>

        <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
          <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
          <div className="flex min-w-0 flex-1 items-center rounded-lg bg-slate-50 px-2 py-1 ring-1 ring-inset ring-slate-200 group-disabled:bg-slate-100">
            <select
              aria-label={`${label} hour`}
              value={parts.hour}
              onChange={(event) => change("hour", event.target.value)}
              className="min-w-0 flex-1 appearance-none bg-transparent py-1 text-center text-base font-semibold tabular-nums text-slate-900 outline-none disabled:text-slate-500"
            >
              {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((hour) => (
                <option key={hour}>{hour}</option>
              ))}
            </select>
            <span aria-hidden="true" className="px-0.5 pb-0.5 text-base font-bold text-slate-400">:</span>
            <select
              aria-label={`${label} minute`}
              value={parts.minute}
              onChange={(event) => change("minute", event.target.value)}
              className="min-w-0 flex-1 appearance-none bg-transparent py-1 text-center text-base font-semibold tabular-nums text-slate-900 outline-none disabled:text-slate-500"
            >
              {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")).map((minute) => (
                <option key={minute}>{minute}</option>
              ))}
            </select>
          </div>

          <div className="grid shrink-0 grid-cols-2 rounded-lg bg-slate-100 p-1" aria-label={`${label} period`}>
            {["AM", "PM"].map((period) => (
              <button
                key={period}
                type="button"
                aria-pressed={parts.period === period}
                onClick={() => change("period", period)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-orange-400 ${parts.period === period ? "bg-white text-orange-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!value && (
        <p className="text-xs text-slate-400">Choose a date to set the time.</p>
      )}
    </fieldset>
  );
}
