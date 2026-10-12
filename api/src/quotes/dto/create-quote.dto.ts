import {
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const QUOTE_STATUSES = [
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'CONVERTED',
  'EXPIRED',
] as const;
export const QUOTE_RATE_MODES = ['AMOUNT', 'PERCENTAGE'] as const;

export class QuoteItemDto {
  @IsString()
  @ApiProperty({ example: 'sample-name' })
  name: string = '';

  @IsOptional()
  @IsNumber()
  productId?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsIn(['GOODS', 'SERVICE'])
  type?: 'GOODS' | 'SERVICE';

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 123 })
  quantity: number = 1;

  @IsNumber()
  @Min(0)
  @ApiProperty({ example: 123 })
  price: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}

export class CreateQuoteDto {
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

  @IsDateString()
  @ApiProperty({ example: 'sample-validTill' })
  validTill: string = '';

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
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  adjustmentAmount?: number;

  @IsOptional()
  @IsIn(QUOTE_RATE_MODES)
  discountType?: (typeof QUOTE_RATE_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountRate?: number;

  @IsOptional()
  @IsIn(QUOTE_RATE_MODES)
  adjustmentType?: (typeof QUOTE_RATE_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  adjustmentRate?: number;

  @IsOptional()
  @IsBoolean()
  tdsEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tdsRate?: number;

  @IsOptional()
  @IsBoolean()
  tcsEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tcsRate?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  @ApiProperty({ example: [] })
  items: QuoteItemDto[] = [];
}
