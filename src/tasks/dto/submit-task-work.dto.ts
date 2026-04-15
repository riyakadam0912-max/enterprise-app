import { IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitTaskWorkDto {
  @IsUrl()
  @ApiProperty({ example: 'sample-submissionLink' })
  submissionLink!: string;

  @IsString()
  @ApiProperty({ example: 'sample-note' })
  note!: string;
}
