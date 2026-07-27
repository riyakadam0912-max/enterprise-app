import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ACTIVITY_TYPES = [
  'CALL',
  'EMAIL',
  'MEETING',
  'NOTE',
  'STATUS_CHANGE',
  'DEAL_CREATED',
  'LEAD_CONVERTED',
] as const;

export class CreateActivityDto {
  @IsIn(ACTIVITY_TYPES)
  type!: (typeof ACTIVITY_TYPES)[number];

  @IsString()
  @ApiProperty({ example: 'sample-description' })
  description!: string;

  @IsInt()
  @ApiProperty({ example: 123 })
  userId!: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  leadId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  dealId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  contactId?: number;
}
