import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScheduleInterviewDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  candidateId!: number;

  @IsDateString()
  @ApiProperty({ example: 'sample-scheduledAt' })
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  interviewerId?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-mode' })
  mode?: string;
}
