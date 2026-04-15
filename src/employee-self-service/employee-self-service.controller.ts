import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { EmployeeSelfServiceService } from './employee-self-service.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { SubmitExpenseDto } from './dto/submit-expense.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
@ApiTags('HR - Employee Self Service')
@Controller('ess')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EMPLOYEE')
export class EmployeeSelfServiceController {
  constructor(
    private readonly essService: EmployeeSelfServiceService,
  ) {}

  /**
   * ATTENDANCE ENDPOINTS
   */

  @ApiOperation({ summary: 'POST attendance/check-in' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('attendance/check-in')
  async checkIn(@CurrentUser() user: any) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.checkIn(user.employeeId);
  }

  @ApiOperation({ summary: 'POST attendance/check-out' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('attendance/check-out')
  async checkOut(@CurrentUser() user: any) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.checkOut(user.employeeId);
  }

  @ApiOperation({ summary: 'GET attendance/today' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('attendance/today')
  async getAttendanceToday(@CurrentUser() user: any) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.getMyAttendanceToday(user.employeeId);
  }

  @ApiOperation({ summary: 'GET attendance/history' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('attendance/history')
  async getAttendanceHistory(@CurrentUser() user: any) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.getMyAttendanceHistory(user.employeeId);
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
  async applyLeave(
    @CurrentUser() user: any,
    @Body() dto: ApplyLeaveDto,
  ) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.applyLeave(user.employeeId, dto);
  }

  @ApiOperation({ summary: 'GET leave/balance' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('leave/balance')
  async getLeaveBalance(@CurrentUser() user: any) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.getMyLeaveBalance(user.employeeId);
  }

  @ApiOperation({ summary: 'GET leave/history' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('leave/history')
  async getLeaveHistory(@CurrentUser() user: any) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.getMyLeaveHistory(user.employeeId);
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
  async getMyPayslips(@CurrentUser() user: any) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.getMyPayslips(user.employeeId);
  }

  @ApiOperation({ summary: 'GET payslip/last' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('payslip/last')
  async getLastPayslip(@CurrentUser() user: any) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.getLastPayslip(user.employeeId);
  }

  @ApiOperation({ summary: 'GET payslip/:id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('payslip/:id')
  async getPayslipDetails(
    @Param('id') payslipId: string,
    @CurrentUser() user: any,
  ) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.getPayslipDetails(
      parseInt(payslipId),
      user.employeeId,
    );
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
    @CurrentUser() user: any,
    @Body() dto: SubmitExpenseDto,
  ) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.submitExpense(user.employeeId, dto);
  }

  @ApiOperation({ summary: 'GET expense/list' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('expense/list')
  async getMyExpenses(@CurrentUser() user: any) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.getMyExpenses(user.employeeId);
  }

  @ApiOperation({ summary: 'GET expense/:id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('expense/:id')
  async getExpenseDetails(
    @Param('id') expenseId: string,
    @CurrentUser() user: any,
  ) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.getExpenseDetails(
      parseInt(expenseId),
      user.employeeId,
    );
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
  async getMyProfile(@CurrentUser() user: any) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.getMyProfile(user.employeeId);
  }

  @ApiOperation({ summary: 'PUT profile/update' })
  @ApiResponse({ status: 200, description: 'PUT request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateProfileDto })
  @Put('profile/update')
  async updateMyProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
  ) {
    if (!user.employeeId) {
      throw new BadRequestException('Employee ID not found in user profile');
    }
    return this.essService.updateMyProfile(user.employeeId, dto);
  }
}
