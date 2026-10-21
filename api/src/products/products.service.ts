import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { AuthUser } from '../common/types/auth';
import { Permission } from '../common/enums/permissions.enum';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private assertPermission(user: AuthUser, permission: Permission) {
    if (
      user.role === Role.ADMIN ||
      user.role === Role.SUPER_ADMIN ||
      user.isPlatformAdmin ||
      user.isSuperAdmin ||
      user.permissions?.includes(permission)
    )
      return;
    throw new ForbiddenException('Missing required product permission');
  }

  private async assertNoDuplicate(
    database: Prisma.TransactionClient | PrismaService,
    organizationId: number,
    product: {
      name?: string;
      sku?: string | null;
      type?: string;
      unit?: string;
    },
    excludeId?: number,
  ) {
    const candidates = await database.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true, sku: true, type: true, unit: true },
    });
    const sku = product.sku?.trim().toLocaleLowerCase();
    const name = product.name?.trim().toLocaleLowerCase();
    const type = product.type?.trim().toLocaleLowerCase();
    const unit = product.unit?.trim().toLocaleLowerCase();
    const duplicate = candidates.find((candidate) =>
      sku
        ? candidate.sku?.trim().toLocaleLowerCase() === sku
        : candidate.name.trim().toLocaleLowerCase() === name &&
          candidate.type.trim().toLocaleLowerCase() === type &&
          candidate.unit.trim().toLocaleLowerCase() === unit,
    );
    if (duplicate) {
      throw new ConflictException(
        `An item with this ${sku ? 'SKU' : 'name, type, and unit'} already exists.`,
      );
    }
  }

  private async withDuplicateCheck<T>(
    organizationId: number,
    product: {
      name?: string;
      sku?: string | null;
      type?: string;
      unit?: string;
    },
    excludeId: number | undefined,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          await this.assertNoDuplicate(
            transaction,
            organizationId,
            product,
            excludeId,
          );
          return operation(transaction);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        await this.assertNoDuplicate(
          this.prisma,
          organizationId,
          product,
          excludeId,
        );
      }
      throw error;
    }
  }

  async create(dto: CreateProductDto, user: AuthUser) {
    this.assertPermission(user, Permission.PRODUCT_CREATE);
    const organizationId = this.validateOrganization(user);
    return this.withDuplicateCheck(
      organizationId,
      dto,
      undefined,
      (transaction) =>
        transaction.product.create({
          data: { organizationId, ...dto },
          include: { category: true },
        }),
    );
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.product.findMany({
      where: { organizationId, deletedAt: null },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const product = await this.prisma.product.findUnique({
      where: { id, organizationId },
      include: { category: true },
    });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return product;
  }

  async update(id: number, dto: UpdateProductDto, user: AuthUser) {
    this.assertPermission(user, Permission.PRODUCT_UPDATE);
    const organizationId = this.validateOrganization(user);
    const existing = await this.findOne(id, user);
    const update = {
      name: dto.name ?? existing.name,
      sku: dto.sku ?? existing.sku,
      type: dto.type ?? existing.type,
      unit: dto.unit ?? existing.unit,
    };
    return this.withDuplicateCheck(organizationId, update, id, (transaction) =>
      transaction.product.update({
        where: { id, organizationId },
        data: dto,
        include: { category: true },
      }),
    );
  }

  async remove(id: number, user: AuthUser) {
    this.assertPermission(user, Permission.PRODUCT_DELETE);
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    await this.prisma.product.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async getCategories(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.productCategory.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(name: string, user: AuthUser) {
    this.assertPermission(user, Permission.PRODUCT_CATEGORY_MANAGE);
    const organizationId = this.validateOrganization(user);
    return this.prisma.productCategory.create({
      data: { organizationId, name },
    });
  }
}
