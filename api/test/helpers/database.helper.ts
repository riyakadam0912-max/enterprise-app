import { PrismaClient } from '@prisma/client';

// List of all tables in reverse order of dependencies to avoid foreign key issues
const TABLES = [
  'ImportLog',
  'PerformanceReview',
  'Goal',
  'GoalCycle',
  'Interview',
  'Candidate',
  'JobOpening',
  'PayrollConfig',
  'Form16',
  'TaxDeclaration',
  'PayrollDeduction',
  'PayrollEarnings',
  'Payslip',
  'SalaryStructure',
  'PayrollEntry',
  'PayrollCycle',
  'WorkflowNotification',
  'WorkflowHistory',
  'WorkflowAssignment',
  'WorkflowComment',
  'WorkflowAction',
  'WorkflowStep',
  'WorkflowStage',
  'WorkflowRule',
  'WorkflowInstance',
  'WorkflowDefinition',
  'ActivityTimelineComment',
  'ActivityTimeline',
  'AuditLog',
  'FileActivity',
  'File',
  'FileAttachment',
  'NotificationDeliveryLog',
  'NotificationPreference',
  'NotificationRecipient',
  'Notification',
  'Payment',
  'Product',
  'ProductCategory',
  'QuoteItem',
  'Quote',
  'DynamicForm',
  'Event',
  'Activity',
  'Contact',
  'ProjectMember',
  'ProjectLink',
  'ProjectMessage',
  'Task',
  'Project',
  'Expense',
  'MarketingCampaign',
  'FormSubmission',
  'Ticket',
  'TicketType',
  'LeaveRequest',
  'Deal',
  'CampaignLead',
  'Timesheet',
  'LedgerEntry',
  'Invoice',
  'Attendance',
  'Shift',
  'Employee',
  'UserRole',
  'RolePermission',
  'Permission',
  'AppRole',
  'User',
  'Organization',
];

export class DatabaseHelper {
  private static prisma: PrismaClient | null = null;

  static getPrismaClient(): PrismaClient {
    if (!this.prisma) {
      this.prisma = new PrismaClient();
    }
    return this.prisma;
  }

  static async truncateAllTables(): Promise<void> {
    const prisma = this.getPrismaClient();
    for (const table of TABLES) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`,
      );
    }
  }

  static async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }
}
