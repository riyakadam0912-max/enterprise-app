import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MarkPayrollEntryPaidDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-remarks' })
  remarks?: string;
}
