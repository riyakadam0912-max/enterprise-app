'use client';

import React, { useState } from 'react';
import { useLeaveHistory, useLeaveBalance, useApplyLeave } from '@/hooks/useEss';
import { formatDate } from '@/utils/dateUtils';
import { Calendar, AlertCircle, CheckCircle } from 'lucide-react';

export default function ESSLeavePage() {
  const { data: history, loading: historyLoading, refetch: refetchHistory } = useLeaveHistory();
  const { data: balance, loading: balanceLoading, refetch: refetchBalance } = useLeaveBalance();
  const { apply, loading: applyLoading } = useApplyLeave();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    leaveType: 'Casual',
    reason: '',
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }

    return 'An unexpected error occurred.';
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.startDate || !formData.endDate) {
      setErrorMsg('Please select both start and end dates');
      setShowError(true);
      return;
    }

    try {
      await apply({
        startDate: formData.startDate,
        endDate: formData.endDate,
        leaveType: formData.leaveType,
        reason: formData.reason,
      });

      setSuccessMsg('Leave request submitted successfully.');
      setShowSuccess(true);
      setShowForm(false);
      setFormData({
        startDate: '',
        endDate: '',
        leaveType: 'Casual',
        reason: '',
      });

      refetchHistory();
      refetchBalance();

      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err));
      setShowError(true);
    }
  };

  const leaveTypes = ['Casual', 'Sick', 'Paid', 'Unpaid', 'Maternity', 'Paternity'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-gray-600 text-sm mt-1">Apply for leave and track your leave balance</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Alerts */}
        {showSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">Success</p>
              <p className="text-green-700 text-sm">{successMsg}</p>
            </div>
          </div>
        )}

        {showError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-700 text-sm">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Leave Balance */}
        {balanceLoading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse h-32 mb-8"></div>
        ) : balance && (
          <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white rounded-lg p-8 mb-8">
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-blue-100 text-sm uppercase mb-2">Available Balance</p>
                <p className="text-4xl font-bold">{balance.balance}</p>
                <p className="text-blue-100 text-xs mt-2">days / {balance.year}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm uppercase mb-2">Total Allocated</p>
                <p className="text-4xl font-bold">{balance.totalAllocation}</p>
                <p className="text-blue-100 text-xs mt-2">days per year</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm uppercase mb-2">Days Used</p>
                <p className="text-4xl font-bold">{balance.daysTaken}</p>
                <p className="text-blue-100 text-xs mt-2">days taken</p>
              </div>
            </div>
          </div>
        )}

        {/* Apply Leave Form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="mb-8 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Calendar className="w-5 h-5" />
            Apply for Leave
          </button>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Apply for Leave</h2>

            <form onSubmit={handleSubmitLeave} className="space-y-6">
              {/* Leave Type */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Leave Type
                </label>
                <select
                  value={formData.leaveType}
                  onChange={(e) =>
                    setFormData({ ...formData, leaveType: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  {leaveTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Tell us why you need this leave..."
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={applyLoading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium disabled:bg-gray-300 hover:bg-blue-700"
                >
                  {applyLoading ? 'Submitting...' : 'Submit Leave Application'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-200 text-gray-900 py-2 px-4 rounded-lg font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Leave History */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Leave History</h2>

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
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Leave Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">From Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">To Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Days</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {history.map((leave, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {leave.leaveType}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(new Date(leave.startDate))}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(new Date(leave.endDate))}
                      </td>
                      <td className="px-4 py-3 font-medium">{leave.days}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          leave.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : leave.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {leave.reason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-600 py-8">No leave applications found</p>
          )}
        </div>
      </div>
    </div>
  );
}
