'use client';

import React, { useState } from 'react';
import { useAttendanceToday, useAttendanceHistory, useCheckIn, useCheckOut } from '@/hooks/useEss';
import { formatDate } from '@/utils/dateUtils';
import { AlertCircle, Clock } from 'lucide-react';

export default function ESSAttendancePage() {
  const { data: today, loading: todayLoading, refetch: refetchToday } = useAttendanceToday();
  const { data: history, loading: historyLoading } = useAttendanceHistory();
  const { checkIn, loading: checkInLoading } = useCheckIn();
  const { checkOut, loading: checkOutLoading } = useCheckOut();

  const [showError, setShowError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }

    return 'An unexpected error occurred.';
  };

  const handleCheckIn = async () => {
    try {
      await checkIn();
      setShowError(false);
      refetchToday();
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err));
      setShowError(true);
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOut();
      setShowError(false);
      refetchToday();
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err));
      setShowError(true);
    }
  };

  const isCheckedIn = today?.status === 'CHECKED_IN';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600 text-sm mt-1">Track your daily check-in and check-out</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Error Alert */}
        {showError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-700 text-sm">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Today's Status Card */}
        {todayLoading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse h-64"></div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Today&apos;s Attendance</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Status */}
              <div className="border-l-4 border-blue-600 pl-4">
                <p className="text-xs text-gray-600 uppercase mb-1">Status</p>
                <p className="text-2xl font-bold text-gray-900">
                  {today?.status === 'NOT_CHECKED_IN'
                    ? 'Not Checked In'
                    : today?.status === 'CHECKED_IN'
                    ? 'Checked In'
                    : 'Checked Out'}
                </p>
              </div>

              {/* Check-in Time */}
              {today?.checkIn && (
                <div className="border-l-4 border-green-600 pl-4">
                  <p className="text-xs text-gray-600 uppercase mb-1">Check-in Time</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {new Date(today.checkIn).toLocaleTimeString()}
                  </p>
                </div>
              )}

              {/* Check-out Time */}
              {today?.checkOut && (
                <div className="border-l-4 border-orange-600 pl-4">
                  <p className="text-xs text-gray-600 uppercase mb-1">Check-out Time</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {new Date(today.checkOut).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>

            {/* Additional Info */}
            {today && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pt-6 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-600 uppercase">Working Hours</p>
                  <p className="text-lg font-bold text-gray-900">
                    {(today.workingHours || 0).toFixed(2)} hrs
                  </p>
                </div>
                {today.lateMinutes !== undefined && today.lateMinutes > 0 && (
                  <div className="bg-yellow-50 rounded p-3">
                    <p className="text-xs text-yellow-800 uppercase">Late Minutes</p>
                    <p className="text-lg font-bold text-yellow-600">{today.lateMinutes} mins</p>
                  </div>
                )}
                {today.overtimeHours !== undefined && today.overtimeHours > 0 && (
                  <div className="bg-purple-50 rounded p-3">
                    <p className="text-xs text-purple-800 uppercase">Overtime</p>
                    <p className="text-lg font-bold text-purple-600">
                      {today.overtimeHours.toFixed(2)} hrs
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Shift Info */}
            {today?.shift && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Assigned Shift</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Name</p>
                    <p className="text-sm font-medium text-gray-900">{today.shift.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Start Time</p>
                    <p className="text-sm font-medium text-gray-900">{today.shift.startTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">End Time</p>
                    <p className="text-sm font-medium text-gray-900">{today.shift.endTime}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCheckIn}
                disabled={isCheckedIn || checkInLoading}
                className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium disabled:bg-gray-300 hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" />
                {checkInLoading ? 'Checking In...' : 'Check In'}
              </button>
              <button
                onClick={handleCheckOut}
                disabled={!isCheckedIn || checkOutLoading}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-medium disabled:bg-gray-300 hover:bg-red-700 flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" />
                {checkOutLoading ? 'Checking Out...' : 'Check Out'}
              </button>
            </div>
          </div>
        )}

        {/* Attendance History */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Attendance</h2>

          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          ) : history && history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Check-in</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Check-out</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Hours</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Late</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {history.map((record, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {formatDate(new Date(record.date))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          record.status === 'PRESENT'
                            ? 'bg-green-100 text-green-800'
                            : record.status === 'ABSENT'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {record.checkIn ? new Date(record.checkIn).toLocaleTimeString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {record.checkOut ? new Date(record.checkOut).toLocaleTimeString() : '-'}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {record.workingHours?.toFixed(2) || '-'} hrs
                      </td>
                      <td className="px-4 py-3">
                        {record.lateMinutes > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
                            {record.lateMinutes} mins
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-600 py-8">No attendance records found</p>
          )}
        </div>
      </div>
    </div>
  );
}
