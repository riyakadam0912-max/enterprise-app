import {
  IsDateString,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  ValidateIf,
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
  @IsOptional()
  @IsIn(['LEAVE', 'WORK_FROM_HOME'])
  @ApiPropertyOptional({ enum: ['LEAVE', 'WORK_FROM_HOME'], default: 'LEAVE' })
  requestType?: 'LEAVE' | 'WORK_FROM_HOME';

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

  @ValidateIf((request: ApplyLeaveDto) =>
    (request.requestType ?? 'LEAVE') === 'LEAVE',
  )
  @IsNotEmpty()
  @IsString()
  leaveType!: ApplyLeaveType;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-reason' })
  reason?: string;
}
