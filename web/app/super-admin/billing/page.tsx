'use client';

import { Card } from '@/components/ui/card';
import { Heading } from '@/components/typography/Heading';
import { Caption } from '@/components/typography/Caption';

export default function SuperAdminBilling() {
  return (
    <div className="space-y-6">
      <div>
        <Heading level={1}>
          Billing
        </Heading>
        <Caption className="text-slate-500 mt-1">
          Manage billing and invoices across organizations
        </Caption>
      </div>

      <Card className="p-12 text-center">
        <Caption className="text-slate-500">Billing management will be implemented here</Caption>
      </Card>
    </div>
  );
}
