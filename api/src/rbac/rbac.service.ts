import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RbacService {
  constructor(private prisma: PrismaService) {}

  async getRoles() {
    return this.prisma.appRole.findMany({
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async getRoleById(id: number) {
    const role = await this.prisma.appRole.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async createRole(name: string, description?: string) {
    return this.prisma.appRole.create({
      data: { name, description },
    });
  }

  async updateRole(id: number, name?: string, description?: string) {
    return this.prisma.appRole.update({
      where: { id },
      data: { name, description },
    });
  }

  async deleteRole(id: number) {
    return this.prisma.appRole.delete({
      where: { id },
    });
  }

  async assignPermissionToRole(roleId: number, permissionKey: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { key: permissionKey },
    });
    if (!permission) throw new NotFoundException('Permission not found');

    return this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: permission.id } },
      update: {},
      create: { roleId, permissionId: permission.id },
    });
  }

  async removePermissionFromRole(roleId: number, permissionKey: string) {
    const role = await this.prisma.appRole.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.name === 'SUPER_ADMIN' && permissionKey.startsWith('module.')) {
      throw new BadRequestException('Super Admin module access cannot be removed');
    }
    const permission = await this.prisma.permission.findUnique({
      where: { key: permissionKey },
    });
    if (!permission) throw new NotFoundException('Permission not found');

    return this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId: permission.id } },
    });
  }

  async updateModuleAccess(roleId: number, enabledPermissions: string[]) {
    const role = await this.prisma.appRole.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.name === 'SUPER_ADMIN') {
      throw new BadRequestException('Super Admin module access cannot be removed');
    }

    const modulePermissions = await this.prisma.permission.findMany({
      where: { key: { startsWith: 'module.' } },
    });
    const validKeys = new Set(modulePermissions.map((permission) => permission.key));
    const enabledKeys = [...new Set(enabledPermissions)].filter((key) => validKeys.has(key));
    const enabledPermissionIds = modulePermissions
      .filter((permission) => enabledKeys.includes(permission.key))
      .map((permission) => permission.id);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({
        where: {
          roleId,
          permission: { key: { startsWith: 'module.' } },
        },
      }),
      ...enabledPermissionIds.map((permissionId) =>
        this.prisma.rolePermission.create({
          data: { roleId, permissionId },
        }),
      ),
    ]);

    return this.getRoleById(roleId);
  }

  async assignRoleToUser(userId: number, roleId: number) {
    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }

  async removeRoleFromUser(userId: number, roleId: number) {
    return this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
  }

  async getPermissions() {
    return this.prisma.permission.findMany();
  }
}
