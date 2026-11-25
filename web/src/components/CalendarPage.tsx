'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Users, X } from 'lucide-react';
import { getTasks, createTask, type Task } from '@/api/tasksApi';
import { getEmployees } from '@/api/employeesApi';
import { useAuthSession } from '@/stores/auth-store';

type EventType = 'SHOOT' | 'MEETING' | 'TASK';
type CalendarEvent = { id: string; type: EventType; title: string; date: string; endDate?: string | null; time?: string | null; location?: string | null; owner?: string | null; status?: string | null; sourceHref?: string };
type Meeting = { id: string; title: string; clientName: string; date: string; time: string; duration: string; location: string; attendees: string[]; createdBy: number | null; dayType?: 'FULL_DAY' | 'HALF_DAY' | ''; meetingType?: string; notes?: string; reminder?: string };

const EVENT_STYLES: Record<EventType, { label: string; dot: string; border: string; soft: string }> = {
  SHOOT: { label: 'Shoots', dot: 'bg-[#c9795c]', border: 'border-[#e9b7a5]', soft: 'bg-[#fff5f0]' },
  MEETING: { label: 'Meetings', dot: 'bg-[#6f8f7b]', border: 'border-[#bfd2c5]', soft: 'bg-[#f3f8f4]' },
  TASK: { label: 'Deadlines', dot: 'bg-[#c9a34e]', border: 'border-[#ead9a8]', soft: 'bg-[#fffaf0]' },
};

const pad = (value: number) => String(value).padStart(2, '0');
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const formatLongDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const initials = (value: string) => value.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function buildMonthDays(month: Date) {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= days ? new Date(month.getFullYear(), month.getMonth(), day) : null;
  });
}

