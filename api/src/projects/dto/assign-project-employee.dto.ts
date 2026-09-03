import { IsInt, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignProjectEmployeeDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  employeeId!: number;

  @IsOptional()
  @IsUrl()
  @ApiPropertyOptional({ example: 'https://drive.google.com/drive/folders/example' })
  driveLink?: string;
}