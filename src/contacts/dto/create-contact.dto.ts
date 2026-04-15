import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactDto {
  @IsString()
  @ApiProperty({ example: 'sample-contactName' })
  contactName!: string;

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'user@enterprise.local' })
  email?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+911234567890' })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-company' })
  company?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-jobTitle' })
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-leadSource' })
  leadSource?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-address' })
  address?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-website' })
  website?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-linkedin' })
  linkedin?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'ACTIVE' })
  contactStatus?: string;
}
