import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { AuthUser } from '../common/types/auth';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(dto: CreateProductDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.product.create({
      data: { organizationId, ...dto },
      include: { category: true },
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.product.findMany({
      where: { organizationId },
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
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.product.update({
      where: { id, organizationId },
      data: dto,
      include: { category: true },
    });
  }

  async remove(id: number, user: AuthUser) {
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
    const organizationId = this.validateOrganization(user);
    return this.prisma.productCategory.create({
      data: { organizationId, name },
    });
  }
}
