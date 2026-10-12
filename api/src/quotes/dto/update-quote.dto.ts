import {
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  QUOTE_RATE_MODES,
  QUOTE_STATUSES,
  QuoteItemDto,
} from './create-quote.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
  @IsNumber()
  customerId?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  quoteDate?: string;

  @IsOptional()
  @IsString()
  customerAddress?: string;

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
  @IsString()
  termsAndConditions?: string;

  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  adjustmentAmount?: number;

  @IsOptional()
  @IsIn(QUOTE_RATE_MODES)
  discountType?: (typeof QUOTE_RATE_MODES)[number];

  @IsOptional()
  @IsNumber()
  discountRate?: number;

  @IsOptional()
  @IsIn(QUOTE_RATE_MODES)
  adjustmentType?: (typeof QUOTE_RATE_MODES)[number];

  @IsOptional()
  @IsNumber()
  adjustmentRate?: number;

  @IsOptional()
  tdsEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  tdsRate?: number;

  @IsOptional()
  tcsEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  tcsRate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  @ApiPropertyOptional({ example: [] })
  items?: QuoteItemDto[];
}
