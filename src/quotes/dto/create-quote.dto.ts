import {
  IsNumber, IsString, IsOptional, IsDateString, IsIn,
  IsArray, ValidateNested, IsInt, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const QUOTE_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'] as const;

export class QuoteItemDto {
  @IsString()
  @ApiProperty({ example: 'sample-name' })
  name: string = '';

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 123 })
  quantity: number = 1;

  @IsNumber()
  @Min(0)
  @ApiProperty({ example: 123 })
  price: number = 0;
}

export class CreateQuoteDto {
  @IsNumber()
  @ApiProperty({ example: 123 })
  dealId: number = 0;

  @IsNumber()
  @ApiProperty({ example: 123 })
  contactId: number = 0;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  @ApiProperty({ example: [] })
  items: QuoteItemDto[] = [];
}
