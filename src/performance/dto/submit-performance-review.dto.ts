import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitPerformanceReviewDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  employeeId!: number;

  @IsInt()
  @ApiProperty({ example: 123 })
  goalCycleId!: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  rating?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-summary' })
  summary?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-strengths' })
  strengths?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-improvements' })
  improvements?: string;
}
