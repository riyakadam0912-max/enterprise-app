import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const SHIFT_TYPES = ['FIXED', 'FLEXIBLE', 'ROTATIONAL'] as const;

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(SHIFT_TYPES)
  type?: (typeof SHIFT_TYPES)[number];

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  requiredHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  minPresentHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(180)
  gracePeriodMinutes?: number;

  @IsOptional()
  @IsString()
  rotationPattern?: string;
}
