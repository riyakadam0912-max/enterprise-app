'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock3, Pause, Play, Square } from 'lucide-react';
import { getTask, updateTaskTimer } from '@/api/tasksApi';

type TimerStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';

type TimerSnapshot = {
  timerStatus: TimerStatus;
  timerDurationSeconds: number;
  timerRemainingSeconds: number;
  timerStartedAt: string | null;
  timerTotalSeconds: number;
};

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function toTimerSnapshot(task: Awaited<ReturnType<typeof getTask>>): TimerSnapshot {
  return {
    timerStatus: task.timerStatus ?? 'IDLE',
    timerDurationSeconds: task.timerDurationSeconds ?? 0,
    timerRemainingSeconds: task.timerRemainingSeconds ?? 0,
    timerStartedAt: task.timerStartedAt ?? null,
    timerTotalSeconds: task.timerTotalSeconds ?? 0,
  };
}

function isConflictError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 409;
}

export function TaskTimerCell({
  taskId,
  estimateHours,
  actualHours,
  timerStatus = 'IDLE',
  timerDurationSeconds = 0,
  timerRemainingSeconds = 0,
  timerStartedAt = null,
  timerTotalSeconds = 0,
  canControl,
}: {
  taskId: number;
  estimateHours?: number | null;
  actualHours?: number | null;
  timerStatus?: TimerStatus;
  timerDurationSeconds?: number;
  timerRemainingSeconds?: number;
  timerStartedAt?: string | null;
  timerTotalSeconds?: number;
  canControl: boolean;
}) {
  const [timer, setTimer] = useState<TimerSnapshot>({
    timerStatus,
    timerDurationSeconds,
    timerRemainingSeconds,
    timerStartedAt,
    timerTotalSeconds,
  });
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const automaticStopStarted = useRef(false);

  useEffect(() => {
    if (timer.timerStatus !== 'RUNNING') {
      automaticStopStarted.current = false;
      return undefined;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timer.timerStatus]);

  useEffect(() => {
    setTimer({
      timerStatus,
      timerDurationSeconds,
      timerRemainingSeconds,
      timerStartedAt,
      timerTotalSeconds,
    });
  }, [timerDurationSeconds, timerRemainingSeconds, timerStartedAt, timerStatus, timerTotalSeconds]);

  const remainingSeconds = timer.timerStatus === 'RUNNING' && timer.timerStartedAt
    ? Math.max(
        0,
        timer.timerRemainingSeconds -
          Math.floor((now - new Date(timer.timerStartedAt).getTime()) / 1000),
      )
    : timer.timerRemainingSeconds;

  useEffect(() => {
    if (
      timer.timerStatus !== 'RUNNING' ||
      !canControl ||
      remainingSeconds > 0 ||
      automaticStopStarted.current
    ) return;

    automaticStopStarted.current = true;
    void updateTaskTimer(taskId, 'stop')
      .then((updated) => {
        setTimer(toTimerSnapshot(updated));
      })
      .catch((reason: unknown) => {
        if (isConflictError(reason)) {
          void getTask(taskId)
            .then((freshTask) => {
              const freshTimer = toTimerSnapshot(freshTask);
              setTimer(freshTimer);
              setNow(Date.now());
              if (freshTimer.timerStatus === 'RUNNING' || freshTimer.timerStatus === 'PAUSED') {
                setError(reason instanceof Error ? reason.message : 'Timer changed; state refreshed');
              }
            })
            .catch(() => setError(reason instanceof Error ? reason.message : 'Unable to refresh timer state'));
          return;
        }
        setError(reason instanceof Error ? reason.message : 'Unable to stop timer');
      });
  }, [canControl, remainingSeconds, taskId, timer.timerStatus]);

  async function act(action: 'start' | 'pause' | 'resume' | 'stop') {
    setBusy(true);
    setError('');
    try {
      const updated = await updateTaskTimer(taskId, action);
      setTimer(toTimerSnapshot(updated));
      setNow(Date.now());
    } catch (reason) {
      if (isConflictError(reason)) {
        try {
          const freshTimer = toTimerSnapshot(await getTask(taskId));
          setTimer(freshTimer);
          setNow(Date.now());
          const actionAlreadyApplied =
            ((action === 'start' || action === 'resume') && freshTimer.timerStatus === 'RUNNING') ||
            (action === 'pause' && freshTimer.timerStatus === 'PAUSED') ||
            (action === 'stop' && freshTimer.timerStatus !== 'RUNNING' && freshTimer.timerStatus !== 'PAUSED');
          if (!actionAlreadyApplied) {
            setError(reason instanceof Error ? reason.message : 'Timer changed; state refreshed');
          }
        } catch {
          setError(reason instanceof Error ? reason.message : 'Unable to refresh timer state');
        }
      } else {
        setError(reason instanceof Error ? reason.message : 'Unable to update timer');
      }
    } finally {
      setBusy(false);
    }
  }

  const hasEstimate = Boolean(estimateHours && estimateHours > 0);

  return (
    <div
      className="flex min-w-36 flex-col items-start gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      {timer.timerStatus === 'RUNNING' ? (
        <>
          <span className={`font-mono text-sm font-semibold tabular-nums ${remainingSeconds === 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {formatDuration(remainingSeconds)}
          </span>
          {remainingSeconds === 0 && (
            <span className="text-[10px] font-medium text-rose-600">Estimate reached</span>
          )}
          {canControl && (
            <div className="flex gap-1">
              <button type="button" title="Pause timer" aria-label="Pause timer" disabled={busy} onClick={() => void act('pause')} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                <Pause className="h-3.5 w-3.5" />
              </button>
              <button type="button" title="Stop timer and log time" aria-label="Stop timer and log time" disabled={busy} onClick={() => void act('stop')} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                <Square className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      ) : timer.timerStatus === 'PAUSED' ? (
        <>
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-700">
            {formatDuration(remainingSeconds)}
          </span>
          {canControl && (
            <div className="flex gap-1">
              <button type="button" title="Resume timer" aria-label="Resume timer" disabled={busy} onClick={() => void act('resume')} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                <Play className="h-3.5 w-3.5" />
              </button>
              <button type="button" title="Stop timer and log time" aria-label="Stop timer and log time" disabled={busy} onClick={() => void act('stop')} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                <Square className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            title={hasEstimate ? 'Start task countdown' : 'Set an estimate to start the countdown'}
            aria-label={hasEstimate ? 'Start task countdown' : 'Set an estimate to start the countdown'}
            disabled={!canControl || !hasEstimate || busy}
            onClick={() => void act('start')}
            className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Clock3 className="h-3.5 w-3.5" />
            {canControl ? 'Start' : 'Timer'}
          </button>
          {!hasEstimate && canControl && (
            <span className="max-w-36 text-[10px] text-slate-400">Set task estimate first</span>
          )}
          {timer.timerTotalSeconds > 0 && (
            <span className="text-[10px] text-slate-500">
              Timer: {(timer.timerTotalSeconds / 3600).toFixed(2)}h
            </span>
          )}
          {actualHours != null && (
            <span className="text-[10px] text-slate-500">Actual: {actualHours}h</span>
          )}
        </>
      )}
      {error && <span role="alert" className="max-w-40 text-[10px] text-rose-600">{error}</span>}
    </div>
  );
}