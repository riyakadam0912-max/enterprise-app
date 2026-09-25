import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permissions.enum';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth';
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiTags('Support - Tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // ── Tickets ──────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateTicketDto })
  @RequirePermissions(Permission.TICKET_CREATE)
  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.ticketsService.create(dto, user);
  }

  @ApiOperation({ summary: 'POST import' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('import')
  @RequirePermissions(Permission.TICKET_IMPORT)
  @HttpCode(HttpStatus.OK)
  importRecords(
    @Body() body: { records: Record<string, unknown>[] },
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.importRecords(body.records, user);
  }

  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.ticketsService.findAll(user);
  }

  @ApiOperation({ summary: 'GET by-type' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('by-type')
  getByTicketType(@CurrentUser() user: AuthUser) {
    return this.ticketsService.getByTicketType(user);
  }

  @ApiOperation({ summary: 'GET :id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.findOne(id, user);
  }

  @ApiOperation({ summary: 'PATCH :id' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateTicketDto })
  @RequirePermissions(Permission.TICKET_UPDATE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.update(id, dto, user);
  }

  @ApiOperation({ summary: 'DELETE :id' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id')
  @RequirePermissions(Permission.TICKET_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.ticketsService.remove(id, user);
  }

  // ── Ticket Types ──────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'POST ticket-types' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateTicketTypeDto })
  @Post('ticket-types')
  @RequirePermissions(Permission.TICKET_TYPE_MANAGE)
  createTicketType(
    @Body() dto: CreateTicketTypeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.createTicketType(dto, user);
  }

  @ApiOperation({ summary: 'GET ticket-types/all' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('ticket-types/all')
  findAllTicketTypes() {
    return this.ticketsService.findAllTicketTypes();
  }

  @ApiOperation({ summary: 'DELETE ticket-types/:id' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete('ticket-types/:id')
  @RequirePermissions(Permission.TICKET_TYPE_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTicketType(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.removeTicketType(id, user);
  }
}
