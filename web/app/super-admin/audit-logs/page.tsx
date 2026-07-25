'use client';

import { Card } from '@/components/ui/card';
import { Heading } from '@/components/typography/Heading';
import { Caption } from '@/components/typography/Caption';

export default function SuperAdminAuditLogs() {
  return (
    <div className="space-y-6">
      <div>
        <Heading level={1}>
          Audit Logs
        </Heading>
        <Caption className="text-slate-500 mt-1">
          View all system audit logs
        </Caption>
      </div>

      <Card className="p-12 text-center">
        <Caption className="text-slate-500">Audit logs will be implemented here</Caption>
      </Card>
    </div>
  );
}
