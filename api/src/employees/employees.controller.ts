import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/request';

import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permissions.enum';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiTags('HR - Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER)
  @RequirePermissions(Permission.EMPLOYEE_READ)
  @ApiOperation({ summary: 'GET by-department' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('by-department')
  findByDepartment(@Req() req: AuthenticatedRequest) {
    return this.employeesService.findByDepartment(req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @RequirePermissions(Permission.EMPLOYEE_CREATE)
  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateEmployeeDto })
  @Post()
  create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.employeesService.create(
      createEmployeeDto,
      req.user,
      req.organizationId ?? req.user.organizationId,
    );
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @RequirePermissions(Permission.EMPLOYEE_CREATE)
  @ApiOperation({ summary: 'POST import' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('import')
  @HttpCode(HttpStatus.OK)
  importRecords(
    @Body() body: { records: Record<string, any>[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.employeesService.importRecords(body.records, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @RequirePermissions(Permission.EMPLOYEE_READ)
  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.employeesService.findAll(req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @RequirePermissions(Permission.EMPLOYEE_READ)
  @ApiOperation({ summary: 'GET deleted' })
  @ApiResponse({
    status: 200,
    description: 'Deleted employees fetched successfully.',
  })
  @Get('deleted')
  findDeleted(@Req() req: AuthenticatedRequest) {
    return this.employeesService.findDeleted(req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @RequirePermissions(Permission.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: 'PATCH :id/restore' })
  @ApiResponse({ status: 200, description: 'Employee restored successfully.' })
  @Patch(':id/restore')
  restore(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.employeesService.restore(id, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @RequirePermissions(Permission.EMPLOYEE_READ)
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
    return this.employeesService.findOne(id, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @RequirePermissions(Permission.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: 'PATCH :id' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateEmployeeDto })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.employeesService.update(id, updateEmployeeDto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @RequirePermissions(Permission.EMPLOYEE_DELETE)
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
    return this.employeesService.remove(id, req.user);
  }
}
