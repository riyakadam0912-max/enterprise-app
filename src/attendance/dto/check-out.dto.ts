import { IsDateString, IsInt, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckOutDto {
  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  date?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: 'sample-timestamp' })
  timestamp?: string;
}
