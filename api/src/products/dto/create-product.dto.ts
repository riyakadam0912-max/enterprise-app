import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @IsString()
  @ApiProperty({ example: 'sample-name' })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-description' })
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsIn(['GOODS', 'SERVICE'])
  type?: 'GOODS' | 'SERVICE';

  @IsNumber()
  @ApiProperty({ example: 123 })
  price!: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-sku' })
  sku?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  categoryId?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  taxRate?: number;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  isActive?: boolean;
}
