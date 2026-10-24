import { AuditLogsController } from './audit-logs.controller';
import type { AuditLogsService } from './audit-logs.service';
import type { AuthUser } from '../common/types/auth';

describe('Audit write response isolation', () => {
  it('does not expose system ownership metadata through the tenant create endpoint', async () => {
    const create = jest.fn();
    create.mockResolvedValue({
      id: 99,
      reason: 'CONTEXT_MISMATCH',
      targetOrganizationId: 55,
      requestedOrganizationId: 7,
    });
    const service = { create };
    const controller = new AuditLogsController(
      service as unknown as AuditLogsService,
    );
    await expect(
      controller.create(
        {
          userId: 1,
          module: 'Tasks',
          entityType: 'Task',
          entityId: 9,
          action: 'UPDATE',
        },
        { user: {} as AuthUser },
      ),
    ).resolves.toEqual({ recorded: true });
  });
});
