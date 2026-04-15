import { IsString, IsOptional, IsNumber, IsDateString, IsInt, IsIn, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;

export class CreateTaskDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-title' })
  title?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-taskName' })
  taskName?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-project' })
  project?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  projectId?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-description' })
  description?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-assignee' })
  assignee?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-priority' })
  priority?: string;

  @IsOptional()
  @IsString()
  @IsIn(TASK_STATUSES)
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsUrl()
  @ApiPropertyOptional({ example: 'sample-submissionLink' })
  submissionLink?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-reviewComment' })
  reviewComment?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  estimatedHours?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  actualHours?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-notes' })
  notes?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  leadId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  dealId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  assignedToUserId?: number;
}
