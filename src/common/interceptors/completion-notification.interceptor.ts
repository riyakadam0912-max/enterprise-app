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

type EntityKind = 'Task' | 'Project';

type RequestWithUser = {
  method?: string;
  originalUrl?: string;
  params?: { id?: string };
  body?: { status?: string };
  user?: { userId?: number };
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
      return next.handle();
    }

    const entity = this.resolveEntity(context, req);
    const entityId = Number(req.params?.id);

    if (!entity || !Number.isInteger(entityId) || entityId <= 0) {
      return next.handle();
    }

    return from(this.getCurrentStatus(entity, entityId)).pipe(
      switchMap((previousStatus) =>
        next.handle().pipe(
          mergeMap(async (response: any) => {
            const updatedStatus = this.extractUpdatedStatus(req, response);
            if (!this.didTransitionToCompleted(entity, previousStatus, updatedStatus)) {
              return response;
            }

            const ownerUserId = await this.resolveOwnerUserId(entity, response, entityId);
            if (!ownerUserId) {
              this.logger.warn(`No owner found for ${entity} #${entityId}; skipping completion notification.`);
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
              action: `${entity.toUpperCase()}_STATUS_COMPLETED: ${summary}`,
              entity,
              entityId,
            });

            return response;
          }),
        ),
      ),
    );
  }

  private resolveEntity(context: ExecutionContext, req: RequestWithUser): EntityKind | null {
    const controllerName = context.getClass().name;
    if (controllerName === 'TasksController') return 'Task';
    if (controllerName === 'ProjectsController') return 'Project';

    const url = req.originalUrl ?? '';
    if (url.includes('/tasks')) return 'Task';
    if (url.includes('/projects')) return 'Project';

    return null;
  }

  private async getCurrentStatus(entity: EntityKind, entityId: number): Promise<string | null> {
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

  private extractUpdatedStatus(req: RequestWithUser, response: any): string | null {
    const responseStatus = typeof response?.status === 'string' ? response.status : null;
    const requestStatus = typeof req.body?.status === 'string' ? req.body.status : null;
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
    response: any,
    entityId: number,
  ): Promise<number | null> {
    if (entity === 'Task') {
      const taskOwner = typeof response?.assignedToUserId === 'number'
        ? response.assignedToUserId
        : null;
      if (taskOwner) return taskOwner;

      const task = await this.prisma.task.findUnique({
        where: { id: entityId },
        select: { assignedToUserId: true },
      });
      return task?.assignedToUserId ?? null;
    }

    const projectOwner = typeof response?.managerId === 'number' ? response.managerId : null;
    if (projectOwner) return projectOwner;

    const project = await this.prisma.project.findUnique({
      where: { id: entityId },
      select: { managerId: true },
    });
    return project?.managerId ?? null;
  }

  private normalize(status?: string | null): string {
    return (status ?? '').trim().toUpperCase();
  }
}
