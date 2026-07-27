import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { mergeMap, switchMap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import type { AuthenticatedRequest } from '../types/request';

type EntityKind = 'Task' | 'Project';

type RequestWithUser = AuthenticatedRequest & {
  method?: string;
  originalUrl?: string;
  params?: { id?: string };
  body?: { status?: string };
};

type CompletionResponse = {
  status?: string | null;
  assignedToUserId?: number | null;
  managerId?: number | null;
};

@Injectable()
export class CompletionNotificationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CompletionNotificationInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    if ((req.method ?? '').toUpperCase() !== 'PATCH') {
      return next.handle() as Observable<unknown>;
    }

    const entity = this.resolveEntity(context, req);
    const entityId = Number(req.params?.id);

    if (!entity || !Number.isInteger(entityId) || entityId <= 0) {
      return next.handle() as Observable<unknown>;
    }

    return from(this.getCurrentStatus(entity, entityId)).pipe(
      switchMap((previousStatus) =>
        next.handle().pipe(
          mergeMap(async (response: unknown) => {
            const responseData = this.toCompletionResponse(response);
            const updatedStatus = this.extractUpdatedStatus(req, responseData);
            if (
              !this.didTransitionToCompleted(
                entity,
                previousStatus,
                updatedStatus,
              )
            ) {
              return response;
            }

            const ownerUserId = await this.resolveOwnerUserId(
              entity,
              responseData,
              entityId,
            );
            if (!ownerUserId) {
              this.logger.warn(
                `No owner found for ${entity} #${entityId}; skipping completion notification.`,
              );
              return response;
            }

            const actorUserId = req.user?.userId ?? ownerUserId;
            const summary = `${entity} #${entityId} status changed from ${previousStatus ?? 'UNKNOWN'} to ${updatedStatus}.`;

            await this.notificationsService.create({
              userId: ownerUserId,
              title: `${entity} completed`,
              message: summary,
            });

            await this.auditLogsService.create({
              userId: actorUserId,
              userName: req.user?.email,
              userRole: req.user?.role,
              module: entity === 'Task' ? 'Tasks' : 'Projects',
              entityType: entity,
              entityId,
              action: 'STATUS_COMPLETED',
              description: `${entity.toUpperCase()} status completed: ${summary}`,
              status: 'SUCCESS',
            });

            return response;
          }),
        ),
      ),
    );
  }

  private resolveEntity(
    context: ExecutionContext,
    req: RequestWithUser,
  ): EntityKind | null {
    const controllerName = context.getClass().name;
    if (controllerName === 'TasksController') return 'Task';
    if (controllerName === 'ProjectsController') return 'Project';

    const url = req.originalUrl ?? '';
    if (url.includes('/tasks')) return 'Task';
    if (url.includes('/projects')) return 'Project';

    return null;
  }

  private async getCurrentStatus(
    entity: EntityKind,
    entityId: number,
  ): Promise<string | null> {
    if (entity === 'Task') {
      const task = await this.prisma.task.findUnique({
        where: { id: entityId },
        select: { status: true },
      });
      return task?.status ?? null;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: entityId },
      select: { status: true },
    });
    return project?.status ?? null;
  }

  private extractUpdatedStatus(
    req: RequestWithUser,
    response: CompletionResponse | null,
  ): string | null {
    const responseStatus =
      typeof response?.status === 'string' ? response.status : null;
    const requestBody = req.body as { status?: unknown } | undefined;
    const requestStatus =
      typeof requestBody?.status === 'string' ? requestBody.status : null;
    return responseStatus ?? requestStatus;
  }

  private didTransitionToCompleted(
    entity: EntityKind,
    previousStatus: string | null,
    updatedStatus: string | null,
  ): boolean {
    if (!updatedStatus) return false;

    const previous = this.normalize(previousStatus);
    const current = this.normalize(updatedStatus);

    if (previous === current) return false;

    if (entity === 'Project') {
      return current === 'COMPLETED';
    }

    // Tasks currently use APPROVED as the terminal completed state.
    return current === 'COMPLETED' || current === 'APPROVED';
  }

  private async resolveOwnerUserId(
    entity: EntityKind,
    response: CompletionResponse | null,
    entityId: number,
  ): Promise<number | null> {
    if (entity === 'Task') {
      const taskOwner =
        typeof response?.assignedToUserId === 'number'
          ? response.assignedToUserId
          : null;
      if (taskOwner) return taskOwner;

      const task = await this.prisma.task.findUnique({
        where: { id: entityId },
        select: { assignedToUserId: true },
      });
      const assignedToUserId = task?.assignedToUserId;
      return typeof assignedToUserId === 'number' ? assignedToUserId : null;
    }

    const projectOwner =
      typeof response?.managerId === 'number' ? response.managerId : null;
    if (projectOwner) return projectOwner;

    const project = await this.prisma.project.findUnique({
      where: { id: entityId },
      select: { managerId: true },
    });
    const managerId = project?.managerId;
    return typeof managerId === 'number' ? managerId : null;
  }

  private toCompletionResponse(response: unknown): CompletionResponse | null {
    if (typeof response !== 'object' || response === null) {
      return null;
    }

    const record = response as Partial<CompletionResponse>;
    return {
      status: typeof record.status === 'string' ? record.status : null,
      assignedToUserId:
        typeof record.assignedToUserId === 'number'
          ? record.assignedToUserId
          : null,
      managerId: typeof record.managerId === 'number' ? record.managerId : null,
    };
  }

  private normalize(status?: string | null): string {
    return (status ?? '').trim().toUpperCase();
  }
}
