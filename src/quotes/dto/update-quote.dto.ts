import { IsNumber, IsString, IsOptional, IsDateString, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { QUOTE_STATUSES, QuoteItemDto } from './create-quote.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQuoteDto {
  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  dealId?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  contactId?: number;

  @IsOptional()
  @IsIn(QUOTE_STATUSES)
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: 'sample-validTill' })
  validTill?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-notes' })
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  @ApiPropertyOptional({ example: [] })
  items?: QuoteItemDto[];
}
