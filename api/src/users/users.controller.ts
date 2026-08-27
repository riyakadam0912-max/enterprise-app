import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permissions.enum';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { Role } from '../common/enums/role.enum';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/types/request';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiTags('System - Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_CREATE)
  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateUserDto })
  @Post()
  create(
    @Body() createUserDto: CreateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.create(
      createUserDto,
      req.user,
      req.organizationId ?? req.user.organizationId,
    );
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.usersService.findAll(req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @RequirePermissions(Permission.EMPLOYEE_READ)
  @ApiOperation({ summary: 'GET assignable' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('assignable')
  findAssignable(@Req() req: AuthenticatedRequest) {
    return this.usersService.findAssignable(req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @RequirePermissions(Permission.EMPLOYEE_READ)
  @Get('reporting-managers')
  reportingManagers(@Req() req: AuthenticatedRequest) {
    return this.usersService.findReportingManagers(
      req.user,
      req.organizationId ?? req.user.organizationId,
    );
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @ApiOperation({ summary: 'GET /:id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.findOne(parseInt(id, 10), req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_UPDATE)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.update(parseInt(id, 10), updateUserDto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_UPDATE)
  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateRole(parseInt(id, 10), body.role, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_DELETE)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.remove(parseInt(id, 10), req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_UPDATE)
  @Patch(':id/activate')
  activate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.activate(parseInt(id, 10), req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_UPDATE)
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.deactivate(parseInt(id, 10), req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_UPDATE)
  @Patch(':id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.resetPassword(
      parseInt(id, 10),
      body.password,
      req.user,
    );
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_UPDATE)
  @Patch(':id/unlock')
  unlock(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.unlock(parseInt(id, 10), req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_UPDATE)
  @Patch(':id/assign-organization')
  assignOrganization(
    @Param('id') id: string,
    @Body() body: { organizationId: number },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.assignOrganization(
      parseInt(id, 10),
      body.organizationId,
      req.user,
    );
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_UPDATE)
  @Patch(':id/assign-roles')
  assignRoles(
    @Param('id') id: string,
    @Body() body: { roleIds: number[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.assignRoles(
      parseInt(id, 10),
      body.roleIds,
      req.user,
    );
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_UPDATE)
  @Patch(':id/assign-department')
  assignDepartment(
    @Param('id') id: string,
    @Body() body: { department: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.assignDepartment(
      parseInt(id, 10),
      body.department,
      req.user,
    );
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COMPLIANCE_MANAGER, Role.HR)
  @RequirePermissions(Permission.USER_UPDATE)
  @Patch(':id/assign-manager')
  assignManager(
    @Param('id') id: string,
    @Body() body: { managerId: number | null },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.assignManager(
      parseInt(id, 10),
      body.managerId,
      req.user,
    );
  }
}
