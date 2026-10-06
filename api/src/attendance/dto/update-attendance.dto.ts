import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const STATUSES = [
  'PRESENT',
  'ABSENT',
  'HALF_DAY',
  'LEAVE',
  'HOLIDAY',
  'WEEKLY_OFF',
] as const;

class UpdateAttendanceBreakDto {
  @IsDateString()
  startedAt!: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string | null;
}

export class UpdateAttendanceDto {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  date?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: 'sample-checkIn' })
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: 'sample-checkOut' })
  checkOut?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpdateAttendanceBreakDto)
  @ApiPropertyOptional({
    type: [UpdateAttendanceBreakDto],
    example: [
      {
        startedAt: '2026-10-06T13:00:00.000Z',
        endedAt: '2026-10-06T14:00:00.000Z',
      },
    ],
  })
  breaks?: UpdateAttendanceBreakDto[];
}
