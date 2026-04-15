import { IsString, IsOptional, IsInt, IsDateString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const LEAVE_TYPES = ['SICK', 'CASUAL', 'PAID', 'UNPAID', 'MATERNITY', 'PATERNITY', 'MEDICAL', 'OTHER'] as const;
const LEAVE_STATUSES = ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

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
  leaveType!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-reason' })
  reason?: string;

  @IsOptional()
  @IsIn(LEAVE_STATUSES)
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: 'sample-appliedOn' })
  appliedOn?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-approvedBy' })
  approvedBy?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;
}
