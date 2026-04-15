import { IsString, IsOptional, IsInt, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeadDto {
  @IsString()
  @ApiProperty({ example: 'sample-name' })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-company' })
  company?: string;

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'user@enterprise.local' })
  email?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+911234567890' })
  phone?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-source' })
  source?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-leadOwner' })
  leadOwner?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  contactedDate?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-nextFollowUp' })
  nextFollowUp?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-assignedTo' })
  assignedTo?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  leadScore?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-createdBy' })
  createdBy?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-notes' })
  notes?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  assignedEmployeeId?: number;
}
