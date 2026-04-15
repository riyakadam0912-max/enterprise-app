import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { CreateJobOpeningDto } from './dto/create-job-opening.dto';
import { MoveCandidateStageDto } from './dto/move-candidate-stage.dto';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';

@Injectable()
export class AtsService {
  constructor(private readonly prisma: PrismaService) {}

  async createJob(dto: CreateJobOpeningDto) {
    const prisma = this.prisma as any;
    return prisma.jobOpening.create({
      data: {
        title: dto.title,
        department: dto.department,
        location: dto.location,
        employmentType: dto.employmentType,
        description: dto.description,
        openings: dto.openings ?? 1,
      },
    });
  }

  async listJobs() {
    const prisma = this.prisma as any;
    return prisma.jobOpening.findMany({
      include: { _count: { select: { candidates: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCandidate(dto: CreateCandidateDto) {
    const prisma = this.prisma as any;
    const job = await prisma.jobOpening.findUnique({ where: { id: dto.jobOpeningId } });
    if (!job) {
      throw new NotFoundException('Job opening not found');
    }

    return prisma.candidate.create({
      data: {
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

  async listCandidates(jobOpeningId?: number) {
    const prisma = this.prisma as any;
    return prisma.candidate.findMany({
      where: jobOpeningId ? { jobOpeningId } : undefined,
      include: {
        jobOpening: true,
        interviews: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async moveCandidateStage(candidateId: number, dto: MoveCandidateStageDto) {
    const prisma = this.prisma as any;
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    return prisma.candidate.update({
      where: { id: candidateId },
      data: {
        currentStage: dto.stage,
        status: dto.status ?? candidate.status,
        remarks: dto.remarks,
      },
      include: { jobOpening: true, interviews: true },
    });
  }

  async scheduleInterview(dto: ScheduleInterviewDto) {
    const prisma = this.prisma as any;
    const candidate = await prisma.candidate.findUnique({ where: { id: dto.candidateId } });
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    return prisma.interview.create({
      data: {
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

  async listInterviews(candidateId?: number) {
    const prisma = this.prisma as any;
    return prisma.interview.findMany({
      where: candidateId ? { candidateId } : undefined,
      include: {
        candidate: { include: { jobOpening: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
