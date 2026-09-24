import { IsEmail, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType } from '@prisma/client';

export class CreateCustomerDto {
  @IsString()
  @ApiProperty({ example: 'Acme Corporation' })
  customerName!: string;

  @IsEnum(CustomerType)
  @ApiProperty({ enum: CustomerType, example: CustomerType.BUSINESS })
  customerType!: CustomerType;

  @IsString()
  @ApiProperty({ example: '221B Baker Street' })
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Suite 400' })
  addressLine2?: string;

  @IsString()
  @ApiProperty({ example: 'Mumbai' })
  city!: string;

  @IsString()
  @ApiProperty({ example: 'Maharashtra' })
  state!: string;

  @IsString()
  @ApiProperty({ example: 'India' })
  country!: string;

  @IsString()
  @ApiProperty({ example: '400001' })
  zipCode!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @ApiPropertyOptional({ example: 'https://acme.example.com' })
  webAddress?: string;

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'hello@acme.example.com' })
  email?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+911234567890' })
  phoneNumber?: string;
}
