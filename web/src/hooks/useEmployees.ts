'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getEmployees,
  getEmployee,
  getEmployeesByDepartment,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  Employee,
  CreateEmployeePayload,
  UpdateEmployeePayload,
} from '@/api/employeesApi';

export function useEmployees(enabled = true) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    if (!enabled) {
      setEmployees([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return { employees, loading, error, refetch: fetchEmployees };
}

export function useEmployee(id: number) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getEmployee(id)
      .then((data) => { if (!cancelled) { setEmployee(data); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : 'Failed to fetch employee'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id]);

  return { employee, loading, error };
}

export function useEmployeesByDepartment() {
  const [grouped, setGrouped] = useState<Record<string, Employee[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEmployeesByDepartment();
      setGrouped(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { grouped, loading, error, refetch: fetch };
}

export async function addEmployee(data: CreateEmployeePayload) {
  return createEmployee(data);
}

export async function editEmployee(id: number, data: UpdateEmployeePayload) {
  return updateEmployee(id, data);
}

export async function removeEmployee(id: number) {
  return deleteEmployee(id);
}
