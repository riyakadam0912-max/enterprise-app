import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class SwitchBusinessUnitDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  businessUnitId?: number | null;
}
