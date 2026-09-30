import { DealWonActionService } from './deal-won-action.service';
import { DealStatusUpdatedEvent } from '../events/deal-status-updated.event';
import { Role } from '../../common/enums/role.enum';

describe('DealWonActionService', () => {
  function createService(deal: Record<string, unknown>) {
    const projectCreate = jest.fn().mockResolvedValue({ id: 41 });
    const taskCreate = jest.fn().mockResolvedValue({ id: 42 });
    const auditLogCreate = jest.fn().mockResolvedValue({ id: 43 });
    const transaction = jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        project: { create: projectCreate },
        task: { create: taskCreate },
        auditLog: { create: auditLogCreate },
      }),
    );
    const prisma = {
      deal: { findUnique: jest.fn().mockResolvedValue(deal) },
      $transaction: transaction,
    };
    const service = new DealWonActionService(prisma as never, {} as never);

    return { service, projectCreate, taskCreate };
  }

  it('stores the triggering admin and linked manager user, not employee ID', async () => {
    const { service, projectCreate, taskCreate } = createService({
      id: 7,
      organizationId: 3,
      title: 'Implementation',
      value: 1000,
      assignedToId: 204,
      assignedEmployee: {
        id: 204,
        name: 'Project Manager',
        user: { id: 804, role: Role.MANAGER },
      },
    });

    await service.handleDealStatusUpdate(
      new DealStatusUpdatedEvent(7, 'NEGOTIATION', 'WON', 900),
    );

    expect(projectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          managerId: 804,
          managerAssignedById: 900,
          createdById: 900,
        }),
      }),
    );
    expect(taskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedToId: 204 }),
      }),
    );
  });

  it('does not assign a non-manager employee as project manager', async () => {
    const { service, projectCreate } = createService({
      id: 7,
      organizationId: 3,
      title: 'Implementation',
      value: 1000,
      assignedToId: 204,
      assignedEmployee: {
        id: 204,
        name: 'Sales Employee',
        user: { id: 804, role: Role.EMPLOYEE },
      },
    });

    await service.handleDealStatusUpdate(
      new DealStatusUpdatedEvent(7, 'NEGOTIATION', 'WON', 900),
    );

    expect(projectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          managerId: null,
          manager: null,
          managerAssignedById: null,
          createdById: 900,
        }),
      }),
    );
  });
});