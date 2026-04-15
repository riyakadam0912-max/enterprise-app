import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto, include: { category: true } });
  }

  async findAll() {
    return this.prisma.product.findMany({ include: { category: true }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { category: true } });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto, include: { category: true } });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async getCategories() {
    return this.prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async createCategory(name: string) {
    return this.prisma.productCategory.create({ data: { name } });
  }
}
