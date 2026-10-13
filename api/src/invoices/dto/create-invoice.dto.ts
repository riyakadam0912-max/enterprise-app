import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  IsEmail,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const STATUSES = [
  'DRAFT',
  'SENT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
  'REFUNDED',
  'VOIDED',
] as const;
const PAYMENT_METHODS = [
  'Check',
  'Card',
  'Bank Transfer',
  'Online',
  'Cash',
] as const;

const RATE_MODES = ['AMOUNT', 'PERCENTAGE'] as const;

export class InvoiceItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

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
  quantity!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;
}

export class CreateInvoiceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'sample-invoiceNo' })
  invoiceNo!: string;

  @IsOptional()
  @IsNumber()
  customerId?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  customerAddress?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  dueDate?: string;

  @IsOptional()
  @IsIn(STATUSES)
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-customer' })
  customer?: string;

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'billing@client.com' })
  clientEmail?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  totalAmount?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  discount?: number;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  @ApiPropertyOptional({ example: 'sample-paymentMethod' })
  paymentMethod?: string;

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
  @IsIn(RATE_MODES)
  discountType?: (typeof RATE_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  adjustmentAmount?: number;

  @IsOptional()
  @IsIn(RATE_MODES)
  adjustmentType?: (typeof RATE_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];
}
