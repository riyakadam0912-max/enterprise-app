import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UploadFileDto {
  @IsString()
  module: string;

  @IsString()
  entityType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  entityId: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsBooleanString()
  isPublic?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  replaceFileId?: number;
}
