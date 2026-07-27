import {
  Injectable,
  Logger,
  OnModuleInit,
  ForbiddenException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  WorkflowActionType,
  WorkflowStage,
  WorkflowStep,
  PrismaClient,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { WORKFLOW_TEMPLATES } from './workflow.templates';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { WorkflowStartDto } from './dto/workflow-start.dto';

type LegacyApprovalAction =
  | 'SUBMITTED'
  | 'MANAGER_APPROVED'
  | 'HR_APPROVED'
  | 'REJECTED';

type LegacyApprovalTrailEntry = {
  action: LegacyApprovalAction;
  at: string;
  byUserId: number;
  reason: string | null;
};

type WorkflowContext = Record<string, unknown> | undefined;

type WorkflowDefinitionWithStagesAndRules =
  Prisma.WorkflowDefinitionGetPayload<{
    include: {
      stages: true;
      rules: true;
    };
  }>;

type WorkflowInstanceWithIncludes = Prisma.WorkflowInstanceGetPayload<{
  include: {
    workflowDefinition: {
      include: { stages: true; rules: true };
    };
    steps: {
      include: { workflowStage: true };
    };
    actions: true;
    comments: true;
    assignments: true;
    history: true;
    notifications: true;
  };
}>;

type WorkflowAssignmentRule = {
  type?: string;
  value?: string;
  userId?: number;
  userIds?: number[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }

  if (value === null) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonValue(entry) ?? null);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        toJsonValue(entry) ?? null,
      ]),
    );
  }

  return String(value);
}

function toWorkflowContext(value: unknown): WorkflowContext {
  return isRecord(value) ? value : undefined;
}

function getApprovalTrail(value: unknown): unknown {
  if (!isRecord(value)) {
    return undefined;
  }

  const approvalTrail = value.approvalTrail;
  return isRecord(approvalTrail) || Array.isArray(approvalTrail)
    ? approvalTrail
    : undefined;
}

function toRole(value: string): Role | undefined {
  switch (value) {
    case 'ADMIN':
      return Role.ADMIN;
    case 'HR':
      return Role.HR;
    case 'MANAGER':
      return Role.MANAGER;
    case 'EMPLOYEE':
      return Role.EMPLOYEE;
    default:
      return undefined;
  }
}

function normalizeTrail(trail: unknown): LegacyApprovalTrailEntry[] {
  if (!Array.isArray(trail)) {
    return [];
  }

  return trail
    .filter((entry): entry is LegacyApprovalTrailEntry =>
      Boolean(entry && typeof entry === 'object'),
    )
    .map((entry) => ({
      action: entry.action,
      at: entry.at,
      byUserId: entry.byUserId,
      reason: entry.reason ?? null,
    }));
}

function appendTrail(
  trail: unknown,
  action: LegacyApprovalAction,
  userId: number,
  reason?: string,
): LegacyApprovalTrailEntry[] {
  const nextTrail = normalizeTrail(trail);
  nextTrail.push({
    action,
    at: new Date().toISOString(),
    byUserId: userId,
    reason: reason?.trim() ? reason.trim() : null,
  });
  return nextTrail;
}

function stagePolicy(stage: WorkflowStage) {
  const policy = (stage?.approvalPolicy ?? {}) as Record<string, unknown>;
  const expectedApproverCount =
    Number(policy.expectedApproverCount ?? policy.totalApprovers ?? 1) || 1;
  const requiredApprovals =
    Number(policy.requiredApprovals ?? policy.quorum ?? 1) || 1;
  return {
    mode:
      typeof policy.mode === 'string' ? policy.mode.toUpperCase() : 'SINGLE',
    expectedApproverCount,
    requiredApprovals,
  };
}

function assignmentRule(stage: WorkflowStage): WorkflowAssignmentRule {
  const rawRule = stage.assignmentRule;
  if (!rawRule || typeof rawRule !== 'object' || Array.isArray(rawRule)) {
    return {};
  }

  const rule = rawRule as Record<string, unknown>;
  const userIds = Array.isArray(rule.userIds)
    ? rule.userIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
    : undefined;

  return {
    type: typeof rule.type === 'string' ? rule.type : undefined,
    value: typeof rule.value === 'string' ? rule.value : undefined,
    userId: typeof rule.userId === 'number' ? rule.userId : undefined,
    userIds,
  };
}

