import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class QueryNotificationsDto {
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @IsInt()
  @ApiPropertyOptional({ example: 1 })
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @IsInt()
  @ApiPropertyOptional({ example: 20 })
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  unreadOnly?: boolean;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Tasks' })
  module?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'APPROVAL' })
  type?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'HIGH' })
  priority?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  @ApiPropertyOptional({ example: 'desc' })
  sortDirection?: 'asc' | 'desc';
}
