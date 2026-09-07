import { IsDateString, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTimesheetDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Updated task description' })
  task?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Project Alpha' })
  project?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  date?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 7.5 })
  hours?: number;

  @IsOptional()
  @IsIn(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'])
  @ApiPropertyOptional({ example: 'SUBMITTED' })
  status?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Updated notes' })
  notes?: string;
}
