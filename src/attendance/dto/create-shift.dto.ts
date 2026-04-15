import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SHIFT_TYPES = ['FIXED', 'FLEXIBLE', 'ROTATIONAL'] as const;

export class CreateShiftDto {
  @IsString()
  @ApiProperty({ example: 'sample-name' })
  name!: string;

  @IsIn(SHIFT_TYPES)
  type!: (typeof SHIFT_TYPES)[number];

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-startTime' })
  startTime?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-endTime' })
  endTime?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  requiredHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  @ApiPropertyOptional({ example: 123 })
  gracePeriodMinutes?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-rotationPattern' })
  rotationPattern?: string;
}
