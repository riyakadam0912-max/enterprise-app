import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { DealStatusUpdatedEvent } from '../events/deal-status-updated.event';

/**
 * DealWonActionService
 * Handles creating projects, tasks, and audit logs when a deal status changes to WON.
 * All operations are wrapped in a Prisma transaction for data consistency.
 */
@Injectable()
export class DealWonActionService {
  private readonly logger = new Logger(DealWonActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Processes a deal status update event
   * If the new status is 'WON', creates a project, kickoff task, and audit log in a transaction
   */
  async handleDealStatusUpdate(event: DealStatusUpdatedEvent): Promise<{
    deal: any;
    project: any;
    task: any;
    auditLog: any;
    skipped: boolean;
    reason?: string;
  }> {
    this.logger.debug(
      `Processing deal #${event.dealId} status change: ${event.previousStage} → ${event.newStage}`,
    );

    // Only process transitions TO 'WON' status
    if (event.newStage !== 'WON') {
      return {
        deal: null,
        project: null,
        task: null,
        auditLog: null,
        skipped: true,
        reason: `Status change to '${event.newStage}' does not trigger actions`,
      };
    }

    // If already WON, skip to avoid duplicate processing
    if (event.previousStage === 'WON') {
      return {
        deal: null,
        project: null,
        task: null,
        auditLog: null,
        skipped: true,
        reason: 'Deal is already in WON status',
      };
    }

    try {
      // Fetch the deal with all required relationships
      const deal = await this.prisma.deal.findUnique({
        where: { id: event.dealId },
        include: {
          linkedContact: {
            select: { id: true, contactName: true, company: true, email: true },
          },
          assignedEmployee: { select: { id: true, name: true } },
        },
      });

      if (!deal) {
        throw new NotFoundException(`Deal #${event.dealId} not found`);
      }

      // Execute all operations within a single transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Create Project from Deal
        const project = await tx.project.create({
          data: {
            projectName: `${deal.title} - Project Implementation`,
            projectCode: `PRJ-${deal.id}-${Date.now()}`,
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
            managerId: deal.assignedToId,
            manager: deal.assignedEmployee?.name || deal.owner || 'Unassigned',
            status: 'PLANNED',
            budget: deal.value,
            description: `Project created from won deal: ${deal.title}`,
            client:
              deal.linkedContact?.company ||
              deal.contact ||
              deal.linkedContact?.contactName ||
              'Client TBD',
            projectLead: deal.linkedContact?.contactName || deal.contact || 'Primary Contact',
          },
        });

        this.logger.debug(`Created project #${project.id} from deal #${event.dealId}`);

        // 2. Create 'Project Kickoff' Task
        const task = await tx.task.create({
          data: {
            taskName: 'Project Kickoff',
            project: project.projectName,
            projectId: project.id,
            assignee: deal.linkedContact?.contactName || deal.contact || 'Client',
            assignedToId: deal.assignedToId,
            status: 'PENDING',
            priority: 'HIGH',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
            estimatedHours: 8,
            notes:
              'Kickoff meeting to align on project scope, timeline, and deliverables. ' +
              'Includes initial requirements gathering and team introduction.',
            dealId: event.dealId,
          },
        });

        this.logger.debug(`Created kickoff task #${task.id} for project #${project.id}`);

        // 3. Create AuditLog entry
        const auditLog = await tx.auditLog.create({
          data: {
            userId: event.triggeredByUserId || 0, // System user if not provided
            action: 'DEAL_WON_WORKFLOW',
            entity: 'DEAL',
            entityId: event.dealId,
          },
        });

        this.logger.debug(`Created audit log #${auditLog.id} for deal #${event.dealId}`);

        return { project, task, auditLog };
      });

      return {
        deal,
        project: result.project,
        task: result.task,
        auditLog: result.auditLog,
        skipped: false,
      };
    } catch (error) {
      this.logger.error(
        `Error processing deal won workflow for deal #${event.dealId}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }
}
