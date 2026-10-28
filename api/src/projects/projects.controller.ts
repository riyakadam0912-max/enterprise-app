import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateProjectLinkDto } from './dto/create-project-link.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { AssignProjectEmployeeDto } from './dto/assign-project-employee.dto';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';
import { CompletionNotificationInterceptor } from '../common/interceptors/completion-notification.interceptor';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectMessagesService } from './project-messages.service';
import type { ProjectMessageMention } from './project-messages.service';
import type { AuthUser } from '../common/types/auth';
import { ProjectQueryDto } from './dto/project-query.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { CreateTaskListDto } from './dto/create-task-list.dto';
import { UpdateTaskListDto } from './dto/update-task-list.dto';
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto';
import { CreateProjectIssueDto } from './dto/create-project-issue.dto';
import { UpdateProjectIssueDto } from './dto/update-project-issue.dto';
import { CreateProjectBaselineDto } from './dto/create-project-baseline.dto';

type ProjectRequest = {
  user: AuthUser;
};
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CompletionNotificationInterceptor)
@ApiTags('Work - Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly service: ProjectsService,
    private readonly messagesService: ProjectMessagesService,
  ) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateProjectDto })
  @Post()
  create(
    @Body() dto: CreateProjectDto,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.create(dto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'POST :id/co-managers' })
  @ApiResponse({ status: 200, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post(':id/co-managers')
  addCoManager(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { userId: number },
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.addCoManager(id, Number(body.userId), req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'DELETE :id/co-managers/:userId' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id/co-managers/:userId')
  removeCoManager(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.removeCoManager(id, userId, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'POST :id/employees' })
  @ApiResponse({ status: 200, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post(':id/employees')
  assignEmployeeToProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssignProjectEmployeeDto,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.assignEmployee(
      id,
      Number(body.employeeId),
      req.user,
      body.driveLink,
    );
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'DELETE :id/employees/:employeeId' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id/employees/:employeeId')
  removeEmployeeFromProject(
    @Param('id', ParseIntPipe) id: number,
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.removeEmployee(id, employeeId, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'PATCH :id/assign-manager' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: AssignManagerDto })
  @Patch(':id/assign-manager')
  assignManager(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignManagerDto,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.assignManager(id, dto.managerId, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'POST import' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('import')
  @HttpCode(HttpStatus.OK)
  importRecords(
    @Body() body: { records: Record<string, any>[] },
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.importRecords(body.records, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  async findAll(
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.findAll(req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET /query' })
  @Get('query')
  query(
    @Query() query: ProjectQueryDto,
    @Req() req: ProjectRequest,
  ) {
    return this.service.query(query, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET by-status' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('by-status')
  getByStatus(
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.getByStatus(req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'GET eligible managers and owners for projects' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @Get('eligible-managers')
  getEligibleManagers(
    @Query('projectId') projectId: string | undefined,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.getEligibleManagers(
      req.user,
      projectId === undefined ? undefined : Number(projectId),
    );
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET :id/workspace' })
  @Get(':id/workspace')
  getWorkspace(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: ProjectRequest,
  ) {
    return this.service.getWorkspace(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Post(':id/milestones')
  createMilestone(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateMilestoneDto, @Req() req: ProjectRequest) {
    return this.service.createMilestone(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Patch(':id/milestones/:milestoneId')
  updateMilestone(@Param('id', ParseIntPipe) id: number, @Param('milestoneId', ParseIntPipe) milestoneId: number, @Body() dto: UpdateMilestoneDto, @Req() req: ProjectRequest) {
    return this.service.updateMilestone(id, milestoneId, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Delete(':id/milestones/:milestoneId')
  removeMilestone(@Param('id', ParseIntPipe) id: number, @Param('milestoneId', ParseIntPipe) milestoneId: number, @Req() req: ProjectRequest) {
    return this.service.removeMilestone(id, milestoneId, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Post(':id/task-lists')
  createTaskList(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTaskListDto, @Req() req: ProjectRequest) {
    return this.service.createTaskList(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Patch(':id/task-lists/:taskListId')
  updateTaskList(@Param('id', ParseIntPipe) id: number, @Param('taskListId', ParseIntPipe) taskListId: number, @Body() dto: UpdateTaskListDto, @Req() req: ProjectRequest) {
    return this.service.updateTaskList(id, taskListId, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Delete(':id/task-lists/:taskListId')
  removeTaskList(@Param('id', ParseIntPipe) id: number, @Param('taskListId', ParseIntPipe) taskListId: number, @Req() req: ProjectRequest) {
    return this.service.removeTaskList(id, taskListId, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Post(':id/dependencies')
  createDependency(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTaskDependencyDto, @Req() req: ProjectRequest) {
    return this.service.createDependency(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Delete(':id/dependencies/:dependencyId')
  removeDependency(@Param('id', ParseIntPipe) id: number, @Param('dependencyId', ParseIntPipe) dependencyId: number, @Req() req: ProjectRequest) {
    return this.service.removeDependency(id, dependencyId, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @Post(':id/issues')
  createIssue(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateProjectIssueDto, @Req() req: ProjectRequest) {
    return this.service.createIssue(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @Patch(':id/issues/:issueId')
  updateIssue(@Param('id', ParseIntPipe) id: number, @Param('issueId', ParseIntPipe) issueId: number, @Body() dto: UpdateProjectIssueDto, @Req() req: ProjectRequest) {
    return this.service.updateIssue(id, issueId, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Delete(':id/issues/:issueId')
  removeIssue(@Param('id', ParseIntPipe) id: number, @Param('issueId', ParseIntPipe) issueId: number, @Req() req: ProjectRequest) {
    return this.service.removeIssue(id, issueId, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET :id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.findOne(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'GET :id/progress' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id/progress')
  getProgress(
    @Param('id', ParseIntPipe) id: number,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.getProgress(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'GET :id/critical-path' })
  @Get(':id/critical-path')
  getCriticalPath(@Param('id', ParseIntPipe) id: number, @Req() req: ProjectRequest) {
    return this.service.getCriticalPath(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'GET :id/workload' })
  @Get(':id/workload')
  getWorkload(@Param('id', ParseIntPipe) id: number, @Req() req: ProjectRequest) {
    return this.service.getWorkload(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Post(':id/baselines')
  createBaseline(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateProjectBaselineDto, @Req() req: ProjectRequest) {
    return this.service.createBaseline(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Get(':id/baselines')
  listBaselines(@Param('id', ParseIntPipe) id: number, @Req() req: ProjectRequest) {
    return this.service.listBaselines(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Get(':id/baselines/:baselineId/variance')
  getBaselineVariance(@Param('id', ParseIntPipe) id: number, @Param('baselineId', ParseIntPipe) baselineId: number, @Req() req: ProjectRequest) {
    return this.service.getBaselineVariance(id, baselineId, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'PATCH :id' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateProjectDto })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'PATCH :id/status' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateProjectStatusDto })
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectStatusDto,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.updateStatus(id, dto.status, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'DELETE :id' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.remove(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET :id/links' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id/links')
  getLinks(
    @Param('id', ParseIntPipe) id: number,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.getLinks(id, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'POST :id/links' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateProjectLinkDto })
  @Post(':id/links')
  createLink(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProjectLinkDto,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.createLink(id, dto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'DELETE :id/links/:linkId' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id/links/:linkId')
  removeLink(
    @Param('id', ParseIntPipe) id: number,
    @Param('linkId', ParseIntPipe) linkId: number,
    @Req()
    req: ProjectRequest,
  ) {
    return this.service.removeLink(id, linkId, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET :id/messages' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id/messages')
  getMessages(
    @Param('id', ParseIntPipe) id: number,
    @Req()
    req: ProjectRequest,
  ) {
    return this.messagesService.getMessages(id, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET :id/message-mention-options' })
  @Get(':id/message-mention-options')
  getMessageMentionOptions(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: ProjectRequest,
  ) {
    return this.messagesService.getMentionOptions(id, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'POST :id/messages' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post(':id/messages')
  sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content: string; mentions?: ProjectMessageMention[] },
    @Req()
    req: ProjectRequest,
  ) {
    return this.messagesService.createMessage(
      id,
      body.content,
      body.mentions,
      req.user,
    );
  }
}
