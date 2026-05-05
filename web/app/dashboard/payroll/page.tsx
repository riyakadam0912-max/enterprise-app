'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { getSalaryStructures, createSalaryStructure, getPayrollCycles, createPayrollCycle, runPayrollCycle, getPayrollCycleEntries, markPayrollEntryPaid, generatePayslips, createTaxDeclaration, generateForm16, type SalaryStructure, type PayrollCycle, type PayrollEntry } from '@/api/payrollApi';
import TableActions from '@/components/common/TableActions';

type Role = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

const monthName = (m: number) => new Date(2024, m - 1).toLocaleString('default', { month: 'long' });
const money = (v: number) => `₹ ${(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function PayrollPage() {
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [activeTab, setActiveTab] = useState<'structures' | 'cycles' | 'entries' | 'taxes' | 'form16'>('structures');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [payrollCycles, setPayrollCycles] = useState<PayrollCycle[]>([]);
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<PayrollCycle | null>(null);

  const canManage = role === 'ADMIN' || role === 'HR';

  const [salaryForm, setSalaryForm] = useState({ employeeId: 1, basic: 50000, hra: 10000, allowances: 5000, pf: 6000, esi: 375, professionalTax: 200, tds: 2000 });
  const [cycleForm, setCycleForm] = useState({ name: `Payroll ${monthName(new Date().getMonth() + 1)}`, month: new Date().getMonth() + 1, year: new Date().getFullYear(), notes: '' });
  const [taxForm, setTaxForm] = useState({ employeeId: 1, year: new Date().getFullYear(), investment80C: 150000, investment80D: 0, hraExemption: 0, otherIncome: 0 });

  const loadData = useCallback(async () => {
    try {
      const [structures, cycles] = await Promise.all([getSalaryStructures(), getPayrollCycles()]);
      setSalaryStructures(structures);
      setPayrollCycles(cycles);
      if (cycles.length > 0 && !selectedCycle) setSelectedCycle(cycles[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, [selectedCycle]);

  const loadEntries = useCallback(async (cycleId: number) => {
    try {
      setLoading(true);
      const entries = await getPayrollCycleEntries(cycleId);
      setPayrollEntries(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedRole = (localStorage.getItem('role') || 'EMPLOYEE') as Role;
    setRole(storedRole);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await createSalaryStructure(salaryForm);
      setSuccess('Salary structure created');
      setSalaryForm({ employeeId: 1, basic: 50000, hra: 10000, allowances: 5000, pf: 6000, esi: 375, professionalTax: 200, tds: 2000 });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await createPayrollCycle(cycleForm);
      setSuccess('Payroll cycle created');
      setCycleForm({ name: `Payroll ${monthName(new Date().getMonth() + 1)}`, month: new Date().getMonth() + 1, year: new Date().getFullYear(), notes: '' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  const handleRunCycle = async (cycleId: number) => {
    try {
      setLoading(true);
      await runPayrollCycle(cycleId);
      await generatePayslips(cycleId);
      setSuccess('Payroll cycle executed successfully');
      await loadData();
      await loadEntries(cycleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run cycle');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (entryId: number) => {
    try {
      setLoading(true);
      await markPayrollEntryPaid(entryId, 'Marked as paid');
      setSuccess('Entry marked as paid');
      if (selectedCycle) await loadEntries(selectedCycle.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTax = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await createTaxDeclaration(taxForm);
      setSuccess('Tax declaration created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateForm16 = async () => {
    try {
      setLoading(true);
      await generateForm16(taxForm.employeeId, taxForm.year);
      setSuccess('Form 16 generated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  };

  if (!canManage) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto bg-amber-50 border border-amber-200 rounded-lg p-6 text-amber-700">
          <p className="font-medium">Payroll management is available only to HR and Admin users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Payroll Management System</h1>
          <p className="text-slate-600 mt-2">Indian Payroll Compliance | Salary Structures | Tax Calculations | Payslip Generation</p>
        </div>

        <div className="mb-6 flex justify-end">
          <TableActions moduleKey="payroll" rows={activeTab === 'entries' ? payrollEntries : []} />
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-700">{error}</div>}
        {success && <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded text-green-700">{success}</div>}

        <div className="mb-8 flex gap-2 border-b border-slate-200">
          {[
            { key: 'structures', label: '💼 Salary Structures' },
            { key: 'cycles', label: '📅 Payroll Cycles' },
            { key: 'entries', label: '📊 Entries & Payouts' },
            { key: 'taxes', label: '💰 Tax Declarations' },
            { key: 'form16', label: '📄 Form 16' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as 'structures' | 'cycles' | 'entries' | 'taxes' | 'form16')}
              className={`px-4 py-2 font-medium transition-colors ${activeTab === t.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

{/* Structures Tab */}
        {activeTab === 'structures' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-6">Create Salary Structure</h2>
              <form onSubmit={handleCreateStructure} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Employee ID</label>
                  <input type="number" value={salaryForm.employeeId} onChange={(e) => setSalaryForm({...salaryForm, employeeId: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-3">Earnings</h3>
                  <div className="space-y-2">
                    <input placeholder="Basic" type="number" value={salaryForm.basic} onChange={(e) => setSalaryForm({...salaryForm, basic: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    <input placeholder="HRA" type="number" value={salaryForm.hra} onChange={(e) => setSalaryForm({...salaryForm, hra: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    <input placeholder="Allowances" type="number" value={salaryForm.allowances} onChange={(e) => setSalaryForm({...salaryForm, allowances: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-3">Deductions</h3>
                  <div className="space-y-2">
                    <input placeholder="PF (12%)" type="number" value={salaryForm.pf} onChange={(e) => setSalaryForm({...salaryForm, pf: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    <input placeholder="ESI" type="number" value={salaryForm.esi} onChange={(e) => setSalaryForm({...salaryForm, esi: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    <input placeholder="Professional Tax" type="number" value={salaryForm.professionalTax} onChange={(e) => setSalaryForm({...salaryForm, professionalTax: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    <input placeholder="TDS" type="number" value={salaryForm.tds} onChange={(e) => setSalaryForm({...salaryForm, tds: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Creating...' : 'Create Structure'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-6">Active Salary Structures</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Employee ID</th>
                      <th className="px-4 py-3 text-right font-semibold">Basic</th>
                      <th className="px-4 py-3 text-right font-semibold">HRA</th>
                      <th className="px-4 py-3 text-right font-semibold">Allowances</th>
                      <th className="px-4 py-3 text-right font-semibold">Total Gross</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryStructures.filter(s => s.isActive).map((s) => {
                      const total = (s.basic || 0) + (s.hra || 0) + (s.allowances || 0);
                      return (
                        <tr key={s.id} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-3">{s.employeeId}</td>
                          <td className="px-4 py-3 text-right">{money(s.basic)}</td>
                          <td className="px-4 py-3 text-right">{money(s.hra)}</td>
                          <td className="px-4 py-3 text-right">{money(s.allowances)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{money(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {salaryStructures.filter(s => s.isActive).length === 0 && <p className="p-4 text-slate-600">No active salary structures</p>}
              </div>
            </div>
          </div>
        )}

        {/* Cycles Tab */}
        {activeTab === 'cycles' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-6">Create Payroll Cycle</h2>
              <form onSubmit={handleCreateCycle} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Cycle Name</label>
                  <input type="text" value={cycleForm.name} onChange={(e) => setCycleForm({...cycleForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Month</label>
                    <select value={cycleForm.month} onChange={(e) => setCycleForm({...cycleForm, month: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg">
                      {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{monthName(m)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Year</label>
                    <input type="number" value={cycleForm.year} onChange={(e) => setCycleForm({...cycleForm, year: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea value={cycleForm.notes} onChange={(e) => setCycleForm({...cycleForm, notes: e.target.value})} rows={3} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Creating...' : 'Create Cycle'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-6">Payroll Cycles</h2>
              <div className="space-y-3">
                {payrollCycles.map((c) => (
                  <div key={c.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{c.name}</h3>
                        <p className="text-sm text-slate-600">{monthName(c.month)} {c.year} • {c._count?.entries || 0} entries</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${c.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {c.status === 'DRAFT' && (
                        <button onClick={() => handleRunCycle(c.id)} disabled={loading} className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                          {loading ? 'Running...' : 'Run Payroll'}
                        </button>
                      )}
                      <button onClick={() => {setSelectedCycle(c); setActiveTab('entries'); loadEntries(c.id);}} className="flex-1 px-3 py-2 bg-slate-200 text-slate-900 text-sm rounded-lg hover:bg-slate-300">
                        View Entries
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Entries Tab */}
        {activeTab === 'entries' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-6">{selectedCycle ? `Payroll Entries - ${selectedCycle.name}` : 'Payroll Entries'}</h2>
            {selectedCycle ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Employee ID</th>
                      <th className="px-4 py-3 text-right font-semibold">Gross Pay</th>
                      <th className="px-4 py-3 text-right font-semibold">Deductions</th>
                      <th className="px-4 py-3 text-right font-semibold">Net Pay</th>
                      <th className="px-4 py-3 text-center font-semibold">Status</th>
                      <th className="px-4 py-3 text-center font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollEntries.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3">{e.employeeId}</td>
                        <td className="px-4 py-3 text-right">{money(e.grossPay)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{money(e.totalDeductions)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{money(e.netPay)}</td>
                        <td className="px-4 py-3 text-center"><span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${e.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{e.status}</span></td>
                        <td className="px-4 py-3 text-center">
                          {e.status === 'PENDING' && (
                            <button onClick={() => handleMarkPaid(e.id)} disabled={loading} className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50">
                              {loading ? '...' : 'Mark Paid'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {payrollEntries.length === 0 && <p className="p-4 text-slate-600">No entries for this cycle</p>}
              </div>
            ) : (
              <p className="text-slate-600">Select a payroll cycle to view entries</p>
            )}
          </div>
        )}

        {/* Tax Declarations Tab */}
        {activeTab === 'taxes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-6">Tax Declaration Form</h2>
              <form onSubmit={handleCreateTax} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Employee ID</label>
                  <input type="number" value={taxForm.employeeId} onChange={(e) => setTaxForm({...taxForm, employeeId: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Financial Year</label>
                  <input type="number" value={taxForm.year} onChange={(e) => setTaxForm({...taxForm, year: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-3">Tax Deductions (Section 80)</h3>
                  <input placeholder="Section 80C (₹1.5L limit)" type="number" value={taxForm.investment80C} onChange={(e) => setTaxForm({...taxForm, investment80C: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
                  <input placeholder="Section 80D (Health Insurance)" type="number" value={taxForm.investment80D} onChange={(e) => setTaxForm({...taxForm, investment80D: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
                  <input placeholder="HRA Exemption" type="number" value={taxForm.hraExemption} onChange={(e) => setTaxForm({...taxForm, hraExemption: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Submitting...' : 'Submit Tax Declaration'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-6">Tax Deduction Guide (India FY 2024-25)</h2>
              <div className="space-y-4 text-sm">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-semibold text-slate-900">Section 80C - ₹1,50,000 Limit</h3>
                  <p className="text-slate-600">ELSS, PPF, Life Insurance, Fixed Deposits, NSC, ULIP, etc.</p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="font-semibold text-slate-900">Section 80D - Health Insurance</h3>
                  <p className="text-slate-600">₹25,000 (individual) or ₹50,000 (family) for medical insurance premiums</p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="font-semibold text-slate-900">HRA Exemption</h3>
                  <p className="text-slate-600">Least of: (1) actual HRA, (2) 50% of salary (metro) / 40% (non-metro), (3) ₹2|L</p>
                </div>
                <div className="border-l-4 border-orange-500 pl-4">
                  <h3 className="font-semibold text-slate-900">Standard Deduction - ₹75,000</h3>
                  <p className="text-slate-600">Automatically applied under New Tax Regime</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form 16 Tab */}
        {activeTab === 'form16' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-6">Form 16 / Form TCS Generation</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Employee ID</label>
                <input type="number" value={taxForm.employeeId} onChange={(e) => setTaxForm({...taxForm, employeeId: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Financial Year</label>
                <input type="number" value={taxForm.year} onChange={(e) => setTaxForm({...taxForm, year: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex items-end">
                <button onClick={handleGenerateForm16} disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Generating...' : 'Generate Form 16'}
                </button>
              </div>
            </div>
            <div className="text-center py-8 text-slate-600">
              <p>Form 16 will be generated based on payslips for the selected financial year</p>
              <p className="text-sm mt-2">Includes: Gross Income, Tax Deductions, Deductions U/s 80, TDS/TCS summary</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
