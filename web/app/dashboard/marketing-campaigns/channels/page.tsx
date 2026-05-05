'use client';

import { useEffect, useState } from 'react';
import { getMarketingCampaignsByChannel, type MarketingCampaign } from '@/api/marketingCampaignsApi';

const CHANNELS = ['Email', 'Social Media', 'Website', 'Event', 'Direct Mail'];

const CHANNEL_COLOR: Record<string, string> = {
  'Email':        'border-purple-500',
  'Social Media': 'border-pink-500',
  'Website':      'border-blue-500',
  'Event':        'border-teal-500',
  'Direct Mail':  'border-orange-500',
};

function fmtDate(val: string | null) {
  if (!val) return null;
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function CampaignCard({ campaign }: { campaign: MarketingCampaign }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm hover:shadow-md transition-shadow">
      <p className="font-semibold text-gray-900 text-sm">{campaign.campaignName}</p>
      {campaign.objective && (
        <p className="text-xs text-orange-500 mt-0.5 truncate">{campaign.objective}</p>
      )}
      {campaign.startDate && (
        <p className="text-xs text-gray-400 mt-1">{fmtDate(campaign.startDate)}{campaign.endDate ? ` – ${fmtDate(campaign.endDate)}` : ''}</p>
      )}
      {campaign.campaignOwner && (
        <p className="text-xs text-gray-500 mt-0.5">{campaign.campaignOwner}</p>
      )}
    </div>
  );
}

export default function ChannelsPage() {
  const [grouped, setGrouped] = useState<Record<string, MarketingCampaign[]>>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    getMarketingCampaignsByChannel()
      .then(setGrouped)
      .catch(() => setError('Failed to load channels'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Channels</h1>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error   && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {CHANNELS.map((channel) => {
            const cards = grouped[channel] ?? [];
            return (
              <div key={channel} className="shrink-0 w-72">
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 bg-white border border-b-0 border-gray-200 rounded-t-lg border-l-4 ${CHANNEL_COLOR[channel]}`}>
                  <span className="text-sm font-semibold text-gray-800">{channel}</span>
                  <span className="text-xs text-gray-400">{cards.length}</span>
                </div>

                {/* Cards */}
                <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg p-2 min-h-32">
                  {cards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <svg viewBox="0 0 64 64" className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <rect x="8" y="12" width="48" height="40" rx="4" />
                        <path d="M20 28h24M20 36h16" strokeLinecap="round" />
                        <circle cx="52" cy="52" r="8" fill="white" stroke="currentColor" strokeWidth={1.5} />
                        <path d="M49 52h6M52 49v6" strokeLinecap="round" />
                      </svg>
                      <p className="text-xs text-gray-400">No Records in {channel}</p>
                    </div>
                  ) : (
                    cards.map((c) => <CampaignCard key={c.id} campaign={c} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
