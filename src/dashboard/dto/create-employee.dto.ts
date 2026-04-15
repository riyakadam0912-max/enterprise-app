import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CreateEmployeeDto {
  @ApiProperty({ example: 'sample-fullName' })
  fullName!: string;
  @ApiPropertyOptional({ example: '+911234567890' })
  phone?: string;
  @ApiPropertyOptional({ example: 'sample-position' })
  position?: string;
  @ApiPropertyOptional({ example: 123 })
  salary?: number;
  @ApiProperty({ example: 123 })
  userId!: number;
}
