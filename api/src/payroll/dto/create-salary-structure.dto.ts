import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalaryComponentDto } from './salary-component.dto';

export class CreateSalaryStructureDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  employeeId: number = 0;

  @IsOptional()
  @IsInt()
  templateId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualCtc?: number;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryComponentDto)
  components?: SalaryComponentDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ example: 123 })
  basic?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ example: 123 })
  hra?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ example: 123 })
  allowances?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ example: 123 })
  deductions?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ example: 123 })
  pf?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ example: 123 })
  esi?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ example: 123 })
  professionalTax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ example: 123 })
  tds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualPf?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualEsi?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualProfessionalTax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualTds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualOtherDeductions?: number;
}
