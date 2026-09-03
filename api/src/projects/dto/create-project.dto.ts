import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsInt,
  IsIn,
  IsUrl,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const PROJECT_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'IN_APPROVAL',
  'BLOCKED_CANCELLED',
  'POSTPONED',
  'COMPLETED',
] as const;

export const PROJECT_TYPES = [
  'EVENT_MANAGEMENT',
  'PRODUCTION_EM',
  'DIGITAL_MARKETING',
  'PRODUCTION_DM',
  'PRODUCTION_OTHER',
  'TECH_PROJECTS',
] as const;

export class CreateProjectDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-name' })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-projectName' })
  projectName?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-projectCode' })
  projectCode?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  endDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: 'sample-deadline' })
  deadline?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-manager' })
  manager?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  managerId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ description: 'Optional owner user ID.' })
  ownerId?: number | null;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(PROJECT_TYPES)
  projectType?: string;

  @IsOptional()
  @IsString()
  specificTask?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  finalDeliverablesLink?: string;

  @IsOptional()
  @IsUrl()
  @ApiPropertyOptional({ example: 'https://drive.google.com/drive/folders/example' })
  driveLink?: string;

  @IsOptional()
  @IsString()
  @IsIn(PROJECT_STATUSES)
  @ApiPropertyOptional({ example: 'NOT_STARTED' })
  status?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  budget?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-description' })
  description?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-client' })
  client?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-projectLead' })
  projectLead?: string;
}
