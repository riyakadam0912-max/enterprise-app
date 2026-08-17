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

export class CreateLeaveRequestDto {
  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  startDate!: string;

  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  endDate!: string;

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
