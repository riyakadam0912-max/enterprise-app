export interface LeadDetailActivityUserDto {
  id: number;
  name: string;
  email: string;
}

export interface LeadDetailActivityDto {
  id: number;
  type: string;
  description: string;
  userId: number;
  leadId: number | null;
  dealId: number | null;
  contactId: number | null;
  createdAt: Date | string;
  user: LeadDetailActivityUserDto;
}

export interface LeadDetailTaskUserDto {
  id: number;
  name: string;
  email: string;
}

export interface LeadDetailProjectDto {
  id: number;
  projectName: string;
  managerId: number | null;
}

export interface LeadDetailTaskDto {
  id: number;
  taskName: string;
  title?: string | null;
  description?: string | null;
  project: string | null;
  projectId: number | null;
  projectRef: LeadDetailProjectDto | null;
  assignee: string | null;
  assignedToUserId: number | null;
  assignedByUserId: number | null;
  assignedToUser: LeadDetailTaskUserDto | null;
  assignedByUser: LeadDetailTaskUserDto | null;
  dueDate: Date | string | null;
  priority: string | null;
  status: string;
  submissionLink: string | null;
  reviewComment: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  notes: string | null;
  leadId: number | null;
  dealId: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface LeadDetailDto {
  lead: Record<string, unknown>;
  activities: LeadDetailActivityDto[];
  tasks: LeadDetailTaskDto[];
}
