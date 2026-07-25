'use client';

import { Card } from '@/components/ui/card';
import { Heading } from '@/components/typography/Heading';
import { Caption } from '@/components/typography/Caption';

export default function SuperAdminReports() {
  return (
    <div className="space-y-6">
      <div>
        <Heading level={1}>
          Reports
        </Heading>
        <Caption className="text-slate-500 mt-1">
          View and generate system reports
        </Caption>
      </div>

      <Card className="p-12 text-center">
        <Caption className="text-slate-500">Reports will be implemented here</Caption>
      </Card>
    </div>
  );
}
