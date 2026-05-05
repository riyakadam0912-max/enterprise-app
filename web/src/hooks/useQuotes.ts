import { useState, useEffect, useCallback } from 'react';
import {
  getQuotes, getQuote, createQuote, updateQuote, deleteQuote, convertQuoteToInvoice,
  Quote, CreateQuotePayload, UpdateQuotePayload,
} from '../api/quotesApi';

export function useQuotes() {
  const [data, setData]       = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try   { setData(await getQuotes()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export function useQuote(id: number | null) {
  const [data, setData]       = useState<Quote | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getQuote(id)
      .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch((e: unknown) => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Error'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id]);

  return { data, loading, error };
}

export function useCreateQuote() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const create = useCallback(async (payload: CreateQuotePayload) => {
    setLoading(true);
    setError(null);
    try   { return await createQuote(payload); }
    catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Error'; setError(msg); throw new Error(msg); }
    finally { setLoading(false); }
  }, []);

  return { create, loading, error };
}

export function useUpdateQuote() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const update = useCallback(async (id: number, payload: UpdateQuotePayload) => {
    setLoading(true);
    setError(null);
    try   { return await updateQuote(id, payload); }
    catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Error'; setError(msg); throw new Error(msg); }
    finally { setLoading(false); }
  }, []);

  return { update, loading, error };
}

export function useDeleteQuote() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const remove = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try   { await deleteQuote(id); }
    catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Error'; setError(msg); throw new Error(msg); }
    finally { setLoading(false); }
  }, []);

  return { remove, loading, error };
}

export function useConvertQuoteToInvoice() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const convert = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try   { return await convertQuoteToInvoice(id); }
    catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Error'; setError(msg); throw new Error(msg); }
    finally { setLoading(false); }
  }, []);

  return { convert, loading, error };
}
