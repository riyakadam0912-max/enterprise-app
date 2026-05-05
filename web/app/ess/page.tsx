'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMyProfile, useAttendanceToday, useLeaveBalance, useMyPayslips, useCheckIn, useCheckOut } from '@/hooks/useEss';
import { formatDate } from '@/utils/dateUtils';
import { AlertCircle, Clock, Briefcase, FileText, Receipt, ChevronRight } from 'lucide-react';

export default function ESSDashboardPage() {
  const router = useRouter();
  const { data: profile, loading: profileLoading } = useMyProfile();
  const { data: attendance, loading: attendanceLoading, refetch: refetchAttendance } = useAttendanceToday();
  const { data: leaveBalance } = useLeaveBalance();
  const { data: payslips } = useMyPayslips();
  const { checkIn, loading: checkInLoading } = useCheckIn();
  const { checkOut, loading: checkOutLoading } = useCheckOut();

  const [showCheckInError, setShowCheckInError] = useState(false);
  const [checkInErrorMsg, setCheckInErrorMsg] = useState('');

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }

    return 'An unexpected error occurred.';
  };

  const handleCheckIn = async () => {
    try {
      await checkIn();
      setShowCheckInError(false);
      refetchAttendance();
    } catch (err: unknown) {
      setCheckInErrorMsg(getErrorMessage(err));
      setShowCheckInError(true);
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOut();
      setShowCheckInError(false);
      refetchAttendance();
    } catch (err: unknown) {
      setCheckInErrorMsg(getErrorMessage(err));
      setShowCheckInError(true);
    }
  };

  const lastPayslip = payslips && payslips.length > 0 ? payslips[0] : null;
  const isCheckedIn = attendance?.status === 'CHECKED_IN';

  if (profileLoading || attendanceLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-200 rounded-lg h-32"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome, {profile?.name || 'Employee'}
              </h1>
              <p className="text-gray-600 mt-1">{formatDate(new Date())}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">{profile?.designation}</p>
              <p className="text-sm text-gray-500">{profile?.department}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Error Alert */}
        {showCheckInError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-700 text-sm">{checkInErrorMsg}</p>
            </div>
          </div>
        )}

        {/* Quick Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Today's Attendance */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Today&apos;s Attendance</h3>
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-600 uppercase">Status</p>
                <p className="text-lg font-bold text-gray-900">
                  {attendance?.status === 'NOT_CHECKED_IN'
                    ? 'Not Checked In'
                    : attendance?.status === 'CHECKED_IN'
                    ? 'Checked In'
                    : 'Checked Out'}
                </p>
              </div>
              {attendance?.checkIn && (
                <div>
                  <p className="text-xs text-gray-600">Check-in Time</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(attendance.checkIn).toLocaleTimeString()}
                  </p>
                </div>
              )}
              {attendance?.workingHours && (
                <div>
                  <p className="text-xs text-gray-600">Working Hours</p>
                  <p className="text-sm font-medium text-gray-900">
                    {attendance.workingHours.toFixed(2)} hrs
                  </p>
                </div>
              )}
              {attendance && attendance.lateMinutes && attendance.lateMinutes > 0 && (
                <div className="bg-yellow-50 rounded px-2 py-1">
                  <p className="text-xs text-yellow-800 font-medium">
                    Late: {attendance.lateMinutes} mins
                  </p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCheckIn}
                  disabled={isCheckedIn || checkInLoading}
                  className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm font-medium disabled:bg-gray-300 hover:bg-green-700"
                >
                  {checkInLoading ? 'Checking...' : 'Check In'}
                </button>
                <button
                  onClick={handleCheckOut}
                  disabled={!isCheckedIn || checkOutLoading}
                  className="flex-1 bg-red-600 text-white py-2 px-3 rounded text-sm font-medium disabled:bg-gray-300 hover:bg-red-700"
                >
                  {checkOutLoading ? 'Checking...' : 'Check Out'}
                </button>
              </div>
            </div>
          </div>

          {/* Leave Balance */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Leave Balance</h3>
              <Briefcase className="w-5 h-5 text-purple-600" />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-600 uppercase">Available Days</p>
                <p className="text-3xl font-bold text-purple-600">
                  {leaveBalance?.balance ?? 0}
                </p>
              </div>
              <div className="text-xs text-gray-600">
                <p>Total: {leaveBalance?.totalAllocation}</p>
                <p>Used: {leaveBalance?.daysTaken}</p>
              </div>
              <button
                onClick={() => router.push('/ess/leave')}
                className="w-full mt-3 bg-purple-50 text-purple-600 py-2 px-3 rounded text-sm font-medium hover:bg-purple-100"
              >
                Apply Leave
              </button>
            </div>
          </div>

          {/* Last Payslip */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Last Payslip</h3>
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            {lastPayslip ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 uppercase">Month/Year</p>
                  <p className="text-lg font-bold text-gray-900">
                    {lastPayslip.month}/{lastPayslip.year}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Net Salary</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₹{(lastPayslip.netPay || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <button
                  onClick={() => router.push('/ess/payslips')}
                  className="w-full mt-3 bg-green-50 text-green-600 py-2 px-3 rounded text-sm font-medium hover:bg-green-100"
                >
                  View All Payslips
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">No payslip available yet</p>
                <button
                  onClick={() => router.push('/ess/payslips')}
                  className="w-full mt-3 bg-green-50 text-green-600 py-2 px-3 rounded text-sm font-medium hover:bg-green-100"
                >
                  View Payslips
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Quick Actions</h3>
              <Receipt className="w-5 h-5 text-orange-600" />
            </div>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/ess/attendance')}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center justify-between text-sm"
              >
                <span className="text-gray-700">Attendance</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => router.push('/ess/expenses')}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center justify-between text-sm"
              >
                <span className="text-gray-700">Expenses</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => router.push('/ess/profile')}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center justify-between text-sm"
              >
                <span className="text-gray-700">My Profile</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Leaves */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Leave Applications
            </h2>
            <button
              onClick={() => router.push('/ess/leave')}
              className="text-blue-600 text-sm font-medium hover:text-blue-700"
            >
              View All
            </button>
          </div>

          {/* Recent Expenses */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Expense Claims
            </h2>
            <button
              onClick={() => router.push('/ess/expenses')}
              className="text-blue-600 text-sm font-medium hover:text-blue-700"
            >
              View All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
