import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
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
  @ApiPropertyOptional({ example: '+1 555 123 4567' })
  phone?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'https://northwind.example' })
  website?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'United States' })
  country?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'California' })
  state?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'San Francisco' })
  city?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '1 Market Street' })
  address?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'America/Los_Angeles' })
  timezone?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'USD' })
  currency?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Enterprise' })
  subscriptionPlan?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 14 })
  trialDays?: number;

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
}
