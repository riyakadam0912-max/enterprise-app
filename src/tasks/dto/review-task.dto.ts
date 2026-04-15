import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewTaskDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  @ApiProperty({ example: 'sample-decision' })
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-comment' })
  comment?: string;
}
