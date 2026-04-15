import { IsString, IsOptional, IsInt, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @IsString()
  @ApiProperty({ example: 'sample-eventName' })
  eventName: string = '';

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-eventCode' })
  eventCode?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  startDateTime?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  endDateTime?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-location' })
  location?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-organizer' })
  organizer?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  capacity?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-description' })
  description?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-eventType' })
  eventType?: string;
}
