import { IsOptional, IsString, IsPhoneNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+911234567890' })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-address' })
  address?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-emergencyContact' })
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+911234567890' })
  emergencyContactPhone?: string;
}
