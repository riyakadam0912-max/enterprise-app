import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormSubmissionDto } from './dto/create-form-submission.dto';
import { UpdateFormSubmissionDto } from './dto/update-form-submission.dto';

const STATUSES = ['SUBMITTED', 'REJECTED', 'PROCESSED'] as const;

@Injectable()
export class FormSubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFormSubmissionDto) {
    return this.prisma.formSubmission.create({
      data: {
        form:           dto.form,
        submittedBy:    dto.submittedBy,
        submissionDate: dto.submissionDate ? new Date(dto.submissionDate) : undefined,
        data:           dto.data,
        status:         dto.status ?? 'SUBMITTED',
        reviewer:       dto.reviewer,
        reviewDate:     dto.reviewDate ? new Date(dto.reviewDate) : undefined,
      },
    });
  }

  async findAll() {
    return this.prisma.formSubmission.findMany({
      orderBy: { submissionDate: 'desc' },
    });
  }

  async findOne(id: number) {
    const sub = await this.prisma.formSubmission.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException(`FormSubmission #${id} not found`);
    return sub;
  }

  async update(id: number, dto: UpdateFormSubmissionDto) {
    await this.findOne(id);
    return this.prisma.formSubmission.update({
      where: { id },
      data: {
        ...(dto.form           !== undefined && { form:           dto.form }),
        ...(dto.submittedBy    !== undefined && { submittedBy:    dto.submittedBy }),
        ...(dto.data           !== undefined && { data:           dto.data }),
        ...(dto.status         !== undefined && { status:         dto.status }),
        ...(dto.reviewer       !== undefined && { reviewer:       dto.reviewer }),
        ...(dto.submissionDate !== undefined && {
          submissionDate: dto.submissionDate ? new Date(dto.submissionDate) : null,
        }),
        ...(dto.reviewDate !== undefined && {
          reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : null,
        }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.formSubmission.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async getByStatus() {
    const submissions = await this.prisma.formSubmission.findMany({
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
