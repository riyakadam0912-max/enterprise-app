import { useState, useEffect, useCallback } from 'react';
import {
  getDeals, getDeal, createDeal, updateDeal, deleteDeal, getPipeline,
  Deal, Pipeline, CreateDealPayload, UpdateDealPayload,
} from '../api/dealsApi';

// ── useDeals ──────────────────────────────────────────────────────────────────
export function useDeals() {
  const [data, setData]       = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try   { setData(await getDeals()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

// ── useDeal ───────────────────────────────────────────────────────────────────
export function useDeal(id: number | null) {
  const [data, setData]       = useState<Deal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getDeal(id)
      .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch((e: unknown) => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Error'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id]);

  return { data, loading, error };
}

// ── useCreateDeal ─────────────────────────────────────────────────────────────
export function useCreateDeal() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const create = useCallback(async (payload: CreateDealPayload) => {
    setLoading(true);
    setError(null);
    try   { return await createDeal(payload); }
    catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Error'; setError(msg); throw new Error(msg); }
    finally { setLoading(false); }
  }, []);

  return { create, loading, error };
}

// ── useUpdateDeal ─────────────────────────────────────────────────────────────
export function useUpdateDeal() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const update = useCallback(async (id: number, payload: UpdateDealPayload) => {
    setLoading(true);
    setError(null);
    try   { return await updateDeal(id, payload); }
    catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Error'; setError(msg); throw new Error(msg); }
    finally { setLoading(false); }
  }, []);

  return { update, loading, error };
}

// ── useDeleteDeal ─────────────────────────────────────────────────────────────
export function useDeleteDeal() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const remove = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try   { await deleteDeal(id); }
    catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Error'; setError(msg); throw new Error(msg); }
    finally { setLoading(false); }
  }, []);

  return { remove, loading, error };
}

// ── usePipeline ───────────────────────────────────────────────────────────────
export function usePipeline() {
  const [data, setData]       = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try   { setData(await getPipeline()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}
