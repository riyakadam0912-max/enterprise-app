import { IsIn, IsString } from 'class-validator';
import { TASK_STATUSES } from './create-task.dto';

export class UpdateTaskStatusDto {
  @IsString()
  @IsIn(TASK_STATUSES)
  status!: (typeof TASK_STATUSES)[number];
}
