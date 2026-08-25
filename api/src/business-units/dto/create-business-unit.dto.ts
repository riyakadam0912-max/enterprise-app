import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

const BUSINESS_UNIT_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

export class CreateBusinessUnitDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsIn(BUSINESS_UNIT_STATUSES)
  status?: (typeof BUSINESS_UNIT_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number | null;
}
