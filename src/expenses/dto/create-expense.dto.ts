import { IsString, IsOptional, IsNumber, IsDateString, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExpenseDto {
  @IsOptional() @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  expenseDate?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-category' })
  category?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-description' })
  description?: string;

  @IsOptional() @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  amount?: number;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-currency' })
  currency?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-receiptImage' })
  receiptImage?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'sample-approvedBy' })
  approvedBy?: string;

  @IsOptional() @IsString()
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional() @IsInt()
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;
}
