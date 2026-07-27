export type WorkflowStageTemplate = {
  key: string;
  name: string;
  order: number;
  approvalType:
    | 'SINGLE'
    | 'MULTIPLE'
    | 'UNANIMOUS'
    | 'MAJORITY'
    | 'SEQUENTIAL'
    | 'PARALLEL';
  approvalPolicy?: Record<string, unknown>;
  assignmentRule?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type WorkflowDefinitionTemplate = {
  key: string;
  name: string;
  module: string;
  description: string;
  settings?: Record<string, unknown>;
  stages: WorkflowStageTemplate[];
};

export const WORKFLOW_TEMPLATES: WorkflowDefinitionTemplate[] = [
  {
    key: 'leave-request-approval',
    name: 'Leave Request Approval',
    module: 'HR',
    description:
      'Standard employee leave workflow with manager and HR approval stages.',
    settings: { entityType: 'LeaveRequest' },
    stages: [
      {
        key: 'manager-review',
        name: 'Manager Review',
        order: 1,
        approvalType: 'SEQUENTIAL',
        approvalPolicy: { mode: 'SINGLE', requiredApprovals: 1 },
        assignmentRule: { type: 'MANAGER' },
      },
      {
        key: 'hr-review',
        name: 'HR Review',
        order: 2,
        approvalType: 'SEQUENTIAL',
        approvalPolicy: { mode: 'SINGLE', requiredApprovals: 1 },
        assignmentRule: { type: 'ROLE', value: 'HR' },
      },
    ],
  },
  {
    key: 'expense-approval',
    name: 'Expense Approval',
    module: 'Finance',
    description: 'Expense approval chain for manager and HR/finance review.',
    settings: { entityType: 'Expense' },
    stages: [
      {
        key: 'manager-review',
        name: 'Manager Review',
        order: 1,
        approvalType: 'SEQUENTIAL',
        approvalPolicy: { mode: 'SINGLE', requiredApprovals: 1 },
        assignmentRule: { type: 'MANAGER' },
      },
      {
        key: 'finance-review',
        name: 'Finance Review',
        order: 2,
        approvalType: 'SEQUENTIAL',
        approvalPolicy: { mode: 'SINGLE', requiredApprovals: 1 },
        assignmentRule: { type: 'ROLE', value: 'HR' },
      },
    ],
  },
  {
    key: 'task-review',
    name: 'Task Review',
    module: 'Projects',
    description: 'Task submission and review workflow for project execution.',
    settings: { entityType: 'Task' },
    stages: [
      {
        key: 'review',
        name: 'Review',
        order: 1,
        approvalType: 'SEQUENTIAL',
        approvalPolicy: { mode: 'SINGLE', requiredApprovals: 1 },
        assignmentRule: { type: 'ROLE', value: 'MANAGER' },
      },
    ],
  },
];
