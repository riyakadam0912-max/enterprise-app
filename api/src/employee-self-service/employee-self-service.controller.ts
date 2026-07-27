import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { EmployeeSelfServiceService } from './employee-self-service.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { SubmitExpenseDto } from './dto/submit-expense.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
@ApiTags('HR - Employee Self Service')
@Controller(['ess', 'employee-self-service'])
@UseGuards(JwtAuthGuard)
// Removed @Roles('EMPLOYEE') - All authenticated users can access their own ESS data
export class EmployeeSelfServiceController {
  constructor(private readonly essService: EmployeeSelfServiceService) {}

  /**
   * ATTENDANCE ENDPOINTS
   */

  @ApiOperation({ summary: 'POST attendance/check-in' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('attendance/check-in')
  async checkIn(@CurrentUser() user: AuthUser) {
    return this.essService.checkIn(user);
  }

  @ApiOperation({ summary: 'POST attendance/check-out' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('attendance/check-out')
  async checkOut(@CurrentUser() user: AuthUser) {
    return this.essService.checkOut(user);
  }

  @ApiOperation({ summary: 'GET attendance/today' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('attendance/today')
  async getAttendanceToday(@CurrentUser() user: AuthUser) {
    return this.essService.getMyAttendanceToday(user);
  }

  @ApiOperation({ summary: 'GET attendance/history' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('attendance/history')
  async getAttendanceHistory(@CurrentUser() user: AuthUser) {
    return this.essService.getMyAttendanceHistory(user);
  }

  /**
   * LEAVE ENDPOINTS
   */

  @ApiOperation({ summary: 'POST leave/apply' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: ApplyLeaveDto })
  @Post('leave/apply')
  async applyLeave(@CurrentUser() user: AuthUser, @Body() dto: ApplyLeaveDto) {
    return this.essService.applyLeave(user, dto);
  }

  @ApiOperation({ summary: 'GET leave/balance' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('leave/balance')
  async getLeaveBalance(@CurrentUser() user: AuthUser) {
    return this.essService.getMyLeaveBalance(user);
  }

  @ApiOperation({ summary: 'GET leave/history' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('leave/history')
  async getLeaveHistory(@CurrentUser() user: AuthUser) {
    return this.essService.getMyLeaveHistory(user);
  }

  /**
   * PAYSLIP ENDPOINTS
   */

  @ApiOperation({ summary: 'GET payslip/list' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('payslip/list')
  async getMyPayslips(@CurrentUser() user: AuthUser) {
    return this.essService.getMyPayslips(user);
  }

  @ApiOperation({ summary: 'GET payslip/last' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('payslip/last')
  async getLastPayslip(@CurrentUser() user: AuthUser) {
    return this.essService.getLastPayslip(user);
  }

  @ApiOperation({ summary: 'GET payslip/:id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('payslip/:id')
  async getPayslipDetails(
    @Param('id') payslipId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.essService.getPayslipDetails(parseInt(payslipId), user);
  }

  /**
   * EXPENSE ENDPOINTS
   */

  @ApiOperation({ summary: 'POST expense/submit' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: SubmitExpenseDto })
  @Post('expense/submit')
  async submitExpense(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitExpenseDto,
  ) {
    return this.essService.submitExpense(user, dto);
  }

  @ApiOperation({ summary: 'GET expense/list' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('expense/list')
  async getMyExpenses(@CurrentUser() user: AuthUser) {
    return this.essService.getMyExpenses(user);
  }

  @ApiOperation({ summary: 'GET expense/:id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('expense/:id')
  async getExpenseDetails(
    @Param('id') expenseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.essService.getExpenseDetails(parseInt(expenseId), user);
  }

  /**
   * PROFILE ENDPOINTS
   */

  @ApiOperation({ summary: 'GET profile/me' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('profile/me')
  async getMyProfile(@CurrentUser() user: AuthUser) {
    const profile = await this.essService.getMyProfile(user);
    return {
      success: true,
      data: profile,
    };
  }

  @ApiOperation({ summary: 'PUT profile/update' })
  @ApiResponse({ status: 200, description: 'PUT request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateProfileDto })
  @Put('profile/update')
  async updateMyProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.essService.updateMyProfile(user, dto);
  }
}
