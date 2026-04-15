import { IsString, IsNumber, IsOptional, IsIn, IsDateString, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTimesheetDto {
  @IsString()
  @ApiProperty({ example: 'sample-task' })
  task!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-project' })
  project?: string;

  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  date!: string;

  @IsNumber()
  @ApiProperty({ example: 123 })
  hours!: number;

  @IsOptional()
  @IsIn(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'])
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-notes' })
  notes?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;
}
