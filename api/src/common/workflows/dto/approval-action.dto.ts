import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApprovalActionDto {
  @ApiPropertyOptional({
    example: 'Missing supporting documents',
    description: 'Optional rejection reason or approval note.',
  })
  reason?: string;
}
