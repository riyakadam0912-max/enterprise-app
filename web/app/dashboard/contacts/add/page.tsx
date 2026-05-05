'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createContact } from '@/api/contactsApi';

const LEAD_SOURCES    = ['Website', 'Referral', 'Social Media', 'Email Campaign', 'Cold Call', 'Trade Show', 'Other'];
const CONTACT_STATUSES = ['Active', 'On Hold', 'Inactive'];

const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400';

export default function AddContactPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    contactName:   '',
    email:         '',
    phoneNumber:   '',
    company:       '',
    jobTitle:      '',
    leadSource:    '',
    address:       '',
    website:       '',
    linkedin:      '',
    contactStatus: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(key: keyof typeof form, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contactName.trim()) { setError('Contact Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await createContact({
        contactName:   form.contactName.trim(),
        email:         form.email.trim()         || null,
        phoneNumber:   form.phoneNumber.trim()   || null,
        company:       form.company.trim()       || null,
        jobTitle:      form.jobTitle.trim()      || null,
        leadSource:    form.leadSource           || null,
        address:       form.address.trim()       || null,
        website:       form.website.trim()       || null,
        linkedin:      form.linkedin.trim()      || null,
        contactStatus: form.contactStatus        || null,
      });
      router.push('/dashboard/contacts');
    } catch {
      setError('Failed to create contact. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Contacts</h1>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* Contact Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
          <input
            className={field}
            value={form.contactName}
            onChange={(e) => set('contactName', e.target.value)}
            placeholder="First Name"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            className={field}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="email@example.com"
          />
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            className={field}
            value={form.phoneNumber}
            onChange={(e) => set('phoneNumber', e.target.value)}
            placeholder="81234 56789"
          />
        </div>

        {/* Company */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
          <input
            className={field}
            value={form.company}
            onChange={(e) => set('company', e.target.value)}
            placeholder="Company name"
          />
        </div>

        {/* Job Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
          <input
            className={field}
            value={form.jobTitle}
            onChange={(e) => set('jobTitle', e.target.value)}
            placeholder="Job title"
          />
        </div>

        {/* Lead Source */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lead Source</label>
          <select className={field} value={form.leadSource} onChange={(e) => set('leadSource', e.target.value)}>
            <option value="">-Select-</option>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            className={field}
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Address Line 1"
          />
        </div>

        {/* Website */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
          <input
            className={field}
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="https://"
          />
        </div>

        {/* LinkedIn */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
          <input
            className={field}
            value={form.linkedin}
            onChange={(e) => set('linkedin', e.target.value)}
            placeholder="https://"
          />
        </div>

        {/* Contact Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Status</label>
          <select className={field} value={form.contactStatus} onChange={(e) => set('contactStatus', e.target.value)}>
            <option value="">-Select-</option>
            {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
            onClick={() => setForm({ contactName:'', email:'', phoneNumber:'', company:'', jobTitle:'', leadSource:'', address:'', website:'', linkedin:'', contactStatus:'' })}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
