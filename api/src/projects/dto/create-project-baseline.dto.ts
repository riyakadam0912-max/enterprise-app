import { IsOptional, IsString } from 'class-validator';

export class CreateProjectBaselineDto {
  @IsOptional()
  @IsString()
  name?: string;
}
