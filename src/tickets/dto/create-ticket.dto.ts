import { IsString, IsNumber, IsOptional, IsIn, IsInt, IsDateString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TICKET_STATUSES = ['RESERVED', 'SOLD', 'CANCELLED', 'REFUNDED'] as const;

export class CreateTicketDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-event' })
  event?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-customer' })
  customer?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 123 })
  price?: number;

  @IsOptional()
  @IsIn(TICKET_STATUSES)
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-04-14' })
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-qrCode' })
  qrCode?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'sample-notes' })
  notes?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 123 })
  ticketTypeId?: number;
}
