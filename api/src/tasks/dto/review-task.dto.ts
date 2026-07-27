import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewTaskDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'APPROVED' })
  status?: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  @ApiProperty({ example: 'sample-decision' })
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-comment' })
  comment?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Provide clearer requirements before resubmitting.',
  })
  remarks?: string;
}
