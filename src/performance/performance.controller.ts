import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateGoalCycleDto } from './dto/create-goal-cycle.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { SubmitPerformanceReviewDto } from './dto/submit-performance-review.dto';
import { PerformanceService } from './performance.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('HR - Performance')
@ApiBearerAuth()
@Controller('performance')
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @ApiOperation({ summary: 'POST goal-cycles' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateGoalCycleDto })
  @Post('goal-cycles')
  createGoalCycle(@Body() dto: CreateGoalCycleDto) {
    return this.service.createGoalCycle(dto);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET goal-cycles' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('goal-cycles')
  listGoalCycles() {
    return this.service.listGoalCycles();
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @ApiOperation({ summary: 'POST goals' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateGoalDto })
  @Post('goals')
  createGoal(@Body() dto: CreateGoalDto) {
    return this.service.createGoal(dto);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET goals' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('goals')
  listGoals(@Query('employeeId') employeeId?: string, @Req() req?: { user?: { role?: Role; employeeId?: number | null } }) {
    return this.service.listGoals(employeeId ? Number(employeeId) : undefined, req?.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'POST reviews' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: SubmitPerformanceReviewDto })
  @Post('reviews')
  submitReview(@Body() dto: SubmitPerformanceReviewDto, @Req() req: { user: { userId: number } }) {
    return this.service.submitReview(dto, req.user.userId);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET reviews' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('reviews')
  listReviews(@Query('employeeId') employeeId?: string, @Req() req?: { user?: { role?: Role; employeeId?: number | null } }) {
    return this.service.listReviews(employeeId ? Number(employeeId) : undefined, req?.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @ApiOperation({ summary: 'PATCH goals/status' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Patch('goals/status')
  updateGoalStatus(@Body() body: { goalId: number; status: string; managerComment?: string }) {
    return this.service.updateGoalStatus(body.goalId, body.status, body.managerComment);
  }
}
