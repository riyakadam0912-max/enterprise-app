'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getContacts, deleteContact, Contact } from '@/api/contactsApi';
import TableActions from '@/components/common/TableActions';

export default function AllContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    getContacts().then(setContacts).finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm('Delete this contact?')) return;
    await deleteContact(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">All Contacts</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/contacts/add')}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Add Contact
          </button>
          <TableActions moduleKey="contacts" rows={contacts} onRefresh={() => getContacts().then(setContacts)} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Contact Name','Email','Phone Number','Company','Job Title','Lead Source','Address','Website','LinkedIn','Contact Status',''].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">No contacts found</td></tr>
            ) : contacts.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{c.contactName}</td>
                <td className="px-4 py-3 text-orange-500 whitespace-nowrap">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{c.phoneNumber ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{c.company ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{c.jobTitle ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{c.leadSource ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700">
                  {c.address ? (
                    <span className="flex items-center gap-1">
                      <span className="text-orange-500">📍</span>
                      {c.address}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {c.website ? (
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{c.website}</a>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {c.linkedin ? (
                    <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{c.linkedin}</a>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{c.contactStatus ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex gap-2">
                    <Link href={`/dashboard/contacts/${c.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                    <Link href={`/dashboard/contacts/${c.id}/edit`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                    <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
          Showing {contacts.length} of {contacts.length}
        </div>
      </div>
    </div>
  );
}
