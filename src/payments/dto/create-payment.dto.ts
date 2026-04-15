import { IsInt, IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  invoiceId!: number;

  @IsNumber()
  @ApiProperty({ example: 123 })
  amount!: number;

  @IsString()
  @ApiProperty({ example: 'sample-paymentMethod' })
  paymentMethod!: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 1 })
  transactionId?: string;

  @IsDateString()
  @ApiProperty({ example: '2026-04-14' })
  paymentDate!: string;

  @IsString()
  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
}
