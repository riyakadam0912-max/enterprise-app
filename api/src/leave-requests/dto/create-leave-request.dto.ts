import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const LEAVE_TYPES = [
  'SICK',
  'CASUAL',
  'PAID',
  'UNPAID',
  'MATERNITY',
  'PATERNITY',
  'MEDICAL',
  'OTHER',
] as const;

type LeaveType = (typeof LEAVE_TYPES)[number];
const LEAVE_DURATIONS = ['FULL_DAY', 'HALF_DAY'] as const;
export type LeaveDuration = (typeof LEAVE_DURATIONS)[number];

export class CreateLeaveRequestDto {
  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  startDate!: string;

  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  endDate!: string;

  @IsOptional()
  @IsIn(LEAVE_DURATIONS)
  @ApiPropertyOptional({ enum: LEAVE_DURATIONS, default: 'FULL_DAY' })
  duration?: LeaveDuration;

  @IsString()
  @IsIn(LEAVE_TYPES)
  @ApiProperty({ example: 'sample-leaveType' })
  leaveType!: LeaveType;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-reason' })
  reason?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;
}
