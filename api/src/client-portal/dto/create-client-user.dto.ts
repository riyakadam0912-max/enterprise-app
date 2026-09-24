import { IsArray, IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientUserDto {
  @IsInt()
  @Min(1)
  @ApiProperty({ example: 42 })
  contactId!: number;

  @IsEmail()
  @ApiProperty({ example: 'client@example.com' })
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @ApiPropertyOptional({ example: 'client-invitation', default: 'client-invitation' })
  invitationTemplate?: string;

  @IsArray()
  @IsInt({ each: true })
  @ApiProperty({ type: [Number], example: [10, 11] })
  projectIds!: number[];
}
