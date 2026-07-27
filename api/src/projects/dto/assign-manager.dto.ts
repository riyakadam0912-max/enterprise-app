import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignManagerDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  managerId!: number;
}
