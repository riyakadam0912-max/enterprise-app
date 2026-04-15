import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'] as const;

export class UpdateAttendanceDto {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  date?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: 'sample-checkIn' })
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: 'sample-checkOut' })
  checkOut?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
