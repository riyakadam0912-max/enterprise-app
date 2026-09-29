import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTaskTimerDto {
  @IsIn(['start', 'pause', 'resume', 'stop'])
  action!: 'start' | 'pause' | 'resume' | 'stop';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
