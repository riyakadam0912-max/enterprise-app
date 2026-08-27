import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityTimelineGateway } from './activity-timeline.gateway';
import type {
  ActivityTimelineCommentRecord,
  ActivityTimelinePayload,
  ActivityTimelineRecord,
} from './activity-timeline.types';
import { QueryActivityTimelineDto } from './dto/query-activity-timeline.dto';
import type { AuthUser } from '../common/types/auth';

type ActivityTimelineRow = {
  id: number;
  organizationId: number;
  module: string;
  entityType: string;
  entityId: number;
  eventType: string;
  action: string;
  title: string;
  description: string | null;
  oldValue: Prisma.JsonValue | null;
  newValue: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  performedBy: number | null;
  performedByRole: string | null;
  assignedTo: number | null;
  status: string;
  priority: string;
  icon: string | null;
  color: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  attachments: Prisma.JsonValue | null;
  workflowStage: string | null;
  approvalStatus: string | null;
  createdAt: Date;
  comments?: unknown[];
};

type ActivityTimelineCommentRow = {
  id: number;
  timelineId: number;
  organizationId: number;
  userId: number | null;
  userRole: string | null;
  comment: string;
  parentCommentId: number | null;
  mentions: Prisma.JsonValue | null;
  isInternal: boolean;
  createdAt: Date;
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function normalizePriority(priority?: string | null): string {
  const value = (priority ?? 'MEDIUM').toUpperCase();
  return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(value)
    ? value
    : 'MEDIUM';
}

function normalizeStatus(status?: string | null): string {
  const value = (status ?? 'OPEN').toUpperCase();
  return ['OPEN', 'INFO', 'SUCCESS', 'WARNING', 'ERROR', 'DONE'].includes(value)
    ? value
    : 'OPEN';
}

function normalizeEventType(eventType: string): string {
  return eventType.trim().toUpperCase();
}

function toMetadataMap(
  value: Prisma.InputJsonValue | null | undefined,
): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

@Injectable()
export class ActivityTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ActivityTimelineGateway,
  ) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('Organization ID not found');
    }
    return user.organizationId;
  }

  private async getOrganizationId(
    user?: AuthUser,
    payload?: Partial<ActivityTimelinePayload> & { userId?: number | null },
    explicitOrganizationId?: number,
  ): Promise<number> {
    if (explicitOrganizationId) {
      return explicitOrganizationId;
    }
    if (user?.organizationId) {
      return user.organizationId;
    }
    // Try to get from performedBy or userId in payload
    const userId = payload?.performedBy || payload?.userId;
    if (userId) {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });
      if (userRecord?.organizationId) {
        return userRecord.organizationId;
      }
    }
    throw new ForbiddenException('Organization ID could not be determined');
  }

  async createEvent(
    payload: ActivityTimelinePayload,
    user?: AuthUser,
    explicitOrganizationId?: number,
  ): Promise<ActivityTimelineRecord> {
    const organizationId = await this.getOrganizationId(
      user,
      payload,
      explicitOrganizationId,
    );
    const record = await this.prisma.activityTimeline.create({
      data: {
        organizationId,
        module: payload.module,
        entityType: payload.entityType,
        entityId: payload.entityId,
        eventType: normalizeEventType(payload.eventType),
        action: payload.action ?? normalizeEventType(payload.eventType),
        title: payload.title,
        description: payload.description ?? null,
        oldValue: toJson(payload.oldValue),
        newValue: toJson(payload.newValue),
        metadata: toJson(payload.metadata),
        performedBy: payload.performedBy ?? null,
        performedByRole: payload.performedByRole ?? null,
        assignedTo: payload.assignedTo ?? null,
        status: normalizeStatus(payload.status),
        priority: normalizePriority(payload.priority),
        icon: payload.icon ?? null,
        color: payload.color ?? null,
        ipAddress: payload.ipAddress ?? null,
        deviceInfo: payload.deviceInfo ?? null,
        attachments: toJson(payload.attachments),
        workflowStage: payload.workflowStage ?? null,
        approvalStatus: payload.approvalStatus ?? null,
      },
    });

    this.gateway.emitTimelineCreated({
      module: record.module,
      entityType: record.entityType,
      entityId: record.entityId,
      timelineId: record.id,
      performedBy: record.performedBy,
    });

    return this.toRecord(record);
  }

  async logCreate(
    payload: Omit<ActivityTimelinePayload, 'eventType' | 'action' | 'title'> & {
      title?: string;
    },
    user?: AuthUser,
    explicitOrganizationId?: number,
  ) {
    return this.createEvent(
      {
        ...payload,
        eventType: 'CREATED',
        action: 'CREATED',
        title: payload.title ?? `${payload.entityType} created`,
        status: 'SUCCESS',
        priority: payload.priority ?? 'MEDIUM',
      },
      user,
      explicitOrganizationId,
    );
  }

  async logUpdate(
    payload: Omit<ActivityTimelinePayload, 'eventType' | 'action' | 'title'> & {
      title?: string;
    },
    user?: AuthUser,
    explicitOrganizationId?: number,
  ) {
    return this.createEvent(
      {
        ...payload,
        eventType: 'UPDATED',
        action: 'UPDATED',
        title: payload.title ?? `${payload.entityType} updated`,
        status: 'INFO',
        priority: payload.priority ?? 'MEDIUM',
      },
      user,
      explicitOrganizationId,
    );
  }

  async logAssignment(
    payload: Omit<ActivityTimelinePayload, 'eventType' | 'action'> & {
      title?: string;
    },
    user?: AuthUser,
    explicitOrganizationId?: number,
  ) {
    return this.createEvent(
      {
        ...payload,
        eventType: payload.assignedTo ? 'ASSIGNED' : 'UNASSIGNED',
        action: payload.assignedTo ? 'ASSIGNED' : 'UNASSIGNED',
        title:
          payload.title ??
          (payload.assignedTo
            ? `${payload.entityType} assigned`
            : `${payload.entityType} unassigned`),
        status: 'INFO',
        priority: payload.priority ?? 'MEDIUM',
      },
      user,
      explicitOrganizationId,
    );
  }

  async logApproval(
    payload: Omit<
      ActivityTimelinePayload,
      'eventType' | 'action' | 'status'
    > & { approved: boolean; title?: string },
    user?: AuthUser,
    explicitOrganizationId?: number,
  ) {
    return this.createEvent(
      {
        ...payload,
        eventType: payload.approved ? 'APPROVED' : 'REJECTED',
        action: payload.approved ? 'APPROVED' : 'REJECTED',
        title:
          payload.title ??
          (payload.approved
            ? `${payload.entityType} approved`
            : `${payload.entityType} rejected`),
        status: payload.approved ? 'SUCCESS' : 'ERROR',
        priority: payload.priority ?? 'HIGH',
        approvalStatus: payload.approved ? 'APPROVED' : 'REJECTED',
      },
      user,
      explicitOrganizationId,
    );
  }

  async logComment(
    payload: Omit<ActivityTimelinePayload, 'eventType' | 'action' | 'title'> & {
      title?: string;
      comment: string;
    },
    user?: AuthUser,
    explicitOrganizationId?: number,
  ) {
    return this.createEvent(
      {
        ...payload,
        eventType: 'COMMENTED',
        action: 'COMMENTED',
        title: payload.title ?? `${payload.entityType} commented on`,
        description: payload.description ?? payload.comment,
        status: 'INFO',
        priority: payload.priority ?? 'LOW',
        metadata: {
          ...toMetadataMap(payload.metadata),
          comment: payload.comment,
        },
      },
      user,
      explicitOrganizationId,
    );
  }

  async logWorkflowEvent(
    payload: Omit<ActivityTimelinePayload, 'eventType' | 'action'> & {
      workflowEvent: string;
      title?: string;
    },
    user?: AuthUser,
    explicitOrganizationId?: number,
  ) {
    return this.createEvent(
      {
        ...payload,
        eventType: 'WORKFLOW_EVENT',
        action: payload.workflowEvent,
        title:
          payload.title ??
          `${payload.entityType} workflow ${payload.workflowEvent.toLowerCase()}`,
        status: 'INFO',
        priority: payload.priority ?? 'HIGH',
        metadata: {
          ...toMetadataMap(payload.metadata),
          workflowEvent: payload.workflowEvent,
        },
      },
      user,
      explicitOrganizationId,
    );
  }

  async getEntityTimeline(
    entityType: string,
    entityId: number,
    query: Partial<QueryActivityTimelineDto> = {},
    user: AuthUser,
  ) {
    const organizationId = this.validateOrganization(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityTimelineWhereInput = {
      organizationId,
      entityType,
      entityId,
      ...(query.module ? { module: query.module } : {}),
      ...(query.eventType
        ? { eventType: { contains: query.eventType, mode: 'insensitive' } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { action: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.activityTimeline.count({ where }),
      this.prisma.activityTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      }),
    ]);

    return {
      items: items.map((item) => this.toRecord(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getTimeline(
    query: Partial<QueryActivityTimelineDto> = {},
    user: AuthUser,
  ) {
    const organizationId = this.validateOrganization(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityTimelineWhereInput = {
      organizationId,
      ...(query.module ? { module: query.module } : {}),
      ...(query.eventType
        ? { eventType: { contains: query.eventType, mode: 'insensitive' } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { action: { contains: query.search, mode: 'insensitive' } },
              { entityType: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.activityTimeline.count({ where }),
      this.prisma.activityTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      }),
    ]);

    return {
      items: items.map((item) => this.toRecord(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getUserActivity(
    userId: number,
    query: Partial<QueryActivityTimelineDto> = {},
    user: AuthUser,
  ) {
    const organizationId = this.validateOrganization(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityTimelineWhereInput = {
      organizationId,
      OR: [
        { performedBy: userId },
        { assignedTo: userId },
        { comments: { some: { userId, organizationId } } },
      ],
      ...(query.module ? { module: query.module } : {}),
      ...(query.eventType
        ? { eventType: { contains: query.eventType, mode: 'insensitive' } }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.activityTimeline.count({ where }),
      this.prisma.activityTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      }),
    ]);

    return {
      items: items.map((item) => this.toRecord(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getModuleActivity(
    module: string,
    query: Partial<QueryActivityTimelineDto> = {},
    user: AuthUser,
  ) {
    const organizationId = this.validateOrganization(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityTimelineWhereInput = {
      organizationId,
      module,
      ...(query.eventType
        ? { eventType: { contains: query.eventType, mode: 'insensitive' } }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.activityTimeline.count({ where }),
      this.prisma.activityTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      }),
    ]);

    return {
      items: items.map((item) => this.toRecord(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getTimelineSince(
    sinceISO: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      module?: string;
      eventType?: string;
      entityType?: string;
      entityId?: number;
      userId?: number;
      moduleName?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {},
    user: AuthUser,
  ) {
    const organizationId = this.validateOrganization(user);
    const sinceDate = new Date(sinceISO);
    const validSince = !Number.isNaN(sinceDate.getTime())
      ? sinceDate
      : new Date(Date.now() - 60 * 60 * 1000);

    const where: Prisma.ActivityTimelineWhereInput = {
      organizationId,
      createdAt: { gte: validSince },
      ...(query.module ? { module: query.module } : {}),
      ...(query.moduleName ? { module: query.moduleName } : {}),
      ...(query.eventType
        ? { eventType: { contains: query.eventType, mode: 'insensitive' } }
        : {}),
      ...(query.entityType && typeof query.entityId === 'number'
        ? { entityType: query.entityType, entityId: query.entityId }
        : {}),
      ...(typeof query.userId === 'number'
        ? {
            OR: [{ performedBy: query.userId }, { assignedTo: query.userId }],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.activityTimeline.count({ where }),
      this.prisma.activityTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      }),
    ]);

    return {
      items: items.map((item) => this.toRecord(item)),
      meta: {
        page: 1,
        limit: 100,
        total,
        totalPages: Math.max(1, Math.ceil(total / 100)),
        hasNextPage: 100 < total,
        hasPreviousPage: false,
      },
      syncCursor: new Date().toISOString(),
    };
  }

  async deleteTimelineEvent(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.prisma.activityTimelineComment.deleteMany({
      where: { timelineId: id, organizationId },
    });
    await this.prisma.activityTimeline.delete({
      where: { id, organizationId },
    });
    return { deleted: true };
  }

  async addComment(
    params: {
      timelineId: number;
      userId?: number;
      userRole?: string;
      comment: string;
      mentions?: number[];
      parentCommentId?: number;
      isInternal?: boolean;
    },
    user: AuthUser,
  ) {
    const organizationId = this.validateOrganization(user);
    const timeline = await this.prisma.activityTimeline.findUnique({
      where: { id: params.timelineId, organizationId },
    });
    if (!timeline) {
      throw new NotFoundException(`Timeline #${params.timelineId} not found`);
    }

    const comment = await this.prisma.activityTimelineComment.create({
      data: {
        organizationId,
        timelineId: params.timelineId,
        userId: params.userId ?? null,
        userRole: params.userRole ?? null,
        comment: params.comment,
        parentCommentId: params.parentCommentId ?? null,
        mentions: toJson(params.mentions ?? []),
        isInternal: params.isInternal ?? false,
      },
    });

    this.gateway.emitEntityRefresh(timeline.entityType, timeline.entityId);
    if (params.userId) {
      this.gateway.emitUserRefresh(params.userId);
    }

    return this.toComment(comment);
  }

  private toRecord(record: ActivityTimelineRow): ActivityTimelineRecord {
    return {
      ...record,
      oldValue: record.oldValue ?? null,
      newValue: record.newValue ?? null,
      metadata: record.metadata ?? null,
      attachments: record.attachments ?? null,
      createdAt: record.createdAt.toISOString(),
      commentsCount: Array.isArray(record.comments)
        ? record.comments.length
        : undefined,
    };
  }

  private toComment(
    record: ActivityTimelineCommentRow,
  ): ActivityTimelineCommentRecord {
    return {
      ...record,
      mentions: record.mentions ?? null,
      createdAt: new Date(record.createdAt as Date | string).toISOString(),
    };
  }
}
