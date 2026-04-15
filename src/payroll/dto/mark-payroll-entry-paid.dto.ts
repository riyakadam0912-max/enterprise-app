import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MarkPayrollEntryPaidDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-remarks' })
  remarks?: string;
}
