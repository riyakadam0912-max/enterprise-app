import { IsNotEmpty, IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitExpenseDto {
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({ example: 123 })
  amount!: number;

  @IsNotEmpty()
  @IsString()
  category: string; // Travel, Food, Accommodation, Other, etc.

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'sample-description' })
  description!: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  expenseDate?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-currency' })
  currency?: string;
}
