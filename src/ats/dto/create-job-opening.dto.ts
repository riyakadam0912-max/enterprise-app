import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJobOpeningDto {
  @IsString()
  @ApiProperty({ example: 'sample-title' })
  title!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-department' })
  department?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-location' })
  location?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-employmentType' })
  employmentType?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-description' })
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 123 })
  openings?: number;
}
