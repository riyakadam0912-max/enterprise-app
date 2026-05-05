'use client';

import React, { useState } from 'react';
import { useMyPayslips, usePayslipDetails } from '@/hooks/useEss';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ESSPayslipsPage() {
  const { data: payslips, loading: payslipsLoading } = useMyPayslips();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedPayslipId, setSelectedPayslipId] = useState<number | null>(null);
  const { data: payslipDetails, loading: detailsLoading } = usePayslipDetails(selectedPayslipId);

  const handleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setSelectedPayslipId(null);
    } else {
      setExpandedId(id);
      setSelectedPayslipId(id);
    }
  };

  const handleDownload = (id: number) => {
    // Generate PDF or download functionality
    console.log('Download payslip:', id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900">My Payslips</h1>
          <p className="text-gray-600 text-sm mt-1">View and download your monthly payslips</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {payslipsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 h-24 animate-pulse"></div>
            ))}
          </div>
        ) : payslips && payslips.length > 0 ? (
          <div className="space-y-4">
            {payslips.map((payslip) => (
              <div
                key={payslip.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                {/* Summary Row */}
                <div
                  onClick={() => handleExpand(payslip.id)}
                  className="p-6 cursor-pointer hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-100 rounded-lg px-4 py-2">
                          <p className="text-sm font-semibold text-blue-900">
                            {months[payslip.month - 1]} {payslip.year}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Net Salary</p>
                          <p className="text-2xl font-bold text-gray-900">
                            ₹{(payslip.netPay || 0).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Status</p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          payslip.status === 'PAID'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {payslip.status}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(payslip.id);
                        }}
                        className="p-2 rounded-lg hover:bg-blue-100 text-blue-600"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      {expandedId === payslip.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Details Row */}
                {expandedId === payslip.id && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    {detailsLoading ? (
                      <div className="animate-pulse space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-6 bg-gray-200 rounded"></div>
                        ))}
                      </div>
                    ) : payslipDetails ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Earnings */}
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-4">Earnings</h3>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Basic Salary</span>
                              <span className="font-medium text-gray-900">
                                ₹{(payslipDetails.earnings.basic || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">HRA</span>
                              <span className="font-medium text-gray-900">
                                ₹{(payslipDetails.earnings.hra || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Allowances</span>
                              <span className="font-medium text-gray-900">
                                ₹{(payslipDetails.earnings.allowances || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                            {payslipDetails.earnings.bonus > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Bonus</span>
                                <span className="font-medium text-green-600">
                                  +₹{(payslipDetails.earnings.bonus || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                            {payslipDetails.earnings.overtime > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Overtime</span>
                                <span className="font-medium text-green-600">
                                  +₹{(payslipDetails.earnings.overtime || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                            <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
                              <span>Gross Earnings</span>
                              <span className="text-gray-900">
                                ₹{(payslipDetails.earnings.total || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Deductions */}
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-4">Deductions</h3>
                          <div className="space-y-3 text-sm">
                            {payslipDetails.deductions.pf > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Provident Fund</span>
                                <span className="font-medium text-red-600">
                                  -₹{(payslipDetails.deductions.pf || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                            {payslipDetails.deductions.esi > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">ESI</span>
                                <span className="font-medium text-red-600">
                                  -₹{(payslipDetails.deductions.esi || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                            {payslipDetails.deductions.professionalTax > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Professional Tax</span>
                                <span className="font-medium text-red-600">
                                  -₹{(payslipDetails.deductions.professionalTax || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                            {payslipDetails.deductions.tds > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">TDS</span>
                                <span className="font-medium text-red-600">
                                  -₹{(payslipDetails.deductions.tds || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                            {payslipDetails.deductions.lossOfPay > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Loss of Pay</span>
                                <span className="font-medium text-red-600">
                                  -₹{(payslipDetails.deductions.lossOfPay || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                            {payslipDetails.deductions.lateMarkPenalty > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Late Mark Penalty</span>
                                <span className="font-medium text-red-600">
                                  -₹{(payslipDetails.deductions.lateMarkPenalty || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                            <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
                              <span>Total Deductions</span>
                              <span className="text-red-600">
                                -₹{(payslipDetails.deductions.total || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Attendance Info */}
                    {payslipDetails && (
                      <div className="mt-6 pt-6 border-t border-gray-300">
                        <h3 className="font-semibold text-gray-900 mb-4">Attendance Summary</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="bg-white rounded p-3">
                            <p className="text-gray-600">Working Days</p>
                            <p className="font-bold text-gray-900">{payslipDetails.attendance.workingDays}</p>
                          </div>
                          <div className="bg-white rounded p-3">
                            <p className="text-gray-600">Present Days</p>
                            <p className="font-bold text-green-600">{payslipDetails.attendance.presentDays}</p>
                          </div>
                          <div className="bg-white rounded p-3">
                            <p className="text-gray-600">Late Count</p>
                            <p className="font-bold text-yellow-600">{payslipDetails.attendance.lateCount}</p>
                          </div>
                          <div className="bg-white rounded p-3">
                            <p className="text-gray-600">Overtime Hours</p>
                            <p className="font-bold text-purple-600">
                              {payslipDetails.attendance.overtimeHours.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600">No payslips available yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
