'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCampaignLeads, CampaignLeadRow } from '@/api/campaignLeadsApi';
import TableActions from '@/components/common/TableActions';

const SOURCE_TYPE_STYLE: Record<string, string> = {
  'EMAIL OPEN':       'bg-emerald-500 text-white',
  'CLICK':            'bg-purple-700 text-white',
  'FORM SUBMISSION':  'bg-red-500 text-white',
  'PAGE VISIT':       'bg-blue-500 text-white',
};

function SourceBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-slate-400">—</span>;
  const key = type.toUpperCase();
  const cls = SOURCE_TYPE_STYLE[key] ?? 'bg-slate-400 text-white';
  return (
    <span className={`inline-block px-3 py-1 rounded text-xs font-semibold ${cls}`}>
      {type}
    </span>
  );
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function CampaignLeadsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CampaignLeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCampaignLeads()
      .then((data) => {
        const filtered = search
          ? data.filter(
              (r) =>
                r.campaign.toLowerCase().includes(search.toLowerCase()) ||
                r.lead?.name?.toLowerCase().includes(search.toLowerCase()) ||
                r.status.toLowerCase().includes(search.toLowerCase()),
            )
          : data;
        setRows(filtered);
        setTotal(data.length);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [search]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Campaign Leads Report</h1>
        <div className="flex items-center gap-2">
          {searchOpen && (
            <input
              ref={searchRef}
              autoFocus
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-44"
            />
          )}
          <button
            onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setSearch(''); }}
            className="p-1.5 rounded text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          <button
            onClick={() => router.push('/dashboard/campaign-leads/add')}
            className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
          </button>
          <TableActions moduleKey="campaign-leads" rows={rows} onRefresh={() => getCampaignLeads().then((data) => { setRows(data); setTotal(data.length); })} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {['Campaign', 'Lead', 'Engagement Score', 'Source Type', 'Last Interaction', 'Status', 'Notes'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {h} <span className="ml-0.5 text-slate-400">↕</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">No campaign leads found.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-700 font-medium">{row.campaign}</td>
                <td className="px-4 py-3 text-orange-600 font-medium">
                  {row.lead ? row.lead.name : '—'}
                </td>
                <td className="px-4 py-3 text-slate-700 text-right pr-8">
                  {row.engagementScore ?? '—'}
                </td>
                <td className="px-4 py-3"><SourceBadge type={row.sourceType} /></td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {formatDateTime(row.lastInteraction)}
                </td>
                <td className="px-4 py-3 text-slate-700">{row.status}</td>
                <td className="px-4 py-3 text-slate-600 max-w-48">
                  <div className="truncate">{row.notes ?? '—'}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && (
          <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
            Showing {rows.length} of {total}
          </div>
        )}
      </div>
    </div>
  );
}
