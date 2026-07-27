import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalCycleDto } from './dto/create-goal-cycle.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { SubmitPerformanceReviewDto } from './dto/submit-performance-review.dto';
import type { AuthUser } from '../common/types/auth';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async createGoalCycle(dto: CreateGoalCycleDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.goalCycle.create({
      data: {
        organizationId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: dto.status ?? 'ACTIVE',
      },
    });
  }

  async listGoalCycles(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.goalCycle.findMany({
      where: { organizationId },
      include: { _count: { select: { goals: true, reviews: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async createGoal(dto: CreateGoalDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId, organizationId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const cycle = await this.prisma.goalCycle.findUnique({
      where: { id: dto.goalCycleId, organizationId },
    });
    if (!cycle) {
      throw new NotFoundException('Goal cycle not found');
    }

    return this.prisma.goal.create({
      data: {
        organizationId,
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

  async listGoals(user: AuthUser, employeeId?: number) {
    const organizationId = this.validateOrganization(user);
    const scopedEmployeeId =
      user.role === Role.EMPLOYEE ? (user.employeeId ?? undefined) : employeeId;

    return this.prisma.goal.findMany({
      where: {
        organizationId,
        ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
      },
      include: {
        employee: true,
        goalCycle: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitReview(
    dto: SubmitPerformanceReviewDto,
    reviewerId: number,
    user: AuthUser,
  ) {
    const organizationId = this.validateOrganization(user);
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId, organizationId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const cycle = await this.prisma.goalCycle.findUnique({
      where: { id: dto.goalCycleId, organizationId },
    });
    if (!cycle) {
      throw new NotFoundException('Goal cycle not found');
    }

    return this.prisma.performanceReview.upsert({
      where: {
        employeeId_goalCycleId: {
          employeeId: dto.employeeId,
          goalCycleId: dto.goalCycleId,
        },
        organizationId,
      },
      update: {
        organizationId,
        reviewerId,
        rating: dto.rating,
        summary: dto.summary,
        strengths: dto.strengths,
        improvements: dto.improvements,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      create: {
        organizationId,
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

  async listReviews(user: AuthUser, employeeId?: number) {
    const organizationId = this.validateOrganization(user);
    const scopedEmployeeId =
      user.role === Role.EMPLOYEE ? (user.employeeId ?? undefined) : employeeId;

    return this.prisma.performanceReview.findMany({
      where: {
        organizationId,
        ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
      },
      include: {
        employee: true,
        goalCycle: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateGoalStatus(
    goalId: number,
    status: string,
    user: AuthUser,
    managerComment?: string,
  ) {
    const organizationId = this.validateOrganization(user);
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId, organizationId },
    });
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return this.prisma.goal.update({
      where: { id: goalId, organizationId },
      data: {
        status,
        managerComment,
      },
      include: { employee: true, goalCycle: true },
    });
  }
}
