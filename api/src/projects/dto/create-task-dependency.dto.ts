import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export const TASK_DEPENDENCY_TYPES = [
  'FINISH_TO_START',
  'START_TO_START',
  'FINISH_TO_FINISH',
  'START_TO_FINISH',
] as const;

export class CreateTaskDependencyDto {
  @IsInt()
  predecessorId!: number;

  @IsInt()
  successorId!: number;

  @IsOptional()
  @IsIn(TASK_DEPENDENCY_TYPES)
  dependencyType?: (typeof TASK_DEPENDENCY_TYPES)[number];

  @IsOptional()
  @IsInt()
  lagDays?: number;
}
