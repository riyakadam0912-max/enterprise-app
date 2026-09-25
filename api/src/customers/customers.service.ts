import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth';
import { Permission } from '../common/enums/permissions.enum';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private organizationId(user: AuthUser): number {
    if (!user.organizationId)
      throw new ForbiddenException('User has no associated organization');
    return user.organizationId;
  }

  private assertAccess(user: AuthUser, permission: Permission): void {
    const elevated = [
      Role.ADMIN,
      Role.SUPER_ADMIN,
      Role.COMPLIANCE_MANAGER,
    ].some((role) => role === user.role);
    if (!elevated && !user.permissions?.includes(permission)) {
      throw new ForbiddenException('Missing required customer permission');
    }
  }

  async create(dto: CreateCustomerDto, user: AuthUser) {
    this.assertAccess(user, Permission.CUSTOMER_CREATE);
    const organizationId = this.organizationId(user);
    return this.prisma.customer.create({
      data: {
        organizationId,
        customerName: dto.customerName.trim(),
        customerType: dto.customerType,
        addressLine1: dto.addressLine1.trim(),
        addressLine2: dto.addressLine2?.trim() || null,
        city: dto.city.trim(),
        state: dto.state.trim(),
        country: dto.country.trim(),
        zipCode: dto.zipCode.trim(),
        webAddress: dto.webAddress?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        phoneNumber: dto.phoneNumber?.trim() || null,
      },
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.organizationId(user);
    return this.prisma.customer.findMany({
      where: { organizationId, deletedAt: null },
      include: { _count: { select: { projects: true, clientProfiles: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId: this.organizationId(user), deletedAt: null },
      include: {
        projects: { select: { id: true, projectName: true, status: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(id: number, dto: UpdateCustomerDto, user: AuthUser) {
    this.assertAccess(user, Permission.CUSTOMER_UPDATE);
    await this.findOne(id, user);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.customerName !== undefined && {
          customerName: dto.customerName.trim(),
        }),
        ...(dto.customerType !== undefined && {
          customerType: dto.customerType,
        }),
        ...(dto.addressLine1 !== undefined && {
          addressLine1: dto.addressLine1.trim(),
        }),
        ...(dto.addressLine2 !== undefined && {
          addressLine2: dto.addressLine2?.trim() || null,
        }),
        ...(dto.city !== undefined && { city: dto.city.trim() }),
        ...(dto.state !== undefined && { state: dto.state.trim() }),
        ...(dto.country !== undefined && { country: dto.country.trim() }),
        ...(dto.zipCode !== undefined && { zipCode: dto.zipCode.trim() }),
        ...(dto.webAddress !== undefined && {
          webAddress: dto.webAddress?.trim() || null,
        }),
        ...(dto.email !== undefined && {
          email: dto.email?.trim().toLowerCase() || null,
        }),
        ...(dto.phoneNumber !== undefined && {
          phoneNumber: dto.phoneNumber?.trim() || null,
        }),
      },
    });
  }

  async remove(id: number, user: AuthUser) {
    this.assertAccess(user, Permission.CUSTOMER_DELETE);
    await this.findOne(id, user);
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
