import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGoalDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  employeeId!: number;

  @IsInt()
  @ApiProperty({ example: 123 })
  goalCycleId!: number;

  @IsString()
  @ApiProperty({ example: 'sample-title' })
  title!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-description' })
  description?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  weightage?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-targetMetric' })
  targetMetric?: string;
}
