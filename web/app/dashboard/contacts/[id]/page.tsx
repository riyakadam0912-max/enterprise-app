'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getContact, Contact } from '@/api/contactsApi';
import { getContactActivities, Activity } from '@/api/activitiesApi';
import ActivityTimeline from '@/components/activity/ActivityTimeline';

export default function ContactDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [contact, setContact] = useState<Contact | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getContact(id), getContactActivities(id)])
      .then(([contactData, activityData]) => {
        setContact(contactData);
        setActivities(activityData);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading contact...</div>;
  if (!contact) return <div className="p-6 text-sm text-red-500">Contact not found</div>;

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{contact.contactName}</h1>
            <p className="mt-1 text-sm text-slate-500">{contact.company ?? 'No company'}</p>
            <p className="text-sm text-slate-500">{contact.email ?? 'No email'}</p>
          </div>
          <Link
            href={`/dashboard/contacts/${id}/edit`}
            className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>

      <ActivityTimeline activities={activities} title="Contact Activity" />
    </div>
  );
}
