import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGoalCycleDto {
  @IsString()
  @ApiProperty({ example: 'sample-name' })
  name!: string;

  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  startDate!: string;

  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  endDate!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;
}
