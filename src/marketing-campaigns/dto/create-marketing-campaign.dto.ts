import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMarketingCampaignDto {
  @IsString()
  @ApiProperty({ example: 'sample-campaignName' })
  campaignName!: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-channel' })
  channel?: string;

  @IsOptional() @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  startDate?: string;

  @IsOptional() @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  endDate?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-objective' })
  objective?: string;

  @IsOptional() @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  budget?: number;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-targetAudience' })
  targetAudience?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-createdBy' })
  createdBy?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-campaignOwner' })
  campaignOwner?: string;
}
