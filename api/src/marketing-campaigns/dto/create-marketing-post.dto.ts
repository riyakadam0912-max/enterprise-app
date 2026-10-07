import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const MARKETING_POST_PLATFORMS = [
  'Instagram',
  'Facebook',
  'LinkedIn',
  'X',
  'Other',
] as const;

export const MARKETING_POST_STATUSES = ['DRAFT', 'SCHEDULED'] as const;

export class CreateMarketingPostDto {
  @IsString()
  @MinLength(1)
  @ApiProperty({ example: 'Our latest company update...' })
  content!: string;

  @IsIn(MARKETING_POST_PLATFORMS)
  @ApiProperty({ enum: MARKETING_POST_PLATFORMS })
  platform!: (typeof MARKETING_POST_PLATFORMS)[number];

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-10-05T13:30:00.000Z' })
  scheduledAt?: string;

  @IsOptional()
  @IsIn(MARKETING_POST_STATUSES)
  @ApiPropertyOptional({ enum: MARKETING_POST_STATUSES })
  status?: (typeof MARKETING_POST_STATUSES)[number];
}
