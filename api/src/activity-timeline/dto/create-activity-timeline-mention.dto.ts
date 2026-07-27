import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateActivityTimelineMentionDto {
  @IsString()
  @ApiPropertyOptional({ example: 'Task updated' })
  title!: string;

  @IsString()
  @ApiPropertyOptional({ example: 'Rahul, please review this item.' })
  message!: string;

  @IsString()
  @ApiPropertyOptional({ example: 'Tasks' })
  module!: string;

  @IsString()
  @ApiPropertyOptional({ example: 'Task' })
  entityType!: string;

  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 42 })
  entityId!: number;

  @IsOptional()
  @IsArray()
  @ApiPropertyOptional({ example: [12] })
  recipientIds?: number[];

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 7 })
  actorUserId?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '/dashboard/tasks/42' })
  actionUrl?: string;
}
