import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHolidayDto {
  @IsDateString()
  @ApiProperty({ example: '2026-10-02' })
  startDate!: string;

  @IsDateString()
  @ApiProperty({ example: '2026-10-03' })
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiProperty({ example: 'Founders Day' })
  name!: string;
}