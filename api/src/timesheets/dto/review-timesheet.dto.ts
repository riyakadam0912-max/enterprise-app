import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewTimesheetDto {
  @IsIn(['APPROVED', 'REJECTED'])
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @ApiPropertyOptional({ maxLength: 1000 })
  reason?: string;
}
