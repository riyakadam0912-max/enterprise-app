import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/types/auth';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Work - Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateEventDto })
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @Post()
  create(@Body() dto: CreateEventDto, @Req() req: { user: AuthUser }) {
    return this.eventsService.create(dto, req.user);
  }

  @ApiOperation({ summary: 'POST import' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('import')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @HttpCode(HttpStatus.OK)
  importRecords(
    @Body() body: { records: Array<Record<string, unknown>> },
    @Req() req: { user: AuthUser },
  ) {
    return this.eventsService.importRecords(body.records, req.user);
  }

  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  findAll(@Req() req: { user: AuthUser }) {
    return this.eventsService.findAll(req.user);
  }

  @ApiOperation({ summary: 'GET by-event-type' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('by-event-type')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  getByEventType(@Req() req: { user: AuthUser }) {
    return this.eventsService.getByEventType(req.user);
  }

  @ApiOperation({ summary: 'GET :id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: AuthUser },
  ) {
    return this.eventsService.findOne(id, req.user);
  }

  @ApiOperation({ summary: 'PATCH :id' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateEventDto })
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.eventsService.update(id, dto, req.user);
  }

  @ApiOperation({ summary: 'DELETE :id' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: AuthUser },
  ) {
    return this.eventsService.remove(id, req.user);
  }
}
