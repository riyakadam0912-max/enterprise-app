'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getLeadActivities, getDealActivities, getContactActivities,
  createActivity, Activity, CreateActivityPayload,
} from '@/api/activitiesApi';

export function useActivitiesByLead(leadId: number) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(Boolean(leadId));
  const [error, setError]           = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!leadId) return;
    setLoading(true); setError(null);
    try { setActivities(await getLeadActivities(leadId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to fetch activities'); }
    finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { activities, loading, error, refetch: fetch };
}

export function useActivitiesByDeal(dealId: number) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(Boolean(dealId));
  const [error, setError]           = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!dealId) return;
    setLoading(true); setError(null);
    try { setActivities(await getDealActivities(dealId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to fetch activities'); }
    finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { activities, loading, error, refetch: fetch };
}

export function useActivitiesByContact(contactId: number) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(Boolean(contactId));
  const [error, setError]           = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!contactId) return;
    setLoading(true); setError(null);
    try { setActivities(await getContactActivities(contactId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to fetch activities'); }
    finally { setLoading(false); }
  }, [contactId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { activities, loading, error, refetch: fetch };
}

export async function addActivity(data: CreateActivityPayload) { return createActivity(data); }