@Injectable()
export class WorkflowEngineService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private validateOrganization(
    organizationId: number | null | undefined,
  ): number {
    if (organizationId == null) {
      throw new ForbiddenException('Organization ID is required');
    }
    return organizationId;
  }

  async onModuleInit() {
    await this.ensureBuiltInDefinitions();
  }

  private async ensureBuiltInDefinitions() {
    for (const template of WORKFLOW_TEMPLATES) {
      try {
        // First try to find if definition exists
        const existing = await this.prisma.workflowDefinition.findUnique({
          where: { key: template.key },
        });

        if (existing) {
          // If exists, delete stages and rules first, then update
          await this.prisma.workflowStage.deleteMany({
            where: { workflowDefinitionId: existing.id },
          });
          await this.prisma.workflowRule.deleteMany({
            where: { workflowDefinitionId: existing.id },
          });
          await this.prisma.workflowDefinition.update({
            where: { key: template.key },
            data: {
              name: template.name,
              module: template.module,
              description: template.description,
              isActive: true,
              settings: toJsonValue(template.settings),
              stages: {
                create: template.stages.map((stage) => ({
                  key: stage.key,
                  name: stage.name,
                  order: stage.order,
                  approvalType: stage.approvalType,
                  approvalPolicy: toJsonValue(stage.approvalPolicy),
                  assignmentRule: toJsonValue(stage.assignmentRule),
                  metadata: toJsonValue(stage.metadata),
                })),
              },
            },
          });
        } else {
          // If not exists, create new
          await this.prisma.workflowDefinition.create({
            data: {
              key: template.key,
              name: template.name,
              module: template.module,
              description: template.description,
              isActive: true,
              settings: toJsonValue(template.settings),
              stages: {
                create: template.stages.map((stage) => ({
                  key: stage.key,
                  name: stage.name,
                  order: stage.order,
                  approvalType: stage.approvalType,
                  approvalPolicy: toJsonValue(stage.approvalPolicy),
                  assignmentRule: toJsonValue(stage.assignmentRule),
                  metadata: toJsonValue(stage.metadata),
                })),
              },
            },
          });
        }
      } catch (error) {
        // If unique constraint error, ignore since definition already exists
        this.logger.warn(
          `Failed to upsert workflow definition ${template.key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  async createDefinition(dto: CreateWorkflowDefinitionDto) {
    return this.prisma.workflowDefinition.upsert({
      where: { key: dto.key },
      update: {
        name: dto.name,
        module: dto.module,
        description: dto.description,
        settings: toJsonValue(dto.settings),
        stages: {
          deleteMany: {},
          create: dto.stages.map((stage) => ({
            key: stage.key,
            name: stage.name,
            order: stage.order,
            approvalType: stage.approvalType ?? 'SEQUENTIAL',
            approvalPolicy: toJsonValue(stage.approvalPolicy),
            assignmentRule: toJsonValue(stage.assignmentRule),
            metadata: toJsonValue(stage.metadata),
          })),
        },
        rules: {
          deleteMany: {},
          create: (dto.rules ?? []).map((rule) => ({
            name: rule.name,
            priority: rule.priority ?? 0,
            condition: toJsonValue(rule.condition),
            action: toJsonValue(rule.action),
          })),
        },
      },
      create: {
        key: dto.key,
        name: dto.name,
        module: dto.module,
        description: dto.description,
        settings: toJsonValue(dto.settings),
        stages: {
          create: dto.stages.map((stage) => ({
            key: stage.key,
            name: stage.name,
            order: stage.order,
            approvalType: stage.approvalType ?? 'SEQUENTIAL',
            approvalPolicy: toJsonValue(stage.approvalPolicy),
            assignmentRule: toJsonValue(stage.assignmentRule),
            metadata: toJsonValue(stage.metadata),
          })),
        },
        rules: {
          create: (dto.rules ?? []).map((rule) => ({
            name: rule.name,
            priority: rule.priority ?? 0,
            condition: toJsonValue(rule.condition),
            action: toJsonValue(rule.action),
          })),
        },
      },
      include: { stages: { orderBy: { order: 'asc' } }, rules: true },
    });
  }

  async listDefinitions() {
    return this.prisma.workflowDefinition.findMany({
      include: {
        stages: { orderBy: { order: 'asc' } },
        rules: { orderBy: { priority: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getDefinitionByKey(
    key: string,
  ): Promise<WorkflowDefinitionWithStagesAndRules> {
    const definition = await this.prisma.workflowDefinition.findUnique({
      where: { key },
      include: {
        stages: { orderBy: { order: 'asc' } },
        rules: { orderBy: { priority: 'desc' } },
      },
    });

    if (!definition) {
      throw new Error(`Workflow definition ${key} not found`);
    }

    return definition;
  }

  async getInstanceByEntity(
    entityType: string,
    entityId: number,
    organizationId: number,
  ): Promise<WorkflowInstanceWithIncludes | null> {
    const orgId = this.validateOrganization(organizationId);
    return this.prisma.workflowInstance.findFirst({
      where: { entityType, entityId, organizationId: orgId },
      include: {
        workflowDefinition: {
          include: { stages: { orderBy: { order: 'asc' } }, rules: true },
        },
        steps: {
          include: { workflowStage: true },
          orderBy: [{ workflowStage: { order: 'asc' } }, { slotIndex: 'asc' }],
        },
        actions: { orderBy: { createdAt: 'asc' } },
        comments: { orderBy: { createdAt: 'asc' } },
        assignments: { orderBy: { assignedAt: 'asc' } },
        history: { orderBy: { createdAt: 'asc' } },
        notifications: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async getTimeline(
    entityType: string,
    entityId: number,
    organizationId: number,
  ) {
    return this.getInstanceByEntity(entityType, entityId, organizationId);
  }

  private async resolveRecipients(
    stage: WorkflowStage,
    context: WorkflowContext,
  ): Promise<number[]> {
    const rule = assignmentRule(stage);

    if (rule.userIds) {
      return rule.userIds;
    }

    if (rule.userId !== undefined) {
      return [rule.userId];
    }

    if (rule.type === 'ROLE' && rule.value) {
      const role = toRole(rule.value);
      if (role) {
        const users = await this.prisma.user.findMany({
          where: { role, isActive: true },
          select: { id: true },
        });
        return users.map((user: { id: number }) => user.id);
      }
    }

    if (rule.type === 'MANAGER') {
      const employeeId = Number(
        context?.employeeId ?? context?.submittedEmployeeId ?? 0,
      );
      if (employeeId) {
        const employee = await this.prisma.employee.findUnique({
          where: { id: employeeId },
          include: { user: { select: { managerId: true } } },
        });
        if (employee?.user?.managerId) {
          return [employee.user.managerId];
        }
      }

      const requestorUserId = Number(
        context?.requestorUserId ?? context?.initiatedBy ?? 0,
      );
      if (requestorUserId) {
        const user = await this.prisma.user.findUnique({
          where: { id: requestorUserId },
          select: { managerId: true },
        });
        if (user?.managerId) {
          return [user.managerId];
        }
      }
    }

    return [];
  }

  private async createWorkflowNotifications(params: {
    workflowInstanceId: number;
    recipients: number[];
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    organizationId: number;
  }) {
    if (!params.recipients.length) {
      return;
    }

    await this.prisma.workflowNotification.createMany({
      data: params.recipients.map((recipientId: number) => ({
        workflowInstanceId: params.workflowInstanceId,
        recipientId,
        notificationType: params.type,
        title: params.title,
        message: params.message,
        sentAt: new Date(),
        metadata: toJsonValue(params.metadata),
        organizationId: params.organizationId,
      })),
    });

    await Promise.all(
      params.recipients.map((recipientId: number) =>
        this.notificationsService.create({
          userId: recipientId,
          title: params.title,
          message: params.message,
        }),
      ),
    );
  }

  private async createAudit(params: {
    userId?: number | null;
    module: string;
    entityType: string;
    entityId?: number | null;
    action: string;
    description: string;
    oldValue?: unknown;
    newValue?: unknown;
  }) {
    await this.auditLogsService.logCustomAction({
      userId: params.userId ?? null,
      module: params.module,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      action: params.action,
      description: params.description,
      oldValue: toJsonValue(params.oldValue),
      newValue: toJsonValue(params.newValue),
    });
  }

  async submitWorkflow(dto: WorkflowStartDto) {
    const organizationId = this.validateOrganization(dto.organizationId);
    const definition = await this.getDefinitionByKey(dto.definitionKey);
    const existing = await this.getInstanceByEntity(
      dto.entityType,
      dto.entityId,
      organizationId,
    );
    if (
      existing &&
      existing.status !== 'COMPLETED' &&
      existing.status !== 'CANCELLED'
    ) {
      return existing;
    }

    const stages = [...definition.stages].sort(
      (left: WorkflowStage, right: WorkflowStage) => left.order - right.order,
    );
    const firstStage = stages[0];
    const firstRecipients = firstStage
      ? await this.resolveRecipients(firstStage, dto.context)
      : [];

    const instance = await this.prisma.$transaction(
      async (transaction: PrismaClient) => {
        const created: WorkflowInstanceWithIncludes =
          await transaction.workflowInstance.create({
            data: {
              workflowDefinitionId: definition.id,
              entityType: dto.entityType,
              entityId: dto.entityId,
              status: 'SUBMITTED',
              currentStageOrder: firstStage?.order ?? 1,
              initiatedBy: dto.initiatedBy,
              startedAt: new Date(),
              lastActionAt: new Date(),
              context: toJsonValue(dto.context),
              metadata: toJsonValue(dto.metadata),
              organizationId: dto.organizationId,
              steps: {
                create: stages.flatMap((stage: WorkflowStage) => {
                  const policy = stagePolicy(stage);
                  const rule = assignmentRule(stage);
                  const slotCount = Math.max(
                    1,
                    stage.order === firstStage?.order
                      ? policy.expectedApproverCount
                      : 1,
                  );
                  return Array.from({ length: slotCount }, (_, index) => ({
                    workflowStageId: stage.id,
                    slotIndex: index + 1,
                    status:
                      stage.order === firstStage?.order
                        ? 'PENDING'
                        : 'NOT_STARTED',
                    assignedRole:
                      rule.value ??
                      (rule.type === 'MANAGER' ? 'MANAGER' : null),
                    metadata: toJsonValue({
                      mode: policy.mode,
                      expectedApproverCount: policy.expectedApproverCount,
                    }),
                    organizationId: dto.organizationId,
                  }));
                }),
              },
              history: {
                create: {
                  eventType: 'STARTED',
                  actorId: dto.initiatedBy,
                  toStatus: 'SUBMITTED',
                  toStageOrder: firstStage?.order ?? 1,
                  message: `Workflow started for ${dto.entityType} #${dto.entityId}`,
                  metadata: toJsonValue(dto.context),
                  organizationId: dto.organizationId,
                },
              },
              actions: {
                create: {
                  actionType: 'START',
                  performedBy: dto.initiatedBy,
                  comment: null,
                  metadata: toJsonValue(dto.metadata),
                  organizationId: dto.organizationId,
                },
              },
            },
            include: {
              workflowDefinition: {
                include: { stages: { orderBy: { order: 'asc' } }, rules: true },
              },
              steps: {
                include: { workflowStage: true },
                orderBy: [
                  { workflowStage: { order: 'asc' } },
                  { slotIndex: 'asc' },
                ],
              },
              actions: true,
              comments: true,
              assignments: true,
              history: true,
              notifications: true,
            },
          });

        const stageAssignments = await Promise.all(
          stages.map(async (stage: WorkflowStage) => {
            const recipients = await this.resolveRecipients(stage, dto.context);
            return { stage, recipients };
          }),
        );

        await transaction.workflowAssignment.createMany({
          data: stageAssignments.flatMap(({ stage, recipients }) =>
            recipients.map((recipientId: number) => {
              const rule = assignmentRule(stage);
              return {
                workflowInstanceId: created.id,
                workflowStepId:
                  created.steps.find(
                    (step: WorkflowStep) => step.workflowStageId === stage.id,
                  )?.id ?? null,
                assigneeId: recipientId,
                assigneeRole: rule.value ?? rule.type ?? null,
                assignmentReason: `${stage.name} assignment`,
                organizationId: dto.organizationId,
              };
            }),
          ),
        });

        return created;
      },
    );

    if (firstRecipients.length) {
      await this.createWorkflowNotifications({
        workflowInstanceId: instance.id,
        recipients: firstRecipients,
        type: 'WORKFLOW_SUBMITTED',
        title: `${definition.name} submitted`,
        message: `${dto.entityType} #${dto.entityId} is waiting for ${firstStage?.name ?? 'review'}.`,
        metadata: {
          definitionKey: definition.key,
          stageOrder: firstStage?.order ?? 1,
        },
        organizationId: instance.organizationId,
      });
    }

    await this.createAudit({
      userId: dto.initiatedBy,
      module: definition.module,
      entityType: dto.entityType,
      entityId: dto.entityId,
      action: 'WORKFLOW_SUBMITTED',
      description: `${definition.name} started for ${dto.entityType} #${dto.entityId}`,
      newValue: { workflowInstanceId: instance.id, status: instance.status },
    });

    return instance;
  }

  private buildLegacyState(params: {
    status: string;
    trail: unknown;
    action: LegacyApprovalAction;
    userId: number;
    approvedBy?: string | null;
    approvedAt?: Date | null;
    rejectedAt?: Date | null;
    rejectionReason?: string | null;
    reason?: string;
  }) {
    const approvalTrail = appendTrail(
      params.trail,
      params.action,
      params.userId,
      params.reason,
    );
    return {
      status: params.status,
      approvedBy: params.approvedBy ?? null,
      approvedAt: params.approvedAt ?? null,
      rejectedAt: params.rejectedAt ?? null,
      rejectionReason: params.rejectionReason ?? null,
      approvalTrail: toJsonValue(approvalTrail),
    };
  }

  async approveWorkflow(dto: {
    definitionKey: string;
    entityType: string;
    entityId: number;
    userId: number;
    businessStatus: string;
    trailAction?: Exclude<LegacyApprovalAction, 'SUBMITTED' | 'REJECTED'>;
    approvedByLabel?: string;
    trail?: unknown;
    metadata?: Record<string, unknown>;
    comment?: string;
    organizationId: number;
  }) {
    const organizationId = this.validateOrganization(dto.organizationId);
    const definition = await this.getDefinitionByKey(dto.definitionKey);
    const instance = await this.getInstanceByEntity(
      dto.entityType,
      dto.entityId,
      organizationId,
    );

    if (!instance) {
      throw new Error(
        `Workflow instance for ${dto.entityType} #${dto.entityId} not found. Make sure the work was submitted first.`,
      );
    }

    const activeStage =
      instance.workflowDefinition.stages.find(
        (stage: WorkflowStage) => stage.order === instance.currentStageOrder,
      ) ?? null;

    if (!activeStage) {
      throw new Error('No active workflow stage is available for approval');
    }

    const stageSteps = instance.steps.filter(
      (step: WorkflowStep) => step.workflowStageId === activeStage.id,
    );
    const pendingStep =
      stageSteps.find(
        (step: WorkflowStep) =>
          step.status === 'PENDING' || step.status === 'NOT_STARTED',
      ) ?? stageSteps[0];
    if (!pendingStep) {
      throw new Error('No pending workflow step is available for approval');
    }

    const updatedInstance = await this.prisma.$transaction(
      async (transaction: PrismaClient) => {
        await transaction.workflowStep.update({
          where: { id: pendingStep.id },
          data: {
            status: 'APPROVED',
            decisionAction: 'APPROVE',
            decidedBy: dto.userId,
            decidedAt: new Date(),
            metadata: toJsonValue(dto.metadata),
          },
        });

        const policy = stagePolicy(activeStage);
        const approvedCount = stageSteps.filter(
          (step: WorkflowStep) =>
            step.status === 'APPROVED' || step.id === pendingStep.id,
        ).length;
        const completed = approvedCount >= policy.requiredApprovals;
        const nextStage = completed
          ? (instance.workflowDefinition.stages.find(
              (stage: WorkflowStage) => stage.order === activeStage.order + 1,
            ) ?? null)
          : activeStage;

        if (completed) {
          await transaction.workflowStep.updateMany({
            where: {
              workflowInstanceId: instance.id,
              workflowStageId: activeStage.id,
              status: 'NOT_STARTED',
            },
            data: { status: 'SKIPPED' },
          });
        }

        if (nextStage && nextStage !== activeStage) {
          const nextRecipients = await this.resolveRecipients(
            nextStage,
            toWorkflowContext(instance.context),
          );
          const nextPolicy = stagePolicy(nextStage);
          const nextSlots = Math.max(1, nextPolicy.expectedApproverCount);

          await transaction.workflowStep.createMany({
            data: Array.from({ length: nextSlots }, (_, index) => ({
              workflowInstanceId: instance.id,
              workflowStageId: nextStage.id,
              slotIndex: index + 1,
              status: 'PENDING',
              metadata: toJsonValue({
                mode: nextPolicy.mode,
                expectedApproverCount: nextPolicy.expectedApproverCount,
              }),
              organizationId: instance.organizationId,
            })),
          });

          await transaction.workflowHistory.create({
            data: {
              workflowInstanceId: instance.id,
              eventType: 'STAGE_APPROVED',
              fromStatus: instance.status,
              toStatus: 'PENDING_APPROVAL',
              fromStageOrder: activeStage.order,
              toStageOrder: nextStage.order,
              actorId: dto.userId,
              message: `${activeStage.name} approved, moving to ${nextStage.name}`,
              metadata: toJsonValue(dto.metadata),
              organizationId: instance.organizationId,
            },
          });

          if (nextRecipients.length) {
            await this.createWorkflowNotifications({
              workflowInstanceId: instance.id,
              recipients: nextRecipients,
              type: 'WORKFLOW_STAGE_READY',
              title: `${definition.name} ready for review`,
              message: `${dto.entityType} #${dto.entityId} is ready for ${nextStage.name}.`,
              metadata: {
                definitionKey: definition.key,
                stageOrder: nextStage.order,
              },
              organizationId: instance.organizationId,
            });
          }

          return transaction.workflowInstance.update({
            where: { id: instance.id },
            data: {
              status: 'PENDING_APPROVAL',
              currentStageOrder: nextStage.order,
              lastActionAt: new Date(),
            },
            include: {
              workflowDefinition: {
                include: { stages: { orderBy: { order: 'asc' } }, rules: true },
              },
              steps: {
                include: { workflowStage: true },
                orderBy: [
                  { workflowStage: { order: 'asc' } },
                  { slotIndex: 'asc' },
                ],
              },
              actions: true,
              comments: true,
              assignments: true,
              history: true,
              notifications: true,
            },
          });
        }

        await transaction.workflowHistory.create({
          data: {
            workflowInstanceId: instance.id,
            eventType: 'APPROVED',
            fromStatus: instance.status,
            toStatus: 'APPROVED',
            fromStageOrder: activeStage.order,
            toStageOrder: activeStage.order,
            actorId: dto.userId,
            message: `${activeStage.name} approved and workflow completed`,
            metadata: toJsonValue(dto.metadata),
            organizationId: instance.organizationId,
          },
        });

        return transaction.workflowInstance.update({
          where: { id: instance.id },
          data: {
            status: 'APPROVED',
            completedAt: new Date(),
            lastActionAt: new Date(),
          },
          include: {
            workflowDefinition: {
              include: { stages: { orderBy: { order: 'asc' } }, rules: true },
            },
            steps: {
              include: { workflowStage: true },
              orderBy: [
                { workflowStage: { order: 'asc' } },
                { slotIndex: 'asc' },
              ],
            },
            actions: true,
            comments: true,
            assignments: true,
            history: true,
            notifications: true,
          },
        });
      },
    );

    await this.createAudit({
      userId: dto.userId,
      module: definition.module,
      entityType: dto.entityType,
      entityId: dto.entityId,
      action: 'WORKFLOW_APPROVED',
      description: `${definition.name} approved for ${dto.entityType} #${dto.entityId}`,
      newValue: {
        workflowInstanceId: updatedInstance.id,
        status: updatedInstance.status,
      },
    });

    return {
      workflow: updatedInstance,
      legacyState: this.buildLegacyState({
        status: dto.businessStatus,
        trail: dto.trail ?? getApprovalTrail(instance.metadata),
        action: dto.trailAction ?? 'MANAGER_APPROVED',
        userId: dto.userId,
        approvedBy: dto.approvedByLabel ?? null,
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null,
      }),
    };
  }

  async rejectWorkflow(dto: {
    definitionKey: string;
    entityType: string;
    entityId: number;
    userId: number;
    businessStatus: string;
    trailAction?: 'REJECTED';
    approvedByLabel?: string;
    trail?: unknown;
    reason?: string;
    metadata?: Record<string, unknown>;
    organizationId: number;
  }) {
    const organizationId = this.validateOrganization(dto.organizationId);
    const definition = await this.getDefinitionByKey(dto.definitionKey);
    const instance = await this.getInstanceByEntity(
      dto.entityType,
      dto.entityId,
      organizationId,
    );

    if (!instance) {
      throw new Error(
        `Workflow instance for ${dto.entityType} #${dto.entityId} not found`,
      );
    }

    const updatedInstance = await this.prisma.$transaction(
      async (transaction: PrismaClient) => {
        await transaction.workflowStep.updateMany({
          where: {
            workflowInstanceId: instance.id,
            status: { in: ['PENDING', 'NOT_STARTED'] },
          },
          data: {
            status: 'REJECTED',
            decisionAction: 'REJECT',
            decidedBy: dto.userId,
            decidedAt: new Date(),
            notes: dto.reason ?? null,
            metadata: toJsonValue(dto.metadata),
          },
        });

        await transaction.workflowHistory.create({
          data: {
            workflowInstanceId: instance.id,
            eventType: 'REJECTED',
            fromStatus: instance.status,
            toStatus: 'REJECTED',
            fromStageOrder: instance.currentStageOrder,
            toStageOrder: instance.currentStageOrder,
            actorId: dto.userId,
            message: dto.reason
              ? `Workflow rejected: ${dto.reason}`
              : 'Workflow rejected',
            metadata: toJsonValue(dto.metadata),
            organizationId: instance.organizationId,
          },
        });

        return transaction.workflowInstance.update({
          where: { id: instance.id },
          data: {
            status: 'REJECTED',
            completedAt: new Date(),
            lastActionAt: new Date(),
          },
          include: {
            workflowDefinition: {
              include: { stages: { orderBy: { order: 'asc' } }, rules: true },
            },
            steps: {
              include: { workflowStage: true },
              orderBy: [
                { workflowStage: { order: 'asc' } },
                { slotIndex: 'asc' },
              ],
            },
            actions: true,
            comments: true,
            assignments: true,
            history: true,
            notifications: true,
          },
        });
      },
    );

    await this.createAudit({
      userId: dto.userId,
      module: definition.module,
      entityType: dto.entityType,
      entityId: dto.entityId,
      action: 'WORKFLOW_REJECTED',
      description: `${definition.name} rejected for ${dto.entityType} #${dto.entityId}`,
      newValue: {
        workflowInstanceId: updatedInstance.id,
        status: updatedInstance.status,
        reason: dto.reason ?? null,
      },
    });

    return {
      workflow: updatedInstance,
      legacyState: this.buildLegacyState({
        status: dto.businessStatus,
        trail: dto.trail ?? getApprovalTrail(instance.metadata),
        action: dto.trailAction ?? 'REJECTED',
        userId: dto.userId,
        approvedBy: dto.approvedByLabel ?? null,
        rejectedAt: new Date(),
        rejectionReason: dto.reason ?? null,
        reason: dto.reason,
      }),
    };
  }

  async commentWorkflow(dto: {
    entityType: string;
    entityId: number;
    userId: number;
    comment: string;
    isInternal?: boolean;
    mentions?: number[];
    organizationId: number;
  }) {
    const organizationId = this.validateOrganization(dto.organizationId);
    const instance = await this.getInstanceByEntity(
      dto.entityType,
      dto.entityId,
      organizationId,
    );
    if (!instance) {
      throw new Error(
        `Workflow instance for ${dto.entityType} #${dto.entityId} not found`,
      );
    }

    await this.prisma.workflowComment.create({
      data: {
        workflowInstanceId: instance.id,
        authorId: dto.userId,
        comment: dto.comment,
        isInternal: dto.isInternal ?? false,
        mentions: toJsonValue(dto.mentions ?? []),
        organizationId: instance.organizationId,
      },
    });

    await this.createAudit({
      userId: dto.userId,
      module: instance.workflowDefinition.module,
      entityType: dto.entityType,
      entityId: dto.entityId,
      action: 'WORKFLOW_COMMENTED',
      description: `Comment added to ${dto.entityType} #${dto.entityId}`,
      newValue: { comment: dto.comment },
    });

    return { ok: true };
  }

  async createAssignedAction(dto: {
    entityType: string;
    entityId: number;
    userId: number;
    actionType: WorkflowActionType;
    comment?: string;
    metadata?: Record<string, unknown>;
    organizationId: number;
  }) {
    const organizationId = this.validateOrganization(dto.organizationId);
    const instance = await this.getInstanceByEntity(
      dto.entityType,
      dto.entityId,
      organizationId,
    );
    if (!instance) {
      throw new Error(
        `Workflow instance for ${dto.entityType} #${dto.entityId} not found`,
      );
    }

    return this.prisma.workflowAction.create({
      data: {
        workflowInstanceId: instance.id,
        actionType: dto.actionType,
        performedBy: dto.userId,
        comment: dto.comment ?? null,
        metadata: toJsonValue(dto.metadata),
        organizationId: instance.organizationId,
      },
    });
  }
}
