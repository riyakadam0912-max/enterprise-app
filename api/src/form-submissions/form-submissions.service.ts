import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormSubmissionDto } from './dto/create-form-submission.dto';
import { UpdateFormSubmissionDto } from './dto/update-form-submission.dto';
import { AuthUser } from '../common/types/auth';
import { Role } from '../common/enums/role.enum';

const STATUSES = ['SUBMITTED', 'REJECTED', 'PROCESSED'] as const;

@Injectable()
export class FormSubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private async getScopedWhere(
    user: AuthUser,
  ): Promise<Prisma.FormSubmissionWhereInput> {
    const organizationId = this.validateOrganization(user);

    if (
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      user.role === Role.SUPER_ADMIN
    ) {
      return { organizationId };
    }

    if (user.role === Role.MANAGER) {
      const managedUsers = await this.prisma.user.findMany({
        where: {
          organizationId,
          managerId: user.userId,
        },
        select: { name: true },
      });

      const scopedNames = [
        user.name,
        ...managedUsers.map((entry) => entry.name),
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim())
        .filter(Boolean);

      if (scopedNames.length === 0) {
        return { organizationId, id: -1 };
      }

      return {
        organizationId,
        OR: scopedNames.map((name) => ({
          submittedBy: { equals: name, mode: 'insensitive' },
        })),
      };
    }

    if (!user.name?.trim()) {
      return { organizationId, id: -1 };
    }

    return {
      organizationId,
      submittedBy: { equals: user.name.trim(), mode: 'insensitive' },
    };
  }

  async create(dto: CreateFormSubmissionDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.formSubmission.create({
      data: {
        organizationId,
        form: dto.form,
        submittedBy: user.name,
        submissionDate: dto.submissionDate
          ? new Date(dto.submissionDate)
          : new Date(),
        data: dto.data,
        status: 'SUBMITTED',
      },
    });
  }

  async findAll(user: AuthUser) {
    const where = await this.getScopedWhere(user);
    return this.prisma.formSubmission.findMany({
      where,
      orderBy: { submissionDate: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const where = await this.getScopedWhere(user);
    const sub = await this.prisma.formSubmission.findFirst({
      where: { ...where, id },
    });
    if (!sub) throw new NotFoundException(`FormSubmission #${id} not found`);
    return sub;
  }

  async update(id: number, dto: UpdateFormSubmissionDto, user: AuthUser) {
    await this.findOne(id, user);
    return this.prisma.formSubmission.update({
      where: { id },
      data: {
        ...(dto.form !== undefined && { form: dto.form }),
        ...(dto.data !== undefined && { data: dto.data }),
        ...(dto.submissionDate !== undefined && {
          submissionDate: dto.submissionDate
            ? new Date(dto.submissionDate)
            : null,
        }),
      },
    });
  }

  async remove(id: number, user: AuthUser) {
    await this.findOne(id, user);
    return this.prisma.formSubmission.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getByStatus(user: AuthUser) {
    const where = await this.getScopedWhere(user);
    const submissions = await this.prisma.formSubmission.findMany({
      where,
      orderBy: { submissionDate: 'desc' },
    });
    const grouped: Record<string, typeof submissions> = {};
    for (const s of STATUSES) grouped[s] = [];
    for (const sub of submissions) {
      const key = sub.status.toUpperCase();
      if (grouped[key]) grouped[key].push(sub);
      else grouped[key] = [sub];
    }
    return grouped;
  }
}
