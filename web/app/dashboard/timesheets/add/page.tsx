"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/apiClient";
import { reportError, getErrorMessage } from "@/lib/error-handling";

const EMPTY_FORM = {
  task: "",
  date: "",
  hours: "",
  project: "",
  notes: "",
};

export default function AddTimesheetPage() {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        task: form.task.trim(),
        date: form.date,
        hours: Number.parseFloat(form.hours),
        project: form.project.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      await apiClient("/timesheets", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push("/dashboard/timesheets");
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to save timesheet");
      setError(message);
      reportError(err, "Timesheet submission failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...EMPTY_FORM });
    setError(null);
  };

  const fieldClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Work log
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          New time entry
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Capture the work clearly. You can review and submit it when you’re
          ready.
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="max-w-3xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6"
      >
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-700">Saved as Draft</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Only you can edit it until you submit it for review.
          </p>
        </div>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          Task
          <input
            type="text"
            value={form.task}
            onChange={(e) => set("task", e.target.value)}
            required
            className={fieldClass}
            placeholder="What work did you complete?"
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            Date
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              required
              className={fieldClass}
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            Duration (hours)
            <input
              type="number"
              min="0.25"
              step="0.25"
              value={form.hours}
              onChange={(e) => set("hours", e.target.value)}
              required
              className={fieldClass}
            />
          </label>
        </div>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          Project
          <input
            type="text"
            value={form.project}
            onChange={(e) => set("project", e.target.value)}
            className={fieldClass}
            placeholder="Optional"
          />
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          Notes
          <textarea
            rows={5}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className={`${fieldClass} resize-y`}
            placeholder="Add context that will help your reviewer"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
