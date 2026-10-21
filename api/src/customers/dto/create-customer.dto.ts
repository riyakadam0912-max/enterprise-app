import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType } from '@prisma/client';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @ApiProperty({ example: 'Acme Corporation' })
  customerName!: string;

  @IsOptional()
  @IsEnum(CustomerType)
  @ApiPropertyOptional({ enum: CustomerType, example: CustomerType.BUSINESS })
  customerType?: CustomerType;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'ACME' })
  shortName?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '221B Baker Street' })
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Suite 400' })
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Mumbai' })
  city?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Maharashtra' })
  state?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'India' })
  country?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '400001' })
  zipCode?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'https://acme.example.com' })
  webAddress?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'hello@acme.example.com' })
  email?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+911234567890' })
  phoneNumber?: string;
}
