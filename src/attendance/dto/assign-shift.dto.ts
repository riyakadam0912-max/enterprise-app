import { IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignShiftDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  employeeId!: number;

  @IsInt()
  @ApiProperty({ example: 123 })
  shiftId!: number;
}
