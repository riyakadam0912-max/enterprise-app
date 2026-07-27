import {
  Body,
  Controller,
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
import { AtsService } from './ats.service';
import type { AuthenticatedRequest } from '../common/types/request';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { CreateJobOpeningDto } from './dto/create-job-opening.dto';
import { MoveCandidateStageDto } from './dto/move-candidate-stage.dto';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('HR - ATS')
@ApiBearerAuth()
@Controller('ats')
export class AtsController {
  constructor(private readonly service: AtsService) {}

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @ApiOperation({ summary: 'POST jobs' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateJobOpeningDto })
  @Post('jobs')
  createJob(
    @Body() dto: CreateJobOpeningDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createJob(dto, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET jobs' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('jobs')
  listJobs(@Req() req: AuthenticatedRequest) {
    return this.service.listJobs(req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @ApiOperation({ summary: 'POST candidates' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateCandidateDto })
  @Post('candidates')
  createCandidate(
    @Body() dto: CreateCandidateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createCandidate(dto, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET candidates' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('candidates')
  listCandidates(
    @Query('jobOpeningId') jobOpeningId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listCandidates(
      req.user,
      jobOpeningId ? Number(jobOpeningId) : undefined,
    );
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @ApiOperation({ summary: 'PATCH candidates/:id/stage' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: MoveCandidateStageDto })
  @Patch('candidates/:id/stage')
  moveStage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveCandidateStageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.moveCandidateStage(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @ApiOperation({ summary: 'POST interviews' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: ScheduleInterviewDto })
  @Post('interviews')
  scheduleInterview(
    @Body() dto: ScheduleInterviewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.scheduleInterview(dto, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET interviews' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('interviews')
  listInterviews(
    @Query('candidateId') candidateId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listInterviews(
      req.user,
      candidateId ? Number(candidateId) : undefined,
    );
  }
}
