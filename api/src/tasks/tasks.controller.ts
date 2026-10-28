import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { SubmitTaskWorkDto } from './dto/submit-task-work.dto';
import { ReviewTaskDto } from './dto/review-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { CreateTaskMessageDto } from './dto/create-task-message.dto';
import { UpdateTaskTimerDto } from './dto/update-task-timer.dto';
import { CompletionNotificationInterceptor } from '../common/interceptors/completion-notification.interceptor';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/types/request';
import { TaskQueryDto } from './dto/task-query.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { BulkUpdateTasksDto } from './dto/bulk-update-tasks.dto';
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CompletionNotificationInterceptor)
@ApiTags('Work - Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateTaskDto })
  @Post()
  create(@Body() dto: CreateTaskDto, @Req() req: AuthenticatedRequest) {
    return this.tasksService.create(dto, req.user);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'POST import' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('import')
  @HttpCode(HttpStatus.OK)
  importRecords(
    @Body() body: { records: Record<string, unknown>[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.importRecords(body.records, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.tasksService.findAll(req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET /query' })
  @Get('query')
  query(
    @Query() query: TaskQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.query(query, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Patch('bulk')
  bulkUpdate(@Body() dto: BulkUpdateTasksDto, @Req() req: AuthenticatedRequest) {
    return this.tasksService.bulkUpdate(dto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET by-priority' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('by-priority')
  getByPriority(@Req() req: AuthenticatedRequest) {
    return this.tasksService.getByPriority(req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET upcoming' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('upcoming')
  getUpcoming(@Req() req: AuthenticatedRequest) {
    return this.tasksService.getUpcoming(req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET lead/:id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('lead/:id')
  getByLead(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.getByLead(id, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET deal/:id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('deal/:id')
  getByDeal(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.getByDeal(id, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET :id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.findOne(id, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get(':id/messages')
  getMessages(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.getMessages(id, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get(':id/checklist')
  getChecklist(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.tasksService.getChecklist(id, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Post(':id/checklist')
  createChecklistItem(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateChecklistItemDto, @Req() req: AuthenticatedRequest) {
    return this.tasksService.createChecklistItem(id, dto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Patch(':id/checklist/:itemId')
  updateChecklistItem(@Param('id', ParseIntPipe) id: number, @Param('itemId', ParseIntPipe) itemId: number, @Body() dto: UpdateChecklistItemDto, @Req() req: AuthenticatedRequest) {
    return this.tasksService.updateChecklistItem(id, itemId, dto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Delete(':id/checklist/:itemId')
  deleteChecklistItem(@Param('id', ParseIntPipe) id: number, @Param('itemId', ParseIntPipe) itemId: number, @Req() req: AuthenticatedRequest) {
    return this.tasksService.deleteChecklistItem(id, itemId, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Get(':id/watchers')
  getWatchers(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.tasksService.getWatchers(id, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Post(':id/watchers')
  addWatcher(@Param('id', ParseIntPipe) id: number, @Body() body: { userId?: number }, @Req() req: AuthenticatedRequest) {
    return this.tasksService.addWatcher(id, body.userId, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Delete(':id/watchers/:userId')
  removeWatcher(@Param('id', ParseIntPipe) id: number, @Param('userId', ParseIntPipe) userId: number, @Req() req: AuthenticatedRequest) {
    return this.tasksService.removeWatcher(id, userId, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @Post(':id/messages')
  sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTaskMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.sendMessage(id, dto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @Patch(':id/timer')
  updateTimer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskTimerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.updateTimer(id, dto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'PATCH :id' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateTaskDto })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.update(id, dto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'PATCH :id/status' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateTaskStatusDto })
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.updateStatus(id, dto.status, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'PATCH :id/review' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: ReviewTaskDto })
  @Patch(':id/review')
  reviewTaskPatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewTaskDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.reviewTask(id, dto, req.user);
  }

  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'POST :id/submit-work' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: SubmitTaskWorkDto })
  @Post(':id/submit-work')
  submitWork(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitTaskWorkDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.submitWork(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'POST :id/review' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: ReviewTaskDto })
  @Post(':id/review')
  reviewTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewTaskDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.reviewTask(id, dto, req.user);
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
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.remove(id, req.user);
  }
}
