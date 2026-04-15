import { IsString, IsNumber, IsOptional, IsDateString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const STATUSES = ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED'] as const;
const PAYMENT_METHODS = ['Check', 'Card', 'Bank Transfer', 'Online', 'Cash'] as const;

export class CreateInvoiceDto {
  @IsString()
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
