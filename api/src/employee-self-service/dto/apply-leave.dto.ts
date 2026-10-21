import {
  IsDateString,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ApplyLeaveType =
  | 'SICK'
  | 'CASUAL'
  | 'PAID'
  | 'UNPAID'
  | 'MATERNITY'
  | 'PATERNITY'
  | 'MEDICAL'
  | 'OTHER'
  | 'COMP_OFF';

export class ApplyLeaveDto {
  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  startDate!: string;

  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  endDate!: string;

  @IsOptional()
  @IsIn(['FULL_DAY', 'HALF_DAY'])
  @ApiPropertyOptional({ enum: ['FULL_DAY', 'HALF_DAY'], default: 'FULL_DAY' })
  duration?: 'FULL_DAY' | 'HALF_DAY';

  @IsNotEmpty()
  @IsString()
  leaveType!: ApplyLeaveType;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-reason' })
  reason?: string;
}
