import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDynamicFormDto } from './dto/create-dynamic-form.dto';
import { UpdateDynamicFormDto } from './dto/update-dynamic-form.dto';

@Injectable()
export class DynamicFormsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDynamicFormDto) {
    return this.prisma.dynamicForm.create({
      data: {
        formName:     dto.formName,
        formCode:     dto.formCode,
        description:  dto.description,
        createdBy:    dto.createdBy,
        status:       dto.status,
        formType:     dto.formType,
        targetModule: dto.targetModule,
        createdOn:    dto.createdOn ? new Date(dto.createdOn) : null,
      },
    });
  }

  async findAll() {
    return this.prisma.dynamicForm.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: number) {
    const form = await this.prisma.dynamicForm.findUnique({ where: { id } });
    if (!form) throw new NotFoundException(`DynamicForm #${id} not found`);
    return form;
  }

  async findByTargetModule() {
    const forms = await this.prisma.dynamicForm.findMany({ orderBy: { formName: 'asc' } });
    const grouped: Record<string, typeof forms> = {};
    for (const f of forms) {
      const key = f.targetModule ?? 'Unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(f);
    }
    return grouped;
  }

  async update(id: number, dto: UpdateDynamicFormDto) {
    const data: any = { ...dto };
    if (data.createdOn) data.createdOn = new Date(data.createdOn);
    return this.prisma.dynamicForm.update({ where: { id }, data });
  }

  async remove(id: number) {
    return this.prisma.dynamicForm.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }
}
