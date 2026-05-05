'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteLeaveRequest,
  getLeaveRequests,
  hrApproveLeaveRequest,
  LeaveRequest,
  managerApproveLeaveRequest,
  rejectLeaveRequest,
} from '../../../src/api/leaveRequestsApi';
import TableActions from '@/components/common/TableActions';

const STATUS_COLORS: Record<string, string> = {
  PENDING_MANAGER: 'bg-amber-100 text-amber-700',
  PENDING_HR: 'bg-sky-100 text-sky-700',
  APPROVED: 'bg-purple-500 text-white',
  REJECTED: 'bg-red-500 text-white',
  CANCELLED: 'bg-slate-200 text-slate-700',
};

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function capitalize(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function prettyStatus(s: string) {
  return s
    .toLowerCase()
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function getLatestTrailText(req: LeaveRequest) {
  const latest = req.approvalTrail?.[req.approvalTrail.length - 1];
  if (!latest) return null;

  const label = latest.action.replaceAll('_', ' ').toLowerCase();
  return latest.reason ? `${label}: ${latest.reason}` : label;
}

export default function AllRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const role = typeof window !== 'undefined' ? (localStorage.getItem('role') ?? 'EMPLOYEE') : 'EMPLOYEE';
  const canManagerApprove = role === 'MANAGER' || role === 'ADMIN';
  const canHrApprove = role === 'HR' || role === 'ADMIN';

  useEffect(() => {
    getLeaveRequests()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this leave request?')) return;
    await deleteLeaveRequest(id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const filtered = requests.filter((r) =>
    (r.employee?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    r.leaveType.toLowerCase().includes(search.toLowerCase())
  );

  async function handleManagerApprove(id: number) {
    setActionLoadingId(id);
    try {
      await managerApproveLeaveRequest(id);
      setRequests(await getLeaveRequests());
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleHrApprove(id: number) {
    setActionLoadingId(id);
    try {
      await hrApproveLeaveRequest(id);
      setRequests(await getLeaveRequests());
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReject(id: number) {
    const reason = prompt('Rejection reason (optional):') ?? undefined;
    setActionLoadingId(id);
    try {
      await rejectLeaveRequest(id, reason);
      setRequests(await getLeaveRequests());
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-semibold text-gray-800">All Requests</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-orange-400 w-40"
            />
          </div>

          <button
            onClick={() => router.push('/dashboard/requests/add')}
            className="w-7 h-7 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white rounded text-lg leading-none font-bold"
            title="Add Request"
          >
            +
          </button>
          <TableActions moduleKey="requests" rows={filtered} onRefresh={() => getLeaveRequests().then(setRequests)} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">Loading requests…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-medium">Employee</th>
                  <th className="px-4 py-3 text-left font-medium">Start Date</th>
                  <th className="px-4 py-3 text-left font-medium">End Date</th>
                  <th className="px-4 py-3 text-left font-medium">Leave Type</th>
                  <th className="px-4 py-3 text-left font-medium">Reason</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Applied On</th>
                  <th className="px-4 py-3 text-left font-medium">Approved By</th>
                  <th className="px-4 py-3 text-left font-medium w-56">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-gray-400 text-sm">
                      No leave requests found
                    </td>
                  </tr>
                ) : (
                  filtered.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {req.employee?.name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(req.startDate)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(req.endDate)}</td>
                      <td className="px-4 py-3 text-gray-600">{capitalize(req.leaveType)}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-40 truncate">{req.reason ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {prettyStatus(req.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(req.appliedOn)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{req.approvedBy ?? '-'}</div>
                        {getLatestTrailText(req) && (
                          <div className="mt-1 text-[11px] text-gray-400">{getLatestTrailText(req)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {canManagerApprove && req.status === 'PENDING_MANAGER' && (
                            <button
                              onClick={() => handleManagerApprove(req.id)}
                              disabled={actionLoadingId === req.id}
                              className="text-xs rounded bg-blue-50 text-blue-700 px-2 py-1 hover:bg-blue-100 disabled:opacity-50"
                            >
                              Manager Approve
                            </button>
                          )}
                          {canHrApprove && req.status === 'PENDING_HR' && (
                            <button
                              onClick={() => handleHrApprove(req.id)}
                              disabled={actionLoadingId === req.id}
                              className="text-xs rounded bg-emerald-50 text-emerald-700 px-2 py-1 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              HR Approve
                            </button>
                          )}
                          {(canManagerApprove || canHrApprove) && !['APPROVED', 'REJECTED', 'CANCELLED'].includes(req.status) && (
                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={actionLoadingId === req.id}
                              className="text-xs rounded bg-rose-50 text-rose-700 px-2 py-1 hover:bg-rose-100 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(req.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {filtered.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
                Showing {filtered.length} of {requests.length}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
