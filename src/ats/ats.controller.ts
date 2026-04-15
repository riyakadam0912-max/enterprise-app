import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AtsService } from './ats.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { CreateJobOpeningDto } from './dto/create-job-opening.dto';
import { MoveCandidateStageDto } from './dto/move-candidate-stage.dto';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  createJob(@Body() dto: CreateJobOpeningDto) {
    return this.service.createJob(dto);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET jobs' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('jobs')
  listJobs() {
    return this.service.listJobs();
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @ApiOperation({ summary: 'POST candidates' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateCandidateDto })
  @Post('candidates')
  createCandidate(@Body() dto: CreateCandidateDto) {
    return this.service.createCandidate(dto);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET candidates' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('candidates')
  listCandidates(@Query('jobOpeningId') jobOpeningId?: string) {
    return this.service.listCandidates(jobOpeningId ? Number(jobOpeningId) : undefined);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @ApiOperation({ summary: 'PATCH candidates/:id/stage' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: MoveCandidateStageDto })
  @Patch('candidates/:id/stage')
  moveStage(@Param('id', ParseIntPipe) id: number, @Body() dto: MoveCandidateStageDto) {
    return this.service.moveCandidateStage(id, dto);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  @ApiOperation({ summary: 'POST interviews' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: ScheduleInterviewDto })
  @Post('interviews')
  scheduleInterview(@Body() dto: ScheduleInterviewDto) {
    return this.service.scheduleInterview(dto);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET interviews' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('interviews')
  listInterviews(@Query('candidateId') candidateId?: string) {
    return this.service.listInterviews(candidateId ? Number(candidateId) : undefined);
  }
}
