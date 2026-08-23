import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Updated Name' })
  name?: string;

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'user@enterprise.local' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @ApiPropertyOptional({ example: 'sample-password' })
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  @ApiPropertyOptional({ example: 'EMPLOYEE' })
  role?: Role;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  managerId?: number | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 2 })
  organizationId?: number | null;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Senior Software Engineer' })
  designation?: string;
}
