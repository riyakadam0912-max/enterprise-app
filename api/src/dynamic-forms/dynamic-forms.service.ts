import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDynamicFormDto } from './dto/create-dynamic-form.dto';
import { UpdateDynamicFormDto } from './dto/update-dynamic-form.dto';
import { AuthUser } from '../common/types/auth';

@Injectable()
export class DynamicFormsService {
  constructor(private prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(dto: CreateDynamicFormDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.dynamicForm.create({
      data: {
        organizationId,
        formName: dto.formName,
        formCode: dto.formCode,
        description: dto.description,
        createdBy: dto.createdBy,
        status: dto.status,
        formType: dto.formType,
        targetModule: dto.targetModule,
        createdOn: dto.createdOn ? new Date(dto.createdOn) : null,
      },
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.dynamicForm.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const form = await this.prisma.dynamicForm.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });
    if (!form) throw new NotFoundException(`DynamicForm #${id} not found`);
    return form;
  }

  async findByTargetModule(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const forms = await this.prisma.dynamicForm.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { formName: 'asc' },
    });
    const grouped: Record<string, typeof forms> = {};
    for (const f of forms) {
      const key = f.targetModule ?? 'Unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(f);
    }
    return grouped;
  }

  async update(id: number, dto: UpdateDynamicFormDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const data: Prisma.DynamicFormUpdateInput = {};

    if (dto.formName !== undefined) data.formName = dto.formName;
    if (dto.formCode !== undefined) data.formCode = dto.formCode;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.createdBy !== undefined) data.createdBy = dto.createdBy;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.formType !== undefined) data.formType = dto.formType;
    if (dto.targetModule !== undefined) data.targetModule = dto.targetModule;
    if (dto.createdOn !== undefined) {
      data.createdOn = dto.createdOn ? new Date(dto.createdOn) : null;
    }

    return this.prisma.dynamicForm.update({
      where: { id, organizationId },
      data,
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.dynamicForm.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }
}
