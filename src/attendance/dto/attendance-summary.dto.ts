import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttendanceSummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  @ApiPropertyOptional({ example: 'sample-month' })
  month?: string;
}
