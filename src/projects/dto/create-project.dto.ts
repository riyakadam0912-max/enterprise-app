import { IsString, IsOptional, IsNumber, IsDateString, IsInt, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PROJECT_STATUSES = ['ACTIVE', 'COMPLETED'] as const;

export class CreateProjectDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-name' })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-projectName' })
  projectName?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-projectCode' })
  projectCode?: string;

  @IsOptional() @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  startDate?: string;

  @IsOptional() @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  endDate?: string;

  @IsOptional() @IsDateString()
  @ApiPropertyOptional({ example: 'sample-deadline' })
  deadline?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-manager' })
  manager?: string;

  @IsOptional() @IsInt()
  @ApiPropertyOptional({ example: 123 })
  managerId?: number;

  @IsOptional() @IsString() @IsIn(PROJECT_STATUSES)
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional() @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  budget?: number;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-description' })
  description?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-client' })
  client?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-projectLead' })
  projectLead?: string;
}
