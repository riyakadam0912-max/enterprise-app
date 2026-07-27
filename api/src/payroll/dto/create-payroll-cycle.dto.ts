import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePayrollCycleDto {
  @IsString()
  @ApiProperty({ example: 'sample-name' })
  name!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  @ApiProperty({ example: 123 })
  month!: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  @ApiProperty({ example: 123 })
  year!: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-notes' })
  notes?: string;
}
