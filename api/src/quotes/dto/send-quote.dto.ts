import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendQuoteDto {
  @IsEmail()
  recipient!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
