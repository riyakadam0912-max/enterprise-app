import { IsString, IsOptional, IsInt, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampaignLeadDto {
  @IsString()
  @ApiProperty({ example: 'sample-campaign' })
  campaign!: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  leadId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  engagementScore?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-sourceType' })
  sourceType?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: 'sample-lastInteraction' })
  lastInteraction?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-notes' })
  notes?: string;
}
