import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  IsEmail,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
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

export class CreateInvoiceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'sample-invoiceNo' })
  invoiceNo!: string;

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
}
