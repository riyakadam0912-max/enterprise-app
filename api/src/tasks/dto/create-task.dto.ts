import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsInt,
  IsIn,
  IsUrl,
  IsArray,
  ArrayUnique,
  IsPositive,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const TASK_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
] as const;
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const TASK_TYPES = ['GENERAL', 'SHOOT'] as const;

export class CreateTaskDto {
  @IsOptional()
  @IsString()
  @IsIn(TASK_TYPES)
  taskType?: (typeof TASK_TYPES)[number];

  @IsOptional()
  @IsString()
  shootClientName?: string;

  @IsOptional()
  @IsString()
  shootLocation?: string;

  @IsOptional()
  @IsDateString()
  shootDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  shootReportingTime?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  shootEstimatedHours?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  shootCrewUserIds?: number[];

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
  @IsInt()
  @ApiPropertyOptional({ description: 'Optional parent task ID for subtasks.' })
  parentTaskId?: number | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ description: 'Optional project milestone ID.' })
  milestoneId?: number | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ description: 'Optional project task list ID.' })
  taskListId?: number | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example:
      'Describe what the employee needs to do. Include steps, context, and reference materials.',
  })
  description?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Development' })
  category?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'https://example.com, https://docs.example.com/spec',
  })
  links?: string;

  @IsOptional()
  @IsUrl()
  @ApiPropertyOptional({
    example: 'https://drive.google.com/drive/folders/example',
  })
  driveLink?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-assignee' })
  assignee?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-01' })
  startDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 100 })
  completionPercent?: number;

  @IsOptional()
  @IsString()
  @IsIn(TASK_PRIORITIES)
  @ApiPropertyOptional({ example: 'MEDIUM', enum: TASK_PRIORITIES })
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
