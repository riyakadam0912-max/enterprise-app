import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLedgerEntryDto {
  @IsDateString()
  @IsOptional()
  @ApiPropertyOptional({ example: '2026-04-14' })
  date?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ example: 'sample-description' })
  description?: string;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 123 })
  debit?: number;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 123 })
  credit?: number;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ example: 'sample-account' })
  account?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ example: 'sample-invoice' })
  invoice?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ example: 'sample-expense' })
  expense?: string;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 123 })
  balance?: number;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ example: 'sample-reference' })
  reference?: string;
}
