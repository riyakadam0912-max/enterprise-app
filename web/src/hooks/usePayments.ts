'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getPayments, createPayment, getInvoicePayments,
  Payment, InvoicePaymentSummary, CreatePaymentPayload,
} from '@/api/paymentsApi';

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true); setError(null);
    try { setPayments(await getPayments()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to fetch payments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  return { payments, loading, error, refetch: fetchPayments };
}

export function useInvoicePayments(invoiceId: number) {
  const [data, setData]     = useState<InvoicePaymentSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(invoiceId));
  const [error, setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true); setError(null);
    try { setData(await getInvoicePayments(invoiceId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to fetch invoice payments'); }
    finally { setLoading(false); }
  }, [invoiceId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export async function addPayment(payload: CreatePaymentPayload) { return createPayment(payload); }
