"use client";

import { useEffect, useState } from "react";
import {
  joinTwelveHourDateTime,
  splitTwelveHourDateTime,
} from "@/lib/attendance-format";

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
  const style =
    "min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500";
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-2">
      <legend className="mb-2 text-sm font-medium text-slate-700">
        {label}
      </legend>
      <input
        id={id}
        type="date"
        aria-label={`${label} date`}
        value={parts.date}
        onChange={(e) => change("date", e.target.value)}
        className={`${style} w-full`}
      />
      <div className="grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-2">
        <select
          aria-label={`${label} hour`}
          value={parts.hour}
          onChange={(e) => change("hour", e.target.value)}
          className={style}
        >
          {Array.from({ length: 12 }, (_, index) =>
            String(index + 1).padStart(2, "0"),
          ).map((hour) => (
            <option key={hour}>{hour}</option>
          ))}
        </select>
        <span aria-hidden="true">:</span>
        <select
          aria-label={`${label} minute`}
          value={parts.minute}
          onChange={(e) => change("minute", e.target.value)}
          className={style}
        >
          {Array.from({ length: 60 }, (_, index) =>
            String(index).padStart(2, "0"),
          ).map((minute) => (
            <option key={minute}>{minute}</option>
          ))}
        </select>
        <select
          aria-label={`${label} AM or PM`}
          value={parts.period}
          onChange={(e) => change("period", e.target.value)}
          className={style}
        >
          <option>AM</option>
          <option>PM</option>
        </select>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-xs text-slate-600 underline"
        >
          Clear {label.toLowerCase()}
        </button>
      )}
    </fieldset>
  );
}
