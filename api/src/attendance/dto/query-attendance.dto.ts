import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const STATUSES = [
  'PRESENT',
  'ABSENT',
  'HALF_DAY',
  'LEAVE',
  'HOLIDAY',
  'WEEKLY_OFF',
  'LATE',
  'UPCOMING',
  'NOT_STARTED',
  'NOT_SCHEDULED',
] as const;

const ATTENDANCE_QUEUE_FILTERS = [
  'WORKING',
  'NOT_CHECKED_IN',
  'LATE',
  'FOLLOW_UP',
] as const;

export class QueryAttendanceDto {
  @IsOptional()
  @IsIn(['full', 'none'])
  summaryMode?: 'full' | 'none';
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 123 })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiPropertyOptional({ example: 123 })
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 123 })
  organizationId?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-department' })
  department?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @ApiPropertyOptional({ example: '2026-04-14' })
  date?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @ApiPropertyOptional({ example: '2026-04-14' })
  fromDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  all?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(9999)
  @ApiPropertyOptional({ example: 2026 })
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @ApiPropertyOptional({ example: 8 })
  month?: number;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsIn(ATTENDANCE_QUEUE_FILTERS)
  attentionFilter?: (typeof ATTENDANCE_QUEUE_FILTERS)[number];
}
