'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import DealForm from '@/components/deals/DealForm';
import { useDeal, useUpdateDeal } from '@/hooks/useDeals';

export default function EditDealPage() {
  const params    = useParams<{ id: string }>();
  const dealId    = parseInt(params.id, 10);
  const router    = useRouter();

  const { data: deal, loading: loadingDeal } = useDeal(dealId);
  const { update, loading: saving, error }   = useUpdateDeal();

  if (loadingDeal) {
    return (
      <div className="p-6 flex justify-center items-center h-40">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return <div className="p-6 text-slate-500">Deal not found.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-800 mb-6">Edit Deal</h1>
      <DealForm
        initial={deal}
        onSubmit={async (data) => {
          await update(dealId, data);
          router.push('/dashboard/deals');
        }}
        submitting={saving}
        error={error}
      />
    </div>
  );
}
