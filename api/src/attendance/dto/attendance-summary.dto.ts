import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AttendanceSummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;

  @IsOptional()
  @Matches(/^(?:19|[2-9]\d)\d{2}-(?:0[1-9]|1[0-2])$/)
  @ApiPropertyOptional({ example: 'sample-month' })
  month?: string;
}
