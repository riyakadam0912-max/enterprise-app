import { IsString, IsNumber, IsOptional, IsIn, IsInt, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DEAL_STAGES = ['NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const;

export class CreateDealDto {
  @IsString()
  @ApiProperty({ example: 'sample-title' })
  title!: string;

  @IsNumber()
  @ApiProperty({ example: 123 })
  value!: number;

  @IsOptional()
  @IsIn(DEAL_STAGES)
  @ApiPropertyOptional({ example: 'sample-stage' })
  stage?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  probability?: number;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  closeDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  actualCloseDate?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-contact' })
  contact?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-owner' })
  owner?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-pipeline' })
  pipeline?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  leadId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  contactId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;
}
