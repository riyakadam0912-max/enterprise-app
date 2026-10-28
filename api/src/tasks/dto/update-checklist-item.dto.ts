import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
