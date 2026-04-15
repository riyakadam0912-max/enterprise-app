import { IsInt, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAuditLogDto {
  @IsInt()
  @ApiProperty({ example: 123 })
  userId!: number;

  @IsString()
  @ApiProperty({ example: 'sample-action' })
  action!: string;

  @IsString()
  @ApiProperty({ example: 'sample-entity' })
  entity!: string;

  @IsInt()
  @ApiProperty({ example: 123 })
  entityId!: number;
}
