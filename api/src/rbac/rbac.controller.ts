import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permissions.enum';

@Controller('rbac')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  constructor(private rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions(Permission.ROLE_READ)
  async getRoles() {
    return this.rbacService.getRoles();
  }

  @Get('roles/:id')
  @RequirePermissions(Permission.ROLE_READ)
  async getRoleById(@Param('id') id: string) {
    return this.rbacService.getRoleById(parseInt(id, 10));
  }

  @Post('roles')
  @RequirePermissions(Permission.ROLE_CREATE)
  async createRole(@Body() body: { name: string; description?: string }) {
    return this.rbacService.createRole(body.name, body.description);
  }

  @Put('roles/:id')
  @RequirePermissions(Permission.ROLE_UPDATE)
  async updateRole(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.rbacService.updateRole(
      parseInt(id, 10),
      body.name,
      body.description,
    );
  }

  @Delete('roles/:id')
  @RequirePermissions(Permission.ROLE_DELETE)
  async deleteRole(@Param('id') id: string) {
    return this.rbacService.deleteRole(parseInt(id, 10));
  }

  @Post('roles/:roleId/permissions')
  @RequirePermissions(Permission.PERMISSION_MANAGE)
  async assignPermissionToRole(
    @Param('roleId') roleId: string,
    @Body() body: { permissionKey: string },
  ) {
    return this.rbacService.assignPermissionToRole(
      parseInt(roleId, 10),
      body.permissionKey,
    );
  }

  @Delete('roles/:roleId/permissions')
  @RequirePermissions(Permission.PERMISSION_MANAGE)
  async removePermissionFromRole(
    @Param('roleId') roleId: string,
    @Body() body: { permissionKey: string },
  ) {
    return this.rbacService.removePermissionFromRole(
      parseInt(roleId, 10),
      body.permissionKey,
    );
  }

  @Post('users/:userId/roles')
  @RequirePermissions(Permission.USER_UPDATE)
  async assignRoleToUser(
    @Param('userId') userId: string,
    @Body() body: { roleId: number },
  ) {
    return this.rbacService.assignRoleToUser(parseInt(userId, 10), body.roleId);
  }

  @Delete('users/:userId/roles')
  @RequirePermissions(Permission.USER_UPDATE)
  async removeRoleFromUser(
    @Param('userId') userId: string,
    @Body() body: { roleId: number },
  ) {
    return this.rbacService.removeRoleFromUser(
      parseInt(userId, 10),
      body.roleId,
    );
  }

  @Get('permissions')
  @RequirePermissions(Permission.PERMISSION_READ)
  async getPermissions() {
    return this.rbacService.getPermissions();
  }
}
