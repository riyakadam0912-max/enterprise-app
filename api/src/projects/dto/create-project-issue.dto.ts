import { IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateProjectIssueDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsInt()
  taskId?: number;

  @IsOptional()
  @IsInt()
  assignedToId?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
