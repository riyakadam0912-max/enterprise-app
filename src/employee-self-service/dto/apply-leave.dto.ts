import { IsDateString, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyLeaveDto {
  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  startDate!: string;

  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  endDate!: string;

  @IsNotEmpty()
  @IsString()
  leaveType: string; // Casual, Sick, Paid, Unpaid, etc.

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-reason' })
  reason?: string;
}
