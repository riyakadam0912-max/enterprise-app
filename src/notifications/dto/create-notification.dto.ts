import { IsInt, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  userId!: number;

  @IsString()
  @ApiProperty({ example: 'sample-title' })
  title!: string;

  @IsString()
  @ApiProperty({ example: 'sample-message' })
  message!: string;
}
