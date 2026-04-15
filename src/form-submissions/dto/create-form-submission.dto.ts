import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFormSubmissionDto {
  @IsString()
  @ApiProperty({ example: 'sample-form' })
  form!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-submittedBy' })
  submittedBy?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  submissionDate?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-data' })
  data?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-reviewer' })
  reviewer?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  reviewDate?: string;
}
