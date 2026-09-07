import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePayslipDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @ApiPropertyOptional({ example: 4 })
  month?: number;

  @IsInt()
  @IsOptional()
  @Min(2000)
  @ApiPropertyOptional({ example: 2026 })
  year?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  basicSalary?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  hra?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  allowances?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  bonus?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  overtime?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  reimbursements?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  pfDeduction?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  esiDeduction?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  professionalTax?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  tdsDeduction?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  lossOfPay?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  otherDeductions?: number;
}