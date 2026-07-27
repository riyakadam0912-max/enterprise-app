import { IsIn, IsString } from 'class-validator';
import { PROJECT_STATUSES } from './create-project.dto';

export class UpdateProjectStatusDto {
  @IsString()
  @IsIn(PROJECT_STATUSES)
  status!: (typeof PROJECT_STATUSES)[number];
}
