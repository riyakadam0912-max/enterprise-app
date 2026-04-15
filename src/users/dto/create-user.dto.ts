import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @IsString()
  @ApiProperty({ example: 'sample-name' })
  name!: string;

  @IsEmail()
  @ApiProperty({ example: 'user@enterprise.local' })
  email!: string;

  @IsString()
  @MinLength(6)
  @ApiProperty({ example: 'sample-password' })
  password!: string;

  @IsEnum(Role)
  @ApiProperty({ example: 'sample-role' })
  role!: Role;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  employeeId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  managerId?: number;
}
