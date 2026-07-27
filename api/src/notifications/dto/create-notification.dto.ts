import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateNotificationDto {
  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  userId?: number;

  @IsOptional()
  @IsArray()
  @ApiPropertyOptional({ example: [123, 124] })
  recipientIds?: number[];

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'APPROVAL' })
  type?: string;

  @IsString()
  @ApiProperty({ example: 'sample-title' })
  title!: string;

  @IsString()
  @ApiProperty({ example: 'sample-message' })
  message!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Leave' })
  module?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'LeaveRequest' })
  entityType?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 41 })
  entityId?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '/dashboard/leave' })
  actionUrl?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'HIGH' })
  priority?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'APPROVAL' })
  category?: string;
}
