import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketTypeDto {
  @IsString()
  @ApiProperty({ example: 'sample-name' })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-color' })
  color?: string;
}