function NewEventDialog({ type, onClose, onCreated, employeeOptions }: { type: EventType; onClose: () => void; onCreated: (event: CalendarEvent) => void; employeeOptions: Array<{ id: number; name: string }> }) {
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [date, setDate] = useState(isoDate(new Date()));
  const [time, setTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [attendee, setAttendee] = useState('');
  const [meetingType, setMeetingType] = useState('Internal');
  const [dayType, setDayType] = useState<'FULL_DAY' | 'HALF_DAY' | ''>('');
  const [notes, setNotes] = useState('');
  const [reminder, setReminder] = useState('15 minutes before');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!clientName.trim()) return setError('Add a client name to continue.');
    setBusy(true); setError('');
    try {
      if (type === 'MEETING') {
        const meeting: Meeting = { id: `meeting-${Date.now()}`, title: title.trim() || `Meeting · ${clientName.trim()}`, clientName: clientName.trim(), date, time, duration: dayType === 'FULL_DAY' ? 'Full day' : dayType === 'HALF_DAY' ? 'Half day' : `${time}–${endTime}`, location: location.trim() || 'Not specified', attendees: attendee ? [attendee] : [], createdBy: null, dayType, meetingType, notes: notes.trim(), reminder };
        const existing = JSON.parse(window.localStorage.getItem('enterprise-calendar-meetings') ?? '[]') as Meeting[];
        window.localStorage.setItem('enterprise-calendar-meetings', JSON.stringify([...existing, meeting]));
        onCreated({ id: meeting.id, type, title: meeting.title, date, time, location: meeting.location, owner: attendee || 'Internal meeting', status: 'CONFIRMED' });
      } else {
        const created = await createTask(type === 'SHOOT' ? { taskName: title.trim(), title: title.trim(), taskType: 'SHOOT', shootDate: date, shootEndDate: date, shootReportingTime: time, shootLocation: location.trim() || null, shootCrewUserIds: attendee ? [Number(attendee)] : [], status: 'PENDING' } : { taskName: title.trim(), title: title.trim(), taskType: 'GENERAL', dueDate: `${date}T${time}:00`, status: 'PENDING' });
        onCreated({ id: String(created.id), type, title: created.taskName, date, time: type === 'SHOOT' ? created.shootReportingTime : time, location: created.shootLocation, owner: created.assignedToUser?.name ?? 'Unassigned', status: created.status, sourceHref: `/dashboard/tasks?task=${created.id}` });
      }
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create this item.'); } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
    <form onSubmit={submit} className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between rounded-2xl bg-[#f3f8f4] p-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6f8f7b]">Calendar / Meetings</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Schedule a meeting</h2><p className="mt-1 text-sm text-slate-500">Keep the details concise and the team aligned.</p></div><button type="button" onClick={onClose} className="rounded-full bg-white p-2 text-slate-400 shadow-sm hover:text-slate-700" aria-label="Close"><X className="h-4 w-4" /></button></div>
          <div className="mt-6 grid gap-5"><div><p className="section-label">Meeting details</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="label">Client name</span><input autoFocus value={clientName} onChange={(e) => setClientName(e.target.value)} className="field" placeholder="e.g. Acme Studio" /></label><label><span className="label">Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" /></label><label><span className="label">Start at</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field" /></label><div className="sm:col-span-2"><span className="label">Day type <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span></span><div className="mt-1 flex gap-2"><button type="button" onClick={() => setDayType(dayType === 'FULL_DAY' ? '' : 'FULL_DAY')} className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${dayType === 'FULL_DAY' ? 'border-[#6f8f7b] bg-[#f3f8f4] text-[#496554]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Full day</button><button type="button" onClick={() => setDayType(dayType === 'HALF_DAY' ? '' : 'HALF_DAY')} className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${dayType === 'HALF_DAY' ? 'border-[#6f8f7b] bg-[#f3f8f4] text-[#496554]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Half day</button></div></div></div></div></div>
      {error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}<div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-5"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={busy} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busy ? 'Saving…' : 'Schedule meeting'}</button></div>
    </form>
  </div>;
}

export default function CalendarPage({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const session = useAuthSession();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(isoDate(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: number; name: string; role?: string }>>([]);
  const [filter, setFilter] = useState('mine');
  const [typeFilter, setTypeFilter] = useState<'ALL' | EventType>('ALL');
  const [dialog, setDialog] = useState<EventType | null>(null);
  const [datePopup, setDatePopup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canFilterPeople = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR'].includes(session?.role ?? '');
  useEffect(() => { void Promise.all([getTasks(), canFilterPeople ? getEmployees() : Promise.resolve([])]).then(([tasks, people]) => {
    const taskEvents = (tasks as Task[]).flatMap((task) => {
      const date = task.taskType === 'SHOOT' ? task.shootDate : task.dueDate?.slice(0, 10);
      if (!date) return [];
      return [{ id: `task-${task.id}`, type: task.taskType === 'SHOOT' ? 'SHOOT' as const : 'TASK' as const, title: task.taskName, date: date.slice(0, 10), endDate: task.shootEndDate?.slice(0, 10), time: task.taskType === 'SHOOT' ? task.shootReportingTime : null, location: task.shootLocation, owner: task.assignedToUser?.name ?? task.assignee, status: task.status, sourceHref: `/dashboard/tasks?task=${task.id}` }];
    });
    const meetings = JSON.parse(window.localStorage.getItem('enterprise-calendar-meetings') ?? '[]') as Meeting[];
    setEvents([...taskEvents, ...meetings.map((meeting) => ({ id: meeting.id, type: 'MEETING' as const, title: meeting.title, date: meeting.date, time: meeting.time, location: meeting.location, owner: meeting.attendees.join(', ') || 'Internal meeting', status: 'CONFIRMED' }))]);
    setEmployees((people as Array<{ id: number; name: string; role?: string }>).map((person) => ({ id: person.id, name: person.name, role: person.role })));
  }).catch(() => setEvents([])).finally(() => setLoading(false)); }, [canFilterPeople]);

  const visibleEvents = useMemo(() => events.filter((event) => (typeFilter === 'ALL' || event.type === typeFilter) && (filter === 'all' || filter === 'mine' || event.owner === employees.find((employee) => String(employee.id) === filter)?.name)), [events, filter, typeFilter, employees]);
  const dayEvents = visibleEvents.filter((event) => event.date === selectedDate || (event.endDate && selectedDate >= event.date && selectedDate <= event.endDate)).sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  const popupEvents = datePopup ? visibleEvents.filter((event) => event.date === datePopup || (event.endDate && datePopup >= event.date && datePopup <= event.endDate)).sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')) : [];
  const days = buildMonthDays(month);
  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const availability = (date: string) => { const count = visibleEvents.filter((event) => event.date === date || (event.endDate && date >= event.date && date <= event.endDate)).length; return count >= 3 ? 'full' : count > 0 ? 'half' : 'open'; };
  const today = isoDate(new Date());
  useEffect(() => {
    document.querySelectorAll('.bg-emerald-300').forEach((element) => element.setAttribute('hidden', 'true'));
    document.querySelectorAll('.calendar-module section>div>div:last-child>div:first-child, .calendar-widget-compact section>div>div:last-child>div:first-child').forEach((element) => {
      (element as HTMLElement).style.display = datePopup && (element.closest('.calendar-module') != null) ? 'flex' : 'none';
    });
    document.querySelectorAll('.calendar-module section>div').forEach((element) => {
      const layout = element as HTMLElement;
      layout.style.display = 'block';
      const panes = Array.from(layout.children) as HTMLElement[];
      if (panes[0]) panes[0].style.borderRight = '0';
      if (panes[1]) {
        panes[1].style.display = datePopup ? 'block' : 'none';
        const detailHeader = panes[1].firstElementChild as HTMLElement | null;
        if (detailHeader) {
          detailHeader.style.display = datePopup ? 'flex' : 'none';
          const existingClose = detailHeader.querySelector('[data-calendar-popup-close]');
          if (datePopup && !existingClose) {
            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.dataset.calendarPopupClose = 'true';
            closeButton.textContent = 'Close';
            closeButton.className = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50';
            closeButton.addEventListener('click', () => setDatePopup(null));
            detailHeader.appendChild(closeButton);
          }
          if (!datePopup && existingClose) existingClose.remove();
        }
        if (datePopup) {
          panes[1].style.position = 'fixed';
          panes[1].style.left = '50%';
          panes[1].style.top = '50%';
          panes[1].style.zIndex = '40';
          panes[1].style.width = 'min(420px, calc(100vw - 32px))';
          panes[1].style.maxHeight = 'min(620px, calc(100vh - 32px))';
          panes[1].style.overflowY = 'auto';
          panes[1].style.transform = 'translate(-50%, -50%)';
          panes[1].style.border = '1px solid #e2e8f0';
          panes[1].style.borderRadius = '24px';
          panes[1].style.boxShadow = '0 24px 70px -30px rgba(15, 23, 42, .45)';
        } else {
          panes[1].style.position = '';
          panes[1].style.left = '';
          panes[1].style.top = '';
          panes[1].style.zIndex = '';
          panes[1].style.width = '';
          panes[1].style.maxHeight = '';
          panes[1].style.overflowY = '';
          panes[1].style.transform = '';
          panes[1].style.border = '';
          panes[1].style.borderRadius = '';
          panes[1].style.boxShadow = '';
        }
      }
    });
    document.querySelectorAll('.calendar-module section button.bg-slate-950, .calendar-widget-compact section button.bg-slate-950').forEach((element) => {
      const button = element as HTMLElement;
      button.style.backgroundColor = 'transparent';
      button.style.boxShadow = 'none';
      button.style.color = '#0f172a';
      button.querySelectorAll('.text-white').forEach((child) => ((child as HTMLElement).style.color = '#0f172a'));
    });
    const dateButtons = Array.from(document.querySelectorAll('.calendar-module section .grid.grid-cols-7 button'));
    const cleanups = dateButtons.map((button, index) => {
      const day = days.filter((candidate): candidate is Date => Boolean(candidate))[index];
      if (!day) return () => undefined;
      const value = isoDate(day);
      const openPopup = () => {
        setSelectedDate(value);
        setDatePopup(value);
      };
      button.addEventListener('click', openPopup);
      return () => button.removeEventListener('click', openPopup);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [datePopup, days, events, selectedDate]);

  return <div className={`${compact ? 'calendar-widget-compact' : 'calendar-module'} bg-[#f8f7f4] text-slate-900 ${compact ? 'p-0' : 'p-4 sm:p-6 lg:p-8'}`}><style jsx>{`.label{display:block;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:7px}.section-label{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#94a3b8}.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:11px 12px;font-size:14px;outline:none}.field:focus{border-color:#94a3b8;box-shadow:0 0 0 3px #f1f5f9}.action-button{display:inline-flex;align-items:center;gap:7px;border-radius:12px;padding:10px 13px;font-size:12px;font-weight:700;transition:filter .2s,transform .2s}.action-button:hover{filter:brightness(.98);transform:translateY(-1px)}.icon-button{display:inline-flex;height:34px;width:34px;align-items:center;justify-content:center;border-radius:10px;color:#64748b}.icon-button:hover{background:#f1f5f9;color:#0f172a}.legend-dot{display:inline-block;height:7px;width:7px;border-radius:999px;margin-right:6px}.calendar-module main{max-width:1180px;margin-left:auto;margin-right:auto}.calendar-module section{border-radius:24px}.calendar-module section>div{grid-template-columns:1fr 1fr}.calendar-widget-compact{width:936px;height:420px;overflow:hidden}.calendar-widget-compact header{display:none}.calendar-widget-compact main{margin-top:0;max-width:936px}.calendar-widget-compact main>div:first-child{display:none}.calendar-widget-compact section{width:936px;height:420px;border-radius:16px}.calendar-widget-compact section>div{display:grid;grid-template-columns:1fr 1fr}.calendar-widget-compact section>div>div{padding:10px;min-width:0}.calendar-widget-compact section>div>div:last-child{display:block;min-height:0;overflow:hidden}.calendar-widget-compact section>div>div:first-child{border-right:1px solid #e2e8f0}.calendar-widget-compact section>div>div:first-child>div:last-child{display:none}.calendar-widget-compact section .grid.grid-cols-7 button{min-height:22px;padding:2px;border-radius:8px}.calendar-widget-compact section .grid.grid-cols-7{gap:1px}.calendar-widget-compact .calendar-section-title{font-size:13px}.calendar-widget-compact section h2{font-size:13px}.calendar-widget-compact section p{font-size:8px}.calendar-widget-compact section>div>div:last-child p{font-size:10px}.calendar-widget-compact section .text-sm{font-size:10px}.calendar-widget-compact section>div>div:last-child .mt-7{margin-top:12px}.calendar-widget-compact section>div>div:last-child .min-h-\[520px\]{min-height:0}`}</style>
    <header className="mx-auto flex max-w-[1440px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Workspace / Planning</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Calendar</h1><p className="mt-1 text-sm text-slate-500">A clear view of shoots, meetings, and deadlines.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => router.push('/dashboard/tasks?create=shoot')} className="action-button bg-[#c9795c] text-white"><Plus className="h-4 w-4" /> New shoot</button><button onClick={() => setDialog('MEETING')} className="action-button border border-[#bfd2c5] bg-[#f3f8f4] text-[#496554]"><Plus className="h-4 w-4" /> New meeting</button><button onClick={() => router.push('/dashboard/tasks?create=task')} className="action-button border border-[#ead9a8] bg-[#fffaf0] text-[#80661f]"><Plus className="h-4 w-4" /> New task</button></div></header>
    <main className="mx-auto mt-6 max-w-[1440px]"><div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2">{(['ALL', 'SHOOT', 'MEETING', 'TASK'] as const).map((type) => <button key={type} onClick={() => setTypeFilter(type)} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${typeFilter === type ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{type === 'ALL' ? 'All items' : EVENT_STYLES[type].label}</button>)}</div><div className="flex flex-wrap gap-2">{canFilterPeople ? <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><option value="mine">My calendar</option><option value="all">Everyone</option>{employees.map((employee) => <option key={employee.id} value={String(employee.id)}>{employee.name}{employee.role ? ` · ${employee.role}` : ''}</option>)}</select> : null}</div></div>
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_-40px_rgba(15,23,42,.35)]"><div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]"><div className="border-b border-slate-200 p-5 sm:p-7 lg:border-b-0 lg:border-r"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Availability overview</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{monthLabel}</h2></div><div className="flex gap-1"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="icon-button" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="icon-button" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button></div></div><div className="mt-6 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => <div key={day} className="pb-3">{day}</div>)}</div><div className="grid grid-cols-7 gap-1">{days.map((day, index) => { if (!day) return <div key={`empty-${index}`} className="min-h-[74px]" />; const value = isoDate(day); const state = availability(value); const selected = value === selectedDate; const isToday = value === today; return <button key={value} onClick={() => setSelectedDate(value)} className={`relative min-h-[74px] rounded-2xl p-2 text-left transition hover:bg-slate-50 ${selected ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-800'}`}><span className={`text-sm font-semibold ${selected ? 'text-white' : ''}`}>{day.getDate()}</span>{isToday && !selected ? <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-slate-950" /> : null}<span className={`absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full ${state === 'full' ? 'bg-rose-500' : state === 'half' ? 'bg-amber-400' : 'bg-emerald-300'}`} />{visibleEvents.filter((event) => event.date === value).slice(0, 2).map((event) => <span key={event.id} className={`absolute right-2 h-1.5 w-1.5 rounded-full ${EVENT_STYLES[event.type].dot}`} style={{ bottom: `${8 + (visibleEvents.filter((item) => item.date === value).indexOf(event) * 7)}px` }} />)}</button>; })}</div><div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-[11px] text-slate-500"><span><i className="legend-dot bg-rose-500" /> Full day unavailable</span><span><i className="legend-dot bg-amber-400" /> Partially booked</span><span><i className="legend-dot bg-emerald-300" /> Available</span></div></div><div className="min-h-[520px] bg-[#fcfcfb] p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Selected day</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{formatLongDate(selectedDate)}</h2><p className="mt-1 text-sm text-slate-500">{dayEvents.length} item{dayEvents.length === 1 ? '' : 's'} scheduled</p></div><CalendarDays className="h-5 w-5 text-slate-400" /></div><div className="mt-7">{loading ? <div className="space-y-3">{[1,2,3].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div> : dayEvents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center"><p className="text-sm font-semibold text-slate-700">A clear day</p><p className="mt-1 text-sm text-slate-500">Use one of the quick actions to add something here.</p></div> : <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[9px] before:top-4 before:w-px before:bg-slate-200">{dayEvents.map((event) => <div key={event.id} className="relative flex gap-4"><div className={`mt-5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-[#fcfcfb] ${EVENT_STYLES[event.type].dot}`} /><div className={`flex-1 rounded-2xl border p-4 ${EVENT_STYLES[event.type].border} ${EVENT_STYLES[event.type].soft}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{EVENT_STYLES[event.type].label.slice(0, -1)}</p><h3 className="mt-1 text-sm font-semibold text-slate-900">{event.title}</h3></div>{event.status ? <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{event.status.replaceAll('_', ' ')}</span> : null}</div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">{event.time ? <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{event.time}</span> : null}{event.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{event.location}</span> : null}{event.owner ? <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{event.owner}</span> : null}</div>{event.sourceHref ? <Link href={event.sourceHref} className="mt-3 inline-block text-xs font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4">Open source form</Link> : null}</div></div>)}</div>}</div></div></div></section></main>{dialog ? <NewEventDialog type={dialog} onClose={() => setDialog(null)} onCreated={(event) => { setEvents((current) => [...current, event]); setSelectedDate(event.date); setMonth(startOfMonth(new Date(`${event.date}T12:00:00`))); }} employeeOptions={employees.map(({ id, name }) => ({ id, name }))} /> : null}</div>;
}
