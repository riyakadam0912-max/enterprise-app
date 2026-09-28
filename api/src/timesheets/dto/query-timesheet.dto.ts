import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class QueryTimesheetDto {
  @IsOptional() @IsNumberString() page?: number;
  @IsOptional() @IsNumberString() limit?: number;
  @IsOptional() @IsNumberString() projectId?: number;
  @IsOptional() @IsNumberString() taskId?: number;
  @IsOptional() @IsString() employee?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() project?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() search?: string;
}
