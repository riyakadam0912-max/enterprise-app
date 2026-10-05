'use client';
'use client';

import { useEffect, useState } from 'react';
import { Clock3, Pause, Play, Square } from 'lucide-react';
import { getTask, updateTaskTimer, type Task, type TaskTimerSession } from '@/api/tasksApi';

type TimerAction = 'start' | 'pause' | 'resume' | 'stop';

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function elapsedTime(session: TaskTimerSession, now: number) {
  if (session.status !== 'RUNNING' || !session.startedAt) return session.totalSeconds;
  return session.totalSeconds + Math.max(
    0,
    Math.floor((now - new Date(session.startedAt).getTime()) / 1000),
  );
}

function isConflictError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 409;
}

export function TaskTimerSessionsCell({
  taskId,
  estimateHours,
  actualHours,
  sessions = [],
  legacyTimerTotalSeconds = 0,
  currentUserId,
  canControl,
}: {
  taskId: number;
  estimateHours?: number | null;
  actualHours?: number | null;
  sessions?: TaskTimerSession[];
  legacyTimerTotalSeconds?: number;
  currentUserId: number | null;
  canControl: boolean;
}) {
  const [timerSessions, setTimerSessions] = useState(sessions);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setTimerSessions(sessions), [sessions]);

  const ownSession = timerSessions.find((session) => (
    session.userId === currentUserId &&
    (session.status === 'RUNNING' || session.status === 'PAUSED')
  ));
  const runningSessions = timerSessions.filter((session) => session.status === 'RUNNING');
  const pausedSessions = timerSessions.filter((session) => session.status === 'PAUSED');
  const participantTotals = timerSessions.reduce<Map<number, { name: string; seconds: number }>>((totals, session) => {
    const participant = totals.get(session.userId) ?? { name: session.user.name, seconds: 0 };
    participant.seconds += elapsedTime(session, now);
    totals.set(session.userId, participant);
    return totals;
  }, new Map());

  useEffect(() => {
    if (runningSessions.length === 0) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [runningSessions.length]);

  async function act(action: TimerAction) {
    setBusy(true);
    setError('');
    try {
      const updated = await updateTaskTimer(taskId, action);
      setTimerSessions(updated.timerSessions ?? []);
      setNow(Date.now());
    } catch (reason) {
      if (isConflictError(reason)) {
        try {
          const freshTask: Task = await getTask(taskId);
          const freshSessions = freshTask.timerSessions ?? [];
          setTimerSessions(freshSessions);
          setNow(Date.now());
          const refreshedSession = freshSessions.find((session) => session.userId === currentUserId);
          const actionAlreadyApplied =
            ((action === 'start' || action === 'resume') && refreshedSession?.status === 'RUNNING') ||
            (action === 'pause' && refreshedSession?.status === 'PAUSED') ||
            (action === 'stop' && refreshedSession?.status !== 'RUNNING' && refreshedSession?.status !== 'PAUSED');
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

  const ownElapsed = ownSession ? elapsedTime(ownSession, now) : null;

  return (
    <div className="flex min-w-44 flex-col items-start gap-1.5" onClick={(event) => event.stopPropagation()}>
      {ownSession?.status === 'RUNNING' ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
            {formatDuration(ownElapsed ?? 0)}
          </span>
          <button type="button" title="Pause my timer" aria-label="Pause my timer" disabled={busy} onClick={() => void act('pause')} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            <Pause className="h-3.5 w-3.5" />
          </button>
          <button type="button" title="Stop my timer and log time" aria-label="Stop my timer and log time" disabled={busy} onClick={() => void act('stop')} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            <Square className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : ownSession?.status === 'PAUSED' ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-700">
            {formatDuration(ownElapsed ?? 0)}
          </span>
          <button type="button" title="Resume my timer" aria-label="Resume my timer" disabled={busy} onClick={() => void act('resume')} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            <Play className="h-3.5 w-3.5" />
          </button>
          <button type="button" title="Stop my timer and log time" aria-label="Stop my timer and log time" disabled={busy} onClick={() => void act('stop')} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            <Square className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            title="Start your task timer"
            aria-label="Start your task timer"
            disabled={!canControl || busy}
            onClick={() => void act('start')}
            className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Clock3 className="h-3.5 w-3.5" />
            {canControl ? 'Start mine' : 'Timer'}
          </button>
          {estimateHours != null && estimateHours > 0 && canControl && <span className="text-[10px] text-slate-400">Estimate: {estimateHours}h</span>}
        </>
      )}

      {runningSessions.filter((session) => session.userId !== currentUserId).map((session) => (
        <div key={session.id} className="text-xs text-slate-600">
          <span className="font-medium">{session.user.name}</span>{' '}
          <span className="font-mono tabular-nums">{formatDuration(elapsedTime(session, now))}</span>
        </div>
      ))}
      {pausedSessions.filter((session) => session.userId !== currentUserId).map((session) => (
        <div key={session.id} className="text-xs text-slate-500">
          <span className="font-medium">{session.user.name}</span>{' '}
          <span className="font-mono tabular-nums">{formatDuration(session.totalSeconds)} paused</span>
        </div>
      ))}
      {[...participantTotals.entries()].map(([participantId, participant]) => (
        <div key={participantId} className="text-[10px] text-slate-500">
          {participantId === currentUserId ? 'You' : participant.name}: {(participant.seconds / 3600).toFixed(2)}h tracked
        </div>
      ))}
      {legacyTimerTotalSeconds > 0 && (
        <span className="text-[10px] text-slate-500">Previously tracked: {(legacyTimerTotalSeconds / 3600).toFixed(2)}h</span>
      )}
      {actualHours != null && <span className="text-[10px] text-slate-500">Actual: {actualHours}h</span>}
      {error && <span role="alert" className="max-w-48 text-[10px] text-rose-600">{error}</span>}
    </div>
  );
}
