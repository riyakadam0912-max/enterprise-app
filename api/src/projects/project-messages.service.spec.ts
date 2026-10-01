import { BadRequestException } from '@nestjs/common';
import { ProjectMessagesService } from './project-messages.service';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';

describe('ProjectMessagesService mentions', () => {
  const organizationId = 4;
  const admin = {
    id: 1,
    userId: 1,
    organizationId,
    role: Role.ADMIN,
    roles: [Role.ADMIN],
  } as AuthUser;
  const prisma = {
    project: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    task: { findMany: jest.fn() },
    projectMessage: { findMany: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  let service: ProjectMessagesService;
  const projectsService = {
    getProjectAccessWhere: jest.fn().mockResolvedValue({
      organizationId: { in: [organizationId, 9] },
      deletedAt: null,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.project.findFirst.mockResolvedValue({
      organizationId: 9,
      managerUser: {
        id: 1,
        name: 'Admin',
        email: 'admin@example.com',
        role: Role.ADMIN,
      },
      coManagers: [],
      assignedEmployees: [
        {
          user: {
            id: 22,
            name: 'Ava Stone',
            email: 'ava@example.com',
            role: Role.EMPLOYEE,
          },
        },
      ],
    });
    prisma.project.findUnique.mockResolvedValue({ id: 19 });
    prisma.task.findMany.mockResolvedValue([
      {
        id: 71,
        taskName: 'Review launch plan',
        status: 'IN_PROGRESS',
        assignedToUser: null,
        assignedByUser: null,
      },
    ]);
    prisma.projectMessage.create.mockImplementation(({ data, include }) => ({
      id: 'message-1',
      ...data,
      mentions: data.mentions,
      createdAt: new Date('2026-09-29T10:00:00.000Z'),
      sender: include.sender
        ? { id: admin.userId, name: 'Admin', email: 'admin@example.com' }
        : undefined,
    }));
    service = new ProjectMessagesService(
      prisma as never,
      projectsService as never,
    );
  });

  it('returns participant and task choices scoped to the project', async () => {
    const result = await service.getMentionOptions(19, admin);

    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 19,
          organizationId: { in: [organizationId, 9] },
        }),
      }),
    );

    expect(result.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 22, name: 'Ava Stone' }),
      ]),
    );
    expect(result.tasks).toEqual([
      { id: 71, name: 'Review launch plan', status: 'IN_PROGRESS' },
    ]);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 9, projectId: 19 }),
      }),
    );
  });

  it('persists validated user and task mention metadata', async () => {
    const message = await service.createMessage(
      19,
      'Hi @Ava Stone, please check #Review launch plan',
      [
        { type: 'user', id: 22, label: 'Ava Stone', start: 3, end: 13 },
        {
          type: 'task',
          id: 71,
          label: 'Review launch plan',
          start: 28,
          end: 47,
        },
      ],
      admin,
    );

    expect(message.mentions).toEqual([
      { type: 'user', id: 22, label: 'Ava Stone', start: 3, end: 13 },
      { type: 'task', id: 71, label: 'Review launch plan', start: 28, end: 47 },
    ]);
    expect(prisma.projectMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 19,
          organizationId: 9,
          content: expect.any(String),
        }),
      }),
    );
  });

  it('rejects a mention target outside this project', async () => {
    await expect(
      service.createMessage(
        19,
        'Hi @Unknown Person',
        [{ type: 'user', id: 900, label: 'Unknown Person', start: 3, end: 18 }],
        admin,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.projectMessage.create).not.toHaveBeenCalled();
  });

  it('rejects offsets that do not point to the selected token', async () => {
    await expect(
      service.createMessage(
        19,
        'Hi @Ava Stone',
        [{ type: 'user', id: 22, label: 'Ava Stone', start: 2, end: 12 }],
        admin,
      ),
    ).rejects.toThrow('Mention text does not match its target');
    expect(prisma.projectMessage.create).not.toHaveBeenCalled();
  });

  it('rejects malformed mention payloads before persistence', async () => {
    await expect(
      service.createMessage(19, 'Hello', { unexpected: true } as never, admin),
    ).rejects.toThrow('Invalid project chat mentions');
    expect(prisma.projectMessage.create).not.toHaveBeenCalled();
  });
});
