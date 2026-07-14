'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createExpense } from '@/api/expensesApi';
import { uploadFile, type ManagedFile } from '@/api/filesApi';
import { FormFileUpload } from '@/components/forms/FormFileUpload';
import { FormProvider, useForm } from 'react-hook-form';

const CATEGORIES = ['Office Supplies', 'Marketing', 'Utilities', 'Training', 'Travel', 'Other'];
const STATUSES   = ['PENDING', 'APPROVED', 'REJECTED'];

const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400';

export default function AddExpensePage() {
  const router = useRouter();
  const methods = useForm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadedReceipt, setUploadedReceipt] = useState<ManagedFile | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    try {
      let receiptImageUrl: string | undefined = undefined;
      if (receiptFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', receiptFile);
        uploadFormData.append('module', 'Expenses');
        uploadFormData.append('entityType', 'Expense');
        // We'll set entityId after we create the expense
        uploadFormData.append('category', 'Receipt');
        uploadFormData.append('isPublic', 'false');
        // We can't upload here because we don't have the expense ID yet, so we'll upload after creating the expense
      }
      const expense = await createExpense({
        expenseDate: formData.get('expenseDate') as string || undefined,
        category: formData.get('category') as string || undefined,
        description: (formData.get('description') as string).trim() || undefined,
        amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : undefined,
        currency: (formData.get('currency') as string).trim() || undefined,
        receiptImage: uploadedReceipt?.url || (formData.get('receiptImage') as string || undefined),
        approvedBy: (formData.get('approvedBy') as string).trim() || undefined,
        status: (formData.get('status') as string) || undefined,
      });
      
      // Now upload the receipt file if we have one
      if (receiptFile && expense.id) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', receiptFile);
        uploadFormData.append('module', 'Expenses');
        uploadFormData.append('entityType', 'Expense');
        uploadFormData.append('entityId', String(expense.id));
        uploadFormData.append('category', 'Receipt');
        uploadFormData.append('isPublic', 'false');
        const uploadedFile = await uploadFile(uploadFormData);
        setUploadedReceipt(uploadedFile);
      }

      router.push('/dashboard/expenses');
    } catch {
      setError('Failed to create expense. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Expenses</h1>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

          {/* Expense Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expense Date</label>
            <input
              type="date"
              name="expenseDate"
              className={`${field} border-orange-400`}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select name="category" className={field}>
              <option value="">-Select-</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              name="description"
              className={field}
              placeholder="Enter description"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="number"
              name="amount"
              min="0"
              step="0.01"
              className={field}
              placeholder="#######.##"
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input
              name="currency"
              className={field}
              defaultValue="INR"
              placeholder="INR"
            />
          </div>

          {/* Receipt Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Image</label>
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setReceiptFile(file);
                }}
                className={field}
              />
              {receiptFile && (
                <p className="text-sm text-gray-600">Selected: {receiptFile.name}</p>
              )}
              {uploadedReceipt && (
                <div>
                  <p className="text-sm text-green-700">Uploaded receipt: {uploadedReceipt.originalName}</p>
                  <a href={uploadedReceipt.downloadUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                    Download receipt
                  </a>
                </div>
              )}
              <input
                name="receiptImage"
                type="text"
                className={field}
                placeholder="Or enter image URL manually"
              />
            </div>
          </div>

          {/* Approved By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Approved By</label>
            <input
              name="approvedBy"
              className={field}
              placeholder="Approver name"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" className={field}>
              <option value="">-Select-</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => {
                methods.reset();
                setReceiptFile(null);
                setUploadedReceipt(null);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
