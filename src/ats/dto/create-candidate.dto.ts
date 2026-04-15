import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCandidateDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  jobOpeningId!: number;

  @IsString()
  @ApiProperty({ example: 'sample-name' })
  name!: string;

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
  @ApiPropertyOptional({ example: 'sample-resumeUrl' })
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-source' })
  source?: string;
}
