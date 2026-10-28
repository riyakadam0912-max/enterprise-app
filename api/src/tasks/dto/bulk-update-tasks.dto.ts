import { IsArray, IsDateString, IsIn, IsInt, IsOptional, Min, ArrayMinSize } from 'class-validator';

export class BulkUpdateTasksDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  taskIds!: number[];

  @IsOptional()
  @IsIn(['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED'])
  status?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  assignedToUserId?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
