export class WorkflowStartDto {
  definitionKey!: string;
  entityType!: string;
  entityId!: number;
  initiatedBy!: number;
  organizationId!: number;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  businessStatus?: string;
  trailAction?: 'SUBMITTED';
}
