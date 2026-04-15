import { IsString, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFileAttachmentDto {
  @IsString()
  @ApiProperty({ example: 'sample-entityType' })
  entityType!: string;

  @IsInt()
  @ApiProperty({ example: 123 })
  entityId!: number;
}
