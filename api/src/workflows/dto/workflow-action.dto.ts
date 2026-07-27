export class WorkflowActionDto {
  businessStatus?: string;
  trailAction?: 'SUBMITTED' | 'MANAGER_APPROVED' | 'HR_APPROVED' | 'REJECTED';
  comment?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}
