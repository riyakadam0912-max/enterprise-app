'use client';

import { Card } from '@/components/ui/card';
import { Heading } from '@/components/typography/Heading';
import { Caption } from '@/components/typography/Caption';

export default function SuperAdminPlans() {
  return (
    <div className="space-y-6">
      <div>
        <Heading level={1}>
          Subscription Plans
        </Heading>
        <Caption className="text-slate-500 mt-1">
          Manage subscription plans and pricing
        </Caption>
      </div>

      <Card className="p-12 text-center">
        <Caption className="text-slate-500">Subscription plans management will be implemented here</Caption>
      </Card>
    </div>
  );
}
