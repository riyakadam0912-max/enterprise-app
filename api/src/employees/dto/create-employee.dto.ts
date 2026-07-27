import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
