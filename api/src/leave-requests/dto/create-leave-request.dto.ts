import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsIn,
  ValidateIf,
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
  'COMP_OFF',
] as const;

type LeaveType = (typeof LEAVE_TYPES)[number];
const REQUEST_TYPES = ['LEAVE', 'WORK_FROM_HOME'] as const;
export type LeaveRequestType = (typeof REQUEST_TYPES)[number];
const LEAVE_DURATIONS = ['FULL_DAY', 'HALF_DAY'] as const;
export type LeaveDuration = (typeof LEAVE_DURATIONS)[number];

export class CreateLeaveRequestDto {
  @IsOptional()
  @IsIn(REQUEST_TYPES)
  @ApiPropertyOptional({ enum: REQUEST_TYPES, default: 'LEAVE' })
  requestType?: LeaveRequestType;

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

  @ValidateIf((request: CreateLeaveRequestDto) =>
    (request.requestType ?? 'LEAVE') === 'LEAVE',
  )
  @IsString()
  @IsIn(LEAVE_TYPES)
  @ApiPropertyOptional({ enum: LEAVE_TYPES })
  leaveType?: LeaveType;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-reason' })
  reason?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;
}
