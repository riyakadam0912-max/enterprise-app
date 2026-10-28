export class TaskQueryDto {
  page?: string;
  pageSize?: string;
  search?: string;
  projectId?: string;
  milestoneId?: string;
  taskListId?: string;
  status?: string;
  priority?: string;
  assignedToUserId?: string;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: string;
  sortDirection?: string;
}
