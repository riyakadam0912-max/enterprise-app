import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MoveCandidateStageDto {
  @IsString()
  @ApiProperty({ example: 'sample-stage' })
  stage!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-remarks' })
  remarks?: string;
}
