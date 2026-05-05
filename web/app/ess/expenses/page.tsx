'use client';

import React, { useState } from 'react';
import { useMyExpenses, useSubmitExpense } from '@/hooks/useEss';
import { formatDate } from '@/utils/dateUtils';
import { AlertCircle, CheckCircle, Plus } from 'lucide-react';

export default function ESSExpensesPage() {
  const { data: expenses, loading: expensesLoading, refetch: refetchExpenses } = useMyExpenses();
  const { submit, loading: submitLoading } = useSubmitExpense();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    category: 'Travel',
    description: '',
    expenseDate: new Date().toISOString().split('T')[0],
    currency: 'INR',
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }

    return 'An unexpected error occurred.';
  };

  const categories = ['Travel', 'Food', 'Accommodation', 'Office Supplies', 'Other'];

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount) {
      setErrorMsg('Please enter an amount');
      setShowError(true);
      return;
    }

    try {
      await submit({
        amount: parseFloat(formData.amount),
        category: formData.category,
        description: formData.description,
        expenseDate: formData.expenseDate,
        currency: formData.currency,
      });

      setShowSuccess(true);
      setShowForm(false);
      setFormData({
        amount: '',
        category: 'Travel',
        description: '',
        expenseDate: new Date().toISOString().split('T')[0],
        currency: 'INR',
      });
      refetchExpenses();

      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err));
      setShowError(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Expense Claims</h1>
          <p className="text-gray-600 text-sm mt-1">Submit and track your expense reimbursements</p>
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
              <p className="text-green-700 text-sm">Expense submitted successfully</p>
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

        {/* Submit Button */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="mb-8 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Submit New Expense
          </button>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Submit Expense</h2>

            <form onSubmit={handleSubmitExpense} className="space-y-6">
              {/* Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="Enter amount"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  >
                    <option>INR</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Expense Date
                </label>
                <input
                  type="date"
                  value={formData.expenseDate}
                  onChange={(e) =>
                    setFormData({ ...formData, expenseDate: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Describe the expense..."
                />
              </div>

              {/* Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> You can upload receipt image when submitting from the desktop app.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium disabled:bg-gray-300 hover:bg-blue-700"
                >
                  {submitLoading ? 'Submitting...' : 'Submit Expense'}
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

        {/* Expenses List */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">My Expenses</h2>

          {expensesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          ) : expenses && expenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Category</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Description</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {formatDate(new Date(expense.date))}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {expense.category}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {expense.description}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        ₹{(expense.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                          {expense.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-600 py-8">No expenses submitted yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
