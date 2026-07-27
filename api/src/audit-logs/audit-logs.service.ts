import { ForbiddenException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { getAuditContext } from './audit-context';
import type { AuthUser } from '../common/types/auth';
import { Role } from '../common/enums/role.enum';

type AuditStatus = 'SUCCESS' | 'FAILURE';

type AuditLogInput = {
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  module: string;
  entityType: string;
  entityId?: number | null;
  action: string;
  fieldName?: string | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  description?: string | null;
  ipAddress?: string | null;
  deviceInfo?: string | null;
  requestMethod?: string | null;
  endpoint?: string | null;
  status?: AuditStatus;
};

type AuditQuery = {
  page?: number;
  limit?: number;
  module?: string;
  entityType?: string;
  entityId?: number;
  userId?: number;
  action?: string;
  role?: string;
  search?: string;
  from?: Date;
  to?: Date;
};

type AuditReadScope = {
  canReadAll: boolean;
  organizationId: number | null;
};

const SENSITIVE_KEYS = /password|token|refreshToken|otp|secret|apiKey|session/i;

function stringifyStable(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return '[unsupported value]';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value))
    return `[${value.map((item) => stringifyStable(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  return `{${entries.map(([key, entry]) => `${key}:${stringifyStable(entry)}`).join(',')}}`;
}

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.test(key) ? '***' : redactValue(entry);
  }

  return result;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined) return null;
  const sanitized = redactValue(value);
  if (sanitized === null) return null;
  if (
    typeof sanitized === 'string' ||
    typeof sanitized === 'number' ||
    typeof sanitized === 'boolean'
  )
    return sanitized;
  return sanitized as Prisma.InputJsonValue;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async resolveOrganizationId(
    user?: AuthUser,
    actor?: { userId?: number | null } | null,
  ): Promise<number> {
    const contextOrganizationId = getAuditContext().organizationId;
    if (contextOrganizationId != null) {
      return contextOrganizationId;
    }

    if (user?.organizationId != null) {
      return user.organizationId;
    }

    const actorUserId = actor?.userId;
    if (actorUserId != null) {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: actorUserId },
        select: { organizationId: true },
      });
      if (userRecord?.organizationId != null) {
        return userRecord.organizationId;
      }
    }

    // Fallback: use the default (first) organization
    const defaultOrg = await this.prisma.organization.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    if (!defaultOrg) {
      throw new Error(
        'No organizations found in database. Cannot create audit log. Please ensure at least one organization exists.',
      );
    }

    return defaultOrg.id;
  }

  private isGlobalAuditReader(user: AuthUser): boolean {
    return (
      user.role === Role.SUPER_ADMIN || user.roles.includes(Role.SUPER_ADMIN)
    );
  }

  private getReadScope(user: AuthUser): AuditReadScope {
    if (this.isGlobalAuditReader(user)) {
      return { canReadAll: true, organizationId: null };
    }

    if (user.organizationId == null) {
      throw new ForbiddenException('User has no associated organization');
    }

    return { canReadAll: false, organizationId: user.organizationId };
  }

  async create(dto: CreateAuditLogDto, user?: AuthUser) {
    const organizationId = await this.resolveOrganizationId(user, dto);
    return this.prisma.auditLog.create({
      data: this.buildData(dto, organizationId),
    });
  }

  async logCreate(input: AuditLogInput, user?: AuthUser) {
    return this.createRows(
      [
        {
          ...input,
          action: input.action || 'CREATE',
          description:
            input.description ?? this.buildDescription('created', input),
        },
      ],
      user,
    );
  }

  async logUpdate(
    input: AuditLogInput & {
      oldValue?: unknown;
      newValue?: unknown;
      fieldName?: string;
    },
    user?: AuthUser,
  ) {
    return this.createRows(
      [
        {
          ...input,
          action: input.action || 'UPDATE',
          oldValue: toJsonValue(input.oldValue) ?? undefined,
          newValue: toJsonValue(input.newValue) ?? undefined,
          description:
            input.description ?? this.buildDescription('updated', input),
        },
      ],
      user,
    );
  }

  async logDelete(input: AuditLogInput, user?: AuthUser) {
    return this.createRows(
      [
        {
          ...input,
          action: input.action || 'DELETE',
          description:
            input.description ?? this.buildDescription('deleted', input),
        },
      ],
      user,
    );
  }

  async logLogin(
    input: AuditLogInput & { success: boolean; reason?: string },
    user?: AuthUser,
  ) {
    return this.createRows(
      [
        {
          ...input,
          action: input.success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILURE',
          status: input.success ? 'SUCCESS' : 'FAILURE',
          description:
            input.description ??
            (input.success
              ? 'User logged in successfully'
              : (input.reason ?? 'Login failed')),
        },
      ],
      user,
    );
  }

  async logLogout(input: AuditLogInput, user?: AuthUser) {
    return this.createRows(
      [
        {
          ...input,
          action: input.action || 'LOGOUT',
          description: input.description ?? 'User logged out',
        },
      ],
      user,
    );
  }

  async logCustomAction(input: AuditLogInput, user?: AuthUser) {
    return this.createRows(
      [
        {
          ...input,
          action: input.action || 'CUSTOM_ACTION',
          description:
            input.description ??
            this.buildDescription('performed action on', input),
        },
      ],
      user,
    );
  }

  async logFieldDiffs(
    params: {
      module: string;
      entityType: string;
      entityId?: number | null;
      action: string;
      oldRecord: Record<string, unknown> | null;
      newRecord: Record<string, unknown> | null;
      userOverrides?: Partial<AuditLogInput>;
      description?: string;
    },
    user?: AuthUser,
  ) {
    if (!params.oldRecord || !params.newRecord) {
      return null;
    }

    const changedEntries: AuditLogInput[] = [];
    const keys = new Set([
      ...Object.keys(params.oldRecord),
      ...Object.keys(params.newRecord),
    ]);

    for (const key of keys) {
      if (key === 'createdAt' || key === 'updatedAt' || key === 'deletedAt')
        continue;
      const oldValue = redactValue(params.oldRecord[key]);
      const newValue = redactValue(params.newRecord[key]);
      if (stringifyStable(oldValue) === stringifyStable(newValue)) continue;

      changedEntries.push({
        userId: params.userOverrides?.userId ?? null,
        userName: params.userOverrides?.userName ?? null,
        userRole: params.userOverrides?.userRole ?? null,
        module: params.module,
        entityType: params.entityType,
        entityId:
          params.entityId ??
          (params.newRecord.id as number | null | undefined) ??
          null,
        action: params.action,
        fieldName: key,
        oldValue: toJsonValue(oldValue),
        newValue: toJsonValue(newValue),
        description:
          params.description ??
          `${capitalize(params.action.toLowerCase())} ${params.entityType} field ${key}`,
      });
    }

    if (changedEntries.length === 0) {
      return null;
    }

    return this.createRows(changedEntries, user);
  }

  async findAll(query: AuditQuery = {}, user: AuthUser) {
    const scope = this.getReadScope(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 25)));
    const skip = (page - 1) * limit;
    const where = this.buildWhere(query, scope);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: number, user: AuthUser) {
    const scope = this.getReadScope(user);
    return this.prisma.auditLog.findFirst({
      where: scope.canReadAll
        ? { id }
        : { id, organizationId: scope.organizationId as number },
    });
  }

  async findByUser(
    userId: number,
    query: Omit<AuditQuery, 'userId'> = {},
    user: AuthUser,
  ) {
    return this.findAll({ ...query, userId }, user);
  }

  async findByModule(
    module: string,
    query: Omit<AuditQuery, 'module'> = {},
    user: AuthUser,
  ) {
    return this.findAll({ ...query, module }, user);
  }

  async findByEntity(entityType: string, entityId: number, user: AuthUser) {
    const scope = this.getReadScope(user);
    return this.prisma.auditLog.findMany({
      where: scope.canReadAll
        ? { entityType, entityId }
        : {
            entityType,
            entityId,
            organizationId: scope.organizationId as number,
          },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async createRows(rows: AuditLogInput[], user?: AuthUser) {
    const organizationId = await this.resolveOrganizationId(user, rows[0]);
    if (rows.length === 1) {
      const created = await this.prisma.auditLog.create({
        data: this.buildData(rows[0], organizationId),
      });
      this.eventEmitter.emit('audit.log.created', created);
      return created;
    }

    const created = await this.prisma.auditLog.createMany({
      data: rows.map((row) => this.buildData(row, organizationId)),
    });

    for (const row of rows) {
      this.eventEmitter.emit(
        'audit.log.created',
        this.buildData(row, organizationId),
      );
    }

    return created;
  }

  private buildData(input: AuditLogInput, organizationId: number) {
    const context = getAuditContext();
    return {
      userId: input.userId ?? context.userId ?? undefined,
      userName: input.userName ?? context.userName ?? undefined,
      userRole: input.userRole ?? context.userRole ?? undefined,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      action: input.action,
      fieldName: input.fieldName ?? undefined,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined,
      description: input.description ?? undefined,
      ipAddress: input.ipAddress ?? context.ipAddress ?? undefined,
      deviceInfo: input.deviceInfo ?? context.deviceInfo ?? undefined,
      requestMethod: input.requestMethod ?? context.requestMethod ?? undefined,
      endpoint: input.endpoint ?? context.endpoint ?? undefined,
      status: input.status ?? 'SUCCESS',
      organizationId,
    };
  }

  private buildDescription(verb: string, input: AuditLogInput) {
    const actor = input.userRole || input.userName || 'System';
    const target =
      input.entityType && input.entityId
        ? `${input.entityType} #${input.entityId}`
        : input.entityType;
    return `${actor} ${verb} ${target} in ${input.module}`;
  }

  private buildWhere(query: AuditQuery, scope: AuditReadScope) {
    const filters: Prisma.AuditLogWhereInput[] = [];

    if (!scope.canReadAll) {
      // When not reading all, organizationId is guaranteed to be a number
      filters.push({ organizationId: scope.organizationId as number });
    }
    if (query.module) filters.push({ module: query.module });
    if (query.entityType) filters.push({ entityType: query.entityType });
    if (query.entityId !== undefined)
      filters.push({ entityId: query.entityId });
    if (query.userId !== undefined) filters.push({ userId: query.userId });
    if (query.action)
      filters.push({ action: { contains: query.action, mode: 'insensitive' } });
    if (query.role)
      filters.push({ userRole: { contains: query.role, mode: 'insensitive' } });
    if (query.search) {
      filters.push({
        OR: [
          { userName: { contains: query.search, mode: 'insensitive' } },
          { module: { contains: query.search, mode: 'insensitive' } },
          { entityType: { contains: query.search, mode: 'insensitive' } },
          { action: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { fieldName: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.from || query.to) {
      filters.push({
        createdAt: {
          gte: query.from,
          lte: query.to,
        },
      });
    }

    if (filters.length === 0) return {};
    if (filters.length === 1) return filters[0];
    return { AND: filters };
  }
}

export type { AuditLogInput };
export { AuditLogsService as AuditLogService };
