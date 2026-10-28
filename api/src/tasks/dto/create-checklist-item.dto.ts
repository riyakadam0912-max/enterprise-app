import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateChecklistItemDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
