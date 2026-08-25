import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  MinLength,
  IsInt,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';

const EMPLOYEE_ALLOWED_ROLES: string[] = [Role.EMPLOYEE, Role.MANAGER, Role.HR];

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'sample-name' })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'user@enterprise.local' })
  email?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+911234567890' })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-department' })
  department?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-designation' })
  designation?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  hireDate?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-manager' })
  manager?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  leaveBalance?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @ApiPropertyOptional({
    example: 'sample-password',
    description:
      'If provided, a login User account will be created for this employee.',
  })
  password?: string;

  @IsOptional()
  @IsIn(EMPLOYEE_ALLOWED_ROLES)
  @ApiPropertyOptional({
    example: 'EMPLOYEE',
    description:
      'Role for the login account. Used only when password is provided. Defaults to EMPLOYEE. Allowed: EMPLOYEE, MANAGER, HR.',
  })
  role?: Role;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({
    example: 10,
    description:
      'Manager user ID for the login account. Used only when password is provided.',
  })
  managerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({ example: 1, description: 'Optional active shift ID for the employee.' })
  shiftId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({ example: 1, description: 'Optional Business Unit ID for the employee.' })
  businessUnitId?: number;
}
