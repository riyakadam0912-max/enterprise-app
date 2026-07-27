import { IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AuditLogStatus } from '../audit-log.types';

export class CreateAuditLogDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  userId!: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Jane Manager' })
  userName?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'MANAGER' })
  userRole?: string;

  @IsString()
  @ApiProperty({ example: 'Tasks' })
  module!: string;

  @IsString()
  @ApiProperty({ example: 'Task' })
  entityType!: string;

  @IsString()
  @ApiProperty({ example: 'sample-action' })
  action!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'status' })
  fieldName?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  entityId?: number;

  @IsOptional()
  @ApiPropertyOptional({ example: 'Updated task status' })
  description?: string;

  @IsOptional()
  @ApiPropertyOptional({ example: 'SUCCESS', enum: ['SUCCESS', 'FAILURE'] })
  status?: AuditLogStatus;
}
