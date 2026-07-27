import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { CreateJobOpeningDto } from './dto/create-job-opening.dto';
import { MoveCandidateStageDto } from './dto/move-candidate-stage.dto';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import { AuthUser } from '../common/types/auth';

@Injectable()
export class AtsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async createJob(dto: CreateJobOpeningDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.jobOpening.create({
      data: {
        organizationId,
        title: dto.title,
        department: dto.department,
        location: dto.location,
        employmentType: dto.employmentType,
        description: dto.description,
        openings: dto.openings ?? 1,
      },
    });
  }

  async listJobs(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.jobOpening.findMany({
      where: { organizationId },
      include: { _count: { select: { candidates: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCandidate(dto: CreateCandidateDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const job = await this.prisma.jobOpening.findUnique({
      where: { id: dto.jobOpeningId, organizationId },
    });
    if (!job) {
      throw new NotFoundException('Job opening not found');
    }

    return this.prisma.candidate.create({
      data: {
        organizationId,
        jobOpeningId: dto.jobOpeningId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        resumeUrl: dto.resumeUrl,
        source: dto.source,
      },
      include: { jobOpening: true },
    });
  }

  async listCandidates(user: AuthUser, jobOpeningId?: number) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.candidate.findMany({
      where: {
        organizationId,
        ...(jobOpeningId ? { jobOpeningId } : {}),
      },
      include: {
        jobOpening: true,
        interviews: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async moveCandidateStage(
    candidateId: number,
    dto: MoveCandidateStageDto,
    user: AuthUser,
  ) {
    const organizationId = this.validateOrganization(user);
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId, organizationId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    return this.prisma.candidate.update({
      where: { id: candidateId, organizationId },
      data: {
        currentStage: dto.stage,
        status: dto.status ?? candidate.status,
        remarks: dto.remarks,
      },
      include: { jobOpening: true, interviews: true },
    });
  }

  async scheduleInterview(dto: ScheduleInterviewDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: dto.candidateId, organizationId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    return this.prisma.interview.create({
      data: {
        organizationId,
        candidateId: dto.candidateId,
        scheduledAt: new Date(dto.scheduledAt),
        interviewerId: dto.interviewerId,
        mode: dto.mode,
      },
      include: {
        candidate: { include: { jobOpening: true } },
      },
    });
  }

  async listInterviews(user: AuthUser, candidateId?: number) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.interview.findMany({
      where: {
        organizationId,
        ...(candidateId ? { candidateId } : {}),
      },
      include: {
        candidate: { include: { jobOpening: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
