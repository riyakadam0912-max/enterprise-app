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
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';
import { CompletionNotificationInterceptor } from '../common/interceptors/completion-notification.interceptor';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CompletionNotificationInterceptor)
@ApiTags('Work - Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateProjectDto })
  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN)
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
  ) {
    return this.service.assignManager(id, dto.managerId);
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
    return this.service.importRecords(body.records);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  findAll(@Req() req: { user: { userId: number; role: Role; employeeId?: number | null } }) {
    return this.service.findAll(req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'GET by-status' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('by-status')
  getByStatus(@Req() req: { user: { userId: number; role: Role; employeeId?: number | null } }) {
    return this.service.getByStatus(req.user);
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
    return this.service.findOne(id, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'GET :id/progress' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id/progress')
  getProgress(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.service.getProgress(id, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
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
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
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
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.service.updateStatus(id, dto.status, req.user);
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
    return this.service.remove(id, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET :id/links' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id/links')
  getLinks(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.service.getLinks(id, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
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
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.service.createLink(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'DELETE :id/links/:linkId' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id/links/:linkId')
  removeLink(
    @Param('id', ParseIntPipe) id: number,
    @Param('linkId', ParseIntPipe) linkId: number,
    @Req() req: { user: { userId: number; role: Role; employeeId?: number | null } },
  ) {
    return this.service.removeLink(id, linkId, req.user);
  }
}
