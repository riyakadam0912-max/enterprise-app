'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getLeaveRequests, LeaveRequest, LeaveType } from '../../../../src/api/leaveRequestsApi';

const LEAVE_TYPE_COLUMNS: LeaveType[] = ['PAID', 'CASUAL', 'SICK', 'MEDICAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER'];

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  PAID: 'Paid',
  CASUAL: 'Casual',
  UNPAID: 'Unpaid',
  MATERNITY: 'Maternity',
  SICK:      'Sick',
  MEDICAL:   'Medical',
  PATERNITY: 'Paternity',
  OTHER:     'Other',
};

function EmptyIllustration({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-3">
      <svg width="52" height="52" viewBox="0 0 64 64" fill="none" className="mb-2">
        <rect x="10" y="14" width="44" height="36" rx="4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="18" y="22" width="28" height="3" rx="1.5" fill="#cbd5e1" />
        <rect x="18" y="29" width="20" height="3" rx="1.5" fill="#cbd5e1" />
        <circle cx="48" cy="48" r="10" fill="#fff" stroke="#ef4444" strokeWidth="2" />
        <path d="M44 48h8M48 44v8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" style={{ transform: 'rotate(45deg)', transformOrigin: '48px 48px' }} />
      </svg>
      <p className="text-xs text-orange-500 font-medium text-center">No Records in {label}</p>
    </div>
  );
}

export default function LeaveTypesPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAsOpen, setShowAsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getLeaveRequests()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowAsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const grouped: Record<LeaveType, LeaveRequest[]> = Object.fromEntries(
    LEAVE_TYPE_COLUMNS.map((t) => [t, requests.filter((r) => r.leaveType === t)])
  ) as Record<LeaveType, LeaveRequest[]>;

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-semibold text-gray-800">Leave Types</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/requests/add')}
            className="w-7 h-7 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white rounded text-lg leading-none font-bold"
            title="Add Leave Request"
          >
            +
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => { setMenuOpen((v) => !v); setShowAsOpen(false); }}
              className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
            >
              ···
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 w-44 bg-white border border-gray-200 rounded shadow-lg z-50 py-1 text-sm">
                <div
                  className="relative"
                  onMouseEnter={() => setShowAsOpen(true)}
                  onMouseLeave={() => setShowAsOpen(false)}
                >
                  <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center justify-between">
                    Show As <span className="text-gray-400">›</span>
                  </button>
                  {showAsOpen && (
                    <div className="absolute right-full top-0 w-36 bg-white border border-gray-200 rounded shadow-lg py-1 text-sm">
                      {['List', 'Calendar', 'Timeline', 'Spreadsheet', 'Kanban'].map((opt) => (
                        <button
                          key={opt}
                          className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center justify-between ${opt === 'Kanban' ? 'text-orange-600 font-medium' : ''}`}
                        >
                          {opt} {opt === 'Kanban' && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <hr className="my-1 border-gray-100" />
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50">Print</button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50">Import</button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50">Export</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading…
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {LEAVE_TYPE_COLUMNS.map((leaveType) => {
            const cards = grouped[leaveType];
            return (
              <div
                key={leaveType}
                className="flex-none w-52 bg-gray-50 border border-gray-200 rounded-lg flex flex-col"
              >
                {/* Column header — orange left border like Zoho */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 border-l-4 border-l-orange-400 rounded-t-lg">
                  <span className="text-xs font-semibold text-gray-700">
                    {LEAVE_TYPE_LABELS[leaveType]}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5 font-medium">
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 min-h-24">
                  {cards.length === 0 ? (
                    <EmptyIllustration label={LEAVE_TYPE_LABELS[leaveType]} />
                  ) : (
                    cards.map((req) => (
                      <div
                        key={req.id}
                        className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => router.push('/dashboard/requests')}
                      >
                        <p className="text-sm font-medium text-gray-800 leading-tight mb-1">
                          {req.employee?.name ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(req.startDate).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                          {' – '}
                          {new Date(req.endDate).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </p>
                        {req.reason && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{req.reason}</p>
                        )}
                      </div>
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
