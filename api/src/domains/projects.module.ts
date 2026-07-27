import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { TimesheetsModule } from '../timesheets/timesheets.module';

@Module({
  imports: [ProjectsModule, TasksModule, TimesheetsModule],
  exports: [ProjectsModule, TasksModule, TimesheetsModule],
})
export class ProjectsDomainModule {}
