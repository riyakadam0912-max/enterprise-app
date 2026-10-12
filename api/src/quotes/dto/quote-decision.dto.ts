import { IsOptional, IsString, MaxLength } from 'class-validator';

export class QuoteDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
