import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export const SALARY_COMPONENT_CATEGORIES = [
  'EARNING',
  'EMPLOYER_CONTRIBUTION',
  'DEDUCTION',
  'REIMBURSEMENT',
] as const;

export const SALARY_CALCULATION_TYPES = [
  'FIXED',
  'PERCENT_OF_CTC',
  'PERCENT_OF_BASIC',
  'RESIDUAL',
] as const;

export class SalaryComponentDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  payslipName?: string;

  @IsIn(SALARY_COMPONENT_CATEGORIES)
  category!: (typeof SALARY_COMPONENT_CATEGORIES)[number];

  @IsIn(SALARY_CALCULATION_TYPES)
  calculationType!: (typeof SALARY_CALCULATION_TYPES)[number];

  @IsNumber()
  @Min(0)
  calculationValue!: number;

  @IsNumber()
  @Min(0)
  monthlyAmount!: number;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;

  @IsOptional()
  @IsBoolean()
  prorated?: boolean;

  @IsOptional()
  @IsBoolean()
  includedInCtc?: boolean;

  @IsOptional()
  @IsBoolean()
  showInPayslip?: boolean;

  @IsOptional()
  @IsBoolean()
  isManualOverride?: boolean;
}

export class SalaryComponentsContainerDto {
  @ValidateNested({ each: true })
  @Type(() => SalaryComponentDto)
  components!: SalaryComponentDto[];
}
