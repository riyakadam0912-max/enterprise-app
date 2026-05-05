'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getDynamicForms,
  getDynamicForm,
  getDynamicFormsByTargetModule,
  createDynamicForm,
  updateDynamicForm,
  deleteDynamicForm,
  DynamicForm,
  CreateDynamicFormPayload,
  UpdateDynamicFormPayload,
} from '@/api/dynamicFormsApi';

export function useDynamicForms() {
  const [forms, setForms] = useState<DynamicForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setForms(await getDynamicForms());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch forms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { forms, loading, error, refetch: fetch };
}

export function useDynamicForm(id: number) {
  const [form, setForm] = useState<DynamicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getDynamicForm(id)
      .then((d) => { if (!cancelled) { setForm(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id]);

  return { form, loading, error };
}

export function useDynamicFormsByTargetModule() {
  const [grouped, setGrouped] = useState<Record<string, DynamicForm[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGrouped(await getDynamicFormsByTargetModule());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { grouped, loading, error, refetch: fetch };
}

export async function addDynamicForm(data: CreateDynamicFormPayload) {
  return createDynamicForm(data);
}

export async function editDynamicForm(id: number, data: UpdateDynamicFormPayload) {
  return updateDynamicForm(id, data);
}

export async function removeDynamicForm(id: number) {
  return deleteDynamicForm(id);
}
