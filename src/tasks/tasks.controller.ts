import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, ParseIntPipe, UseGuards, HttpCode, HttpStatus, Req, UseInterceptors,
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
import { CompletionNotificationInterceptor } from '../common/interceptors/completion-notification.interceptor';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CompletionNotificationInterceptor)
@ApiTags('Work - Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateTaskDto })
  @Post()
  create(
    @Body() dto: CreateTaskDto,
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
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
  importRecords(@Body() body: { records: Record<string, any>[] }) {
    return this.tasksService.importRecords(body.records);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  findAll(@Req() req: { user: { userId: number; role: Role; employeeId?: number | null } }) {
    return this.tasksService.findAll(req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'GET by-priority' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('by-priority')
  getByPriority(@Req() req: { user: { userId: number; role: Role; employeeId?: number | null } }) {
    return this.tasksService.getByPriority(req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET upcoming' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('upcoming')
  getUpcoming(@Req() req: { user: { userId: number; role: Role; employeeId?: number | null } }) {
    return this.tasksService.getUpcoming(req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET lead/:id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('lead/:id')
  getByLead(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.tasksService.getByLead(id, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET deal/:id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('deal/:id')
  getByDeal(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.tasksService.getByDeal(id, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET :id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.tasksService.findOne(id, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
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
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.tasksService.update(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
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
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.tasksService.updateStatus(id, dto.status, req.user);
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
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
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
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.tasksService.reviewTask(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'DELETE :id' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.tasksService.remove(id, req.user);
  }
}
