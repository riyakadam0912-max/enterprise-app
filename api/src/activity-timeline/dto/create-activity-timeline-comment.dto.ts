import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateActivityTimelineCommentDto {
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 1 })
  timelineId!: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 12 })
  parentCommentId?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 12 })
  userId?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'HR' })
  userRole?: string;

  @IsString()
  @ApiPropertyOptional({ example: 'Please review this update.' })
  comment!: string;

  @IsOptional()
  @IsArray()
  @ApiPropertyOptional({ example: [41, 42] })
  mentions?: number[];

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: false })
  isInternal?: boolean;
}
