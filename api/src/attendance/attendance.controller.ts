import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AttendanceService } from './attendance.service';
import { AssignShiftDto } from './dto/assign-shift.dto';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('HR - Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.HR, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'POST check-in' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CheckInDto })
  @Post('check-in')
  checkIn(
    @Body() dto: CheckInDto,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.checkIn(dto, req.user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.HR, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'POST check-out' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CheckOutDto })
  @Post('check-out')
  checkOut(
    @Body() dto: CheckOutDto,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.checkOut(dto, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'POST shifts' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateShiftDto })
  @Post('shifts')
  createShift(
    @Body() dto: CreateShiftDto,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.createShift(dto, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'GET shifts' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('shifts')
  listShifts(
    @Req()
    req: {
      organizationId?: number | null;
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.listShifts({
      ...req.user,
      organizationId: req.organizationId ?? req.user.organizationId,
    });
  }

  @Roles(Role.ADMIN, Role.HR, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'POST shifts/assign' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: AssignShiftDto })
  @Post('shifts/assign')
  assignShift(
    @Body() dto: AssignShiftDto,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.assignShift(dto, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'PATCH shifts/:id' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateShiftDto })
  @Patch('shifts/:id')
  updateShift(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShiftDto,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.updateShift(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'DELETE shifts/:id' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete('shifts/:id')
  deleteShift(
    @Param('id', ParseIntPipe) id: number,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.deleteShift(id, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  findAll(
    @Query() query: QueryAttendanceDto,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.findAll(query, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'GET me' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('me')
  findMine(
    @Query() query: QueryAttendanceDto,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.findMine(query, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'GET my' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('my')
  findMySnapshot(
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.getMySnapshot(req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'GET summary' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('summary')
  summary(
    @Query() query: AttendanceSummaryQueryDto,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.getSummary(query, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'GET today' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('today')
  findToday(
    @Query('date') date: string | undefined,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.getToday(req.user, date);
  }

  @Roles(Role.ADMIN, Role.HR, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'GET employee/:id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('monthly-report')
  monthlyReport(
    @Query() query: QueryAttendanceDto,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.getMonthlyReport(query, req.user);
  }

  @Get('employee/:id')
  findByEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Query('month') month: string | undefined,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.getEmployeeAttendance(id, req.user, month);
  }

  @Roles(Role.ADMIN, Role.HR, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'PATCH :id' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateAttendanceDto })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttendanceDto,
    @Req()
    req: {
      user: {
        userId: number;
        role: Role;
        employeeId?: number | null;
        organizationId: number;
      };
    },
  ) {
    return this.attendanceService.update(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'POST automation/run' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('automation/run')
  runAutomation() {
    return this.attendanceService.runDailyAutomation();
  }
}
