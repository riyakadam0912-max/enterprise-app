import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalCycleDto } from './dto/create-goal-cycle.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { SubmitPerformanceReviewDto } from './dto/submit-performance-review.dto';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createGoalCycle(dto: CreateGoalCycleDto) {
    const prisma = this.prisma as any;
    return prisma.goalCycle.create({
      data: {
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: dto.status ?? 'ACTIVE',
      },
    });
  }

  async listGoalCycles() {
    const prisma = this.prisma as any;
    return prisma.goalCycle.findMany({
      include: { _count: { select: { goals: true, reviews: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async createGoal(dto: CreateGoalDto) {
    const prisma = this.prisma as any;
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const cycle = await prisma.goalCycle.findUnique({ where: { id: dto.goalCycleId } });
    if (!cycle) {
      throw new NotFoundException('Goal cycle not found');
    }

    return prisma.goal.create({
      data: {
        employeeId: dto.employeeId,
        goalCycleId: dto.goalCycleId,
        title: dto.title,
        description: dto.description,
        weightage: dto.weightage ?? 0,
        targetMetric: dto.targetMetric,
      },
      include: { employee: true, goalCycle: true },
    });
  }

  async listGoals(employeeId?: number, user?: { role?: Role; employeeId?: number | null }) {
    const prisma = this.prisma as any;
    const scopedEmployeeId = user?.role === Role.EMPLOYEE ? user.employeeId ?? undefined : employeeId;

    return prisma.goal.findMany({
      where: scopedEmployeeId ? { employeeId: scopedEmployeeId } : undefined,
      include: {
        employee: true,
        goalCycle: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitReview(dto: SubmitPerformanceReviewDto, reviewerId: number) {
    const prisma = this.prisma as any;
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const cycle = await prisma.goalCycle.findUnique({ where: { id: dto.goalCycleId } });
    if (!cycle) {
      throw new NotFoundException('Goal cycle not found');
    }

    return prisma.performanceReview.upsert({
      where: {
        employeeId_goalCycleId: {
          employeeId: dto.employeeId,
          goalCycleId: dto.goalCycleId,
        },
      },
      update: {
        reviewerId,
        rating: dto.rating,
        summary: dto.summary,
        strengths: dto.strengths,
        improvements: dto.improvements,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      create: {
        employeeId: dto.employeeId,
        goalCycleId: dto.goalCycleId,
        reviewerId,
        rating: dto.rating,
        summary: dto.summary,
        strengths: dto.strengths,
        improvements: dto.improvements,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      include: { employee: true, goalCycle: true },
    });
  }

  async listReviews(employeeId?: number, user?: { role?: Role; employeeId?: number | null }) {
    const prisma = this.prisma as any;
    const scopedEmployeeId = user?.role === Role.EMPLOYEE ? user.employeeId ?? undefined : employeeId;

    return prisma.performanceReview.findMany({
      where: scopedEmployeeId ? { employeeId: scopedEmployeeId } : undefined,
      include: {
        employee: true,
        goalCycle: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateGoalStatus(goalId: number, status: string, managerComment?: string) {
    const prisma = this.prisma as any;
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return prisma.goal.update({
      where: { id: goalId },
      data: {
        status,
        managerComment,
      },
      include: { employee: true, goalCycle: true },
    });
  }
}
