import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectIssueDto } from './create-project-issue.dto';

export class UpdateProjectIssueDto extends PartialType(CreateProjectIssueDto) {}
