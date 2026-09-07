import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { TimesheetsService } from './timesheets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QueryTimesheetDto } from './dto/query-timesheet.dto';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/types/request';
@ApiTags('HR - Timesheets')
@Controller('timesheets')
@UseGuards(JwtAuthGuard)
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @ApiOperation({ summary: 'GET report' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('report')
  getReport(
    @Query() query: QueryTimesheetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timesheetsService.getReport(query, req.user);
  }

  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateTimesheetDto })
  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateTimesheetDto, @Req() req: AuthenticatedRequest) {
    return this.timesheetsService.create(dto, req.user);
  }

  @ApiOperation({ summary: 'GET :id' })
  @ApiResponse({ status: 200, description: 'Timesheet fetched successfully.' })
  @ApiResponse({ status: 404, description: 'Timesheet not found.' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.timesheetsService.findOne(id, req.user);
  }

  @ApiOperation({ summary: 'PATCH :id' })
  @ApiResponse({ status: 200, description: 'Timesheet updated successfully.' })
  @ApiResponse({ status: 404, description: 'Timesheet not found.' })
  @ApiBody({ type: UpdateTimesheetDto })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTimesheetDto, @Req() req: AuthenticatedRequest) {
    return this.timesheetsService.update(id, dto, req.user);
  }

  @ApiOperation({ summary: 'POST import' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('import')
  @HttpCode(HttpStatus.OK)
  importRecords(
    @Body() body: { records: Record<string, unknown>[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timesheetsService.importRecords(body.records, req.user);
  }
}
