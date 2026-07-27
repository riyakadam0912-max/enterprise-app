import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormSubmissionDto } from './dto/create-form-submission.dto';
import { UpdateFormSubmissionDto } from './dto/update-form-submission.dto';
import { AuthUser } from '../common/types/auth';

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

  async create(dto: CreateFormSubmissionDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.formSubmission.create({
      data: {
        organizationId,
        form: dto.form,
        submittedBy: dto.submittedBy,
        submissionDate: dto.submissionDate
          ? new Date(dto.submissionDate)
          : undefined,
        data: dto.data,
        status: dto.status ?? 'SUBMITTED',
        reviewer: dto.reviewer,
        reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : undefined,
      },
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.formSubmission.findMany({
      where: { organizationId },
      orderBy: { submissionDate: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const sub = await this.prisma.formSubmission.findUnique({
      where: { id, organizationId },
    });
    if (!sub) throw new NotFoundException(`FormSubmission #${id} not found`);
    return sub;
  }

  async update(id: number, dto: UpdateFormSubmissionDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.formSubmission.update({
      where: { id, organizationId },
      data: {
        ...(dto.form !== undefined && { form: dto.form }),
        ...(dto.submittedBy !== undefined && { submittedBy: dto.submittedBy }),
        ...(dto.data !== undefined && { data: dto.data }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.reviewer !== undefined && { reviewer: dto.reviewer }),
        ...(dto.submissionDate !== undefined && {
          submissionDate: dto.submissionDate
            ? new Date(dto.submissionDate)
            : null,
        }),
        ...(dto.reviewDate !== undefined && {
          reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : null,
        }),
      },
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.formSubmission.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async getByStatus(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const submissions = await this.prisma.formSubmission.findMany({
      where: { organizationId },
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
