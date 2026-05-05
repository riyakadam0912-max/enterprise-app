'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getLeads,
  getLead,
  getLeadsByStatus,
  createLead,
  updateLead,
  deleteLead,
  Lead,
  CreateLeadPayload,
  UpdateLeadPayload,
} from '@/api/leadsApi';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLeads();
      setLeads(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return { leads, loading, error, refetch: fetchLeads };
}

export function useLead(id: number) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getLead(id)
      .then((data) => { if (!cancelled) { setLead(data); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : 'Failed to fetch lead'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id]);

  return { lead, loading, error };
}

export async function addLead(data: CreateLeadPayload) {
  return createLead(data);
}

export async function editLead(id: number, data: UpdateLeadPayload) {
  return updateLead(id, data);
}

export async function removeLead(id: number) {
  return deleteLead(id);
}

export function useLeadsByStatus() {
  const [grouped, setGrouped] = useState<Record<string, Lead[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrouped = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGrouped(await getLeadsByStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGrouped(); }, [fetchGrouped]);
  return { grouped, loading, error, refetch: fetchGrouped };
}

