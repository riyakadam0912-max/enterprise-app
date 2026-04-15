import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportsAnalyticsService } from './reports-analytics.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type {
  ReportsQueryFilters,
  ReportsUserContext,
} from './reports-analytics.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE')
@ApiTags('Analytics - Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly analyticsService: ReportsAnalyticsService,
  ) {}

  @ApiOperation({ summary: 'GET overview' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('overview')
  getOverview() {
    return this.reportsService.getOverview();
  }

  @ApiOperation({ summary: 'GET attendance' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('attendance')
  getAttendanceReport(
    @CurrentUser() user: ReportsUserContext,
    @Query() filters: ReportsQueryFilters,
  ) {
    return this.analyticsService.getAttendanceReport(user, filters);
  }

  @ApiOperation({ summary: 'GET attendance/daily' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('attendance/daily')
  getDailyAttendanceBreakdown(
    @CurrentUser() user: ReportsUserContext,
    @Query() filters: ReportsQueryFilters,
  ) {
    return this.analyticsService.getDailyAttendanceBreakdown(user, filters);
  }

  @ApiOperation({ summary: 'GET attendance/departments' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('attendance/departments')
  getDepartmentAttendance(
    @CurrentUser() user: ReportsUserContext,
    @Query() filters: ReportsQueryFilters,
  ) {
    return this.analyticsService.getDepartmentAttendance(user, filters);
  }

  @ApiOperation({ summary: 'GET payroll' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('payroll')
  getPayrollSummary(
    @CurrentUser() user: ReportsUserContext,
    @Query() filters: ReportsQueryFilters,
  ) {
    return this.analyticsService.getPayrollSummary(user, filters);
  }

  @ApiOperation({ summary: 'GET payroll/departments' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('payroll/departments')
  getPayrollDistribution(
    @CurrentUser() user: ReportsUserContext,
    @Query() filters: ReportsQueryFilters,
  ) {
    return this.analyticsService.getPayrollDistribution(user, filters);
  }

  @ApiOperation({ summary: 'GET payroll/trends' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('payroll/trends')
  getPayrollTrends(
    @CurrentUser() user: ReportsUserContext,
    @Query() filters: ReportsQueryFilters,
  ) {
    return this.analyticsService.getPayrollCostTrends(user, filters);
  }

  @ApiOperation({ summary: 'GET turnover' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('turnover')
  getTurnoverSummary(
    @CurrentUser() user: ReportsUserContext,
    @Query() filters: ReportsQueryFilters,
  ) {
    return this.analyticsService.getTurnoverSummary(user, filters);
  }

  @ApiOperation({ summary: 'GET performance' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('performance')
  getPerformanceInsights(
    @CurrentUser() user: ReportsUserContext,
    @Query() filters: ReportsQueryFilters,
  ) {
    return this.analyticsService.getPerformanceInsights(user, filters);
  }

  @ApiOperation({ summary: 'GET dashboard' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('dashboard')
  getDashboard(
    @CurrentUser() user: ReportsUserContext,
    @Query() filters: ReportsQueryFilters,
  ) {
    return this.analyticsService.getDashboard(user, filters);
  }
}
