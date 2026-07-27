import { IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectLinkDto {
  @IsString()
  @ApiProperty({ example: 'sample-title' })
  title!: string;

  @IsUrl()
  @ApiProperty({ example: 'sample-url' })
  url!: string;
}
