'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMarketingCampaigns,
  deleteMarketingCampaign,
  type MarketingCampaign,
} from '@/api/marketingCampaignsApi';
import TableActions from '@/components/common/TableActions';
import { formatInrCurrency } from '@/utils/formatCurrency';
import { reportError } from '@/lib/error-handling';

const CHANNEL_COLOR: Record<string, string> = {
  'Event':       'bg-teal-500 text-white',
  'Website':     'bg-blue-500 text-white',
  'Direct Mail': 'bg-orange-500 text-white',
  'Social Media':'bg-pink-500 text-white',
  'Email':       'bg-purple-500 text-white',
};

const STATUS_COLOR: Record<string, string> = {
  PLANNED:   'bg-blue-100 text-blue-700',
  ACTIVE:    'bg-green-100 text-green-700',
  PAUSED:    'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
};

function fmtDate(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AllMarketingCampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    async function loadCampaigns() {
      try {
        setCampaigns(await getMarketingCampaigns());
      } catch (error) {
        reportError(error, 'Unable to load marketing campaigns');
        setError('Failed to load marketing campaigns');
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, []);

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete campaign "${name}"?`)) return;
    await deleteMarketingCampaign(id);
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">All Marketing Campaigns</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/marketing-campaigns/add')}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Add Campaign
          </button>
          <TableActions
            moduleKey="marketing-campaigns"
            rows={campaigns}
            onRefresh={async () => {
              try {
                setCampaigns(await getMarketingCampaigns());
              } catch (error) {
                reportError(error, 'Unable to refresh marketing campaigns');
              }
            }}
          />
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error   && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Campaign Name','Channel','Start Date','End Date','Objective','Budget','Status','Target Audience','Created By','Campaign Owner',''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-gray-400">No records found</td>
                  </tr>
                ) : campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.campaignName}</td>
                    <td className="px-4 py-3">
                      {c.channel ? (
                        <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${CHANNEL_COLOR[c.channel] ?? 'bg-gray-100 text-gray-700'}`}>
                          {c.channel}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(c.startDate)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(c.endDate)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-48 truncate">{c.objective ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {c.budget != null ? formatInrCurrency(c.budget, 2) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.targetAudience ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.createdBy ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.campaignOwner ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/marketing-campaigns/${c.id}/edit`)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.campaignName)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            Showing {campaigns.length} of {campaigns.length}
          </div>
        </div>
      )}
    </div>
  );
}
