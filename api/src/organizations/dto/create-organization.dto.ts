import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @ApiProperty({ example: 'Northwind Labs' })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Northwind Labs Inc.' })
  legalName?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'northwind-labs' })
  slug?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Software' })
  industry?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '51-200' })
  organizationSize?: string;

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'ops@northwind.example' })
  businessEmail?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+91 9876543210' })
  phone?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'https://northwind.example' })
  website?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'IN', description: 'ISO 3166-1 alpha-2 country code' })
  country?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'MH', description: 'ISO 3166-2 state/region code' })
  state?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Mumbai' })
  city?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '1 Market Street' })
  address?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Asia/Kolkata', description: 'IANA timezone identifier' })
  timezone?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'INR', description: 'ISO 4217 currency code' })
  currency?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Avery Chen' })
  adminName?: string;

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'avery@northwind.example' })
  adminEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @ApiPropertyOptional({ example: 'StrongPass123!' })
  adminPassword?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  sendWelcomeEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  enableImmediately?: boolean;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({
    example: 2,
    description: 'Parent organization ID for hierarchy',
  })
  parentId?: number;
}
