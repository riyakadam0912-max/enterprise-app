export class CreateWorkflowDefinitionDto {
  key!: string;
  name!: string;
  module!: string;
  description?: string;
  settings?: Record<string, unknown>;
  stages!: Array<{
    key: string;
    name: string;
    order: number;
    approvalType?:
      | 'SINGLE'
      | 'MULTIPLE'
      | 'UNANIMOUS'
      | 'MAJORITY'
      | 'SEQUENTIAL'
      | 'PARALLEL';
    approvalPolicy?: Record<string, unknown>;
    assignmentRule?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }>;
  rules?: Array<{
    name: string;
    priority?: number;
    condition: Record<string, unknown>;
    action: Record<string, unknown>;
  }>;
}
