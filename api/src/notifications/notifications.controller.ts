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
  Req,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth';
import type { AuthenticatedRequest } from '../common/types/request';
@UseGuards(JwtAuthGuard)
@ApiTags('System - Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateNotificationDto })
  @Post()
  create(@Body() dto: CreateNotificationDto, @CurrentUser() user: AuthUser) {
    return this.notificationsService.create(
      dto,
      user.organizationId ?? undefined,
    );
  }

  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.findAll(
      req.user.userId,
      query,
      req.user.organizationId,
    );
  }

  @ApiOperation({ summary: 'GET unread-count' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('unread-count')
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getUnreadCount(
      req.user.userId,
      req.user.organizationId,
    );
  }

  @ApiOperation({ summary: 'POST read-all' })
  @ApiResponse({ status: 200, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('read-all')
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(
      req.user.userId,
      req.user.organizationId,
    );
  }

  @ApiOperation({ summary: 'POST read/:id' })
  @ApiResponse({ status: 200, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('read/:id')
  markRead(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.markRead(
      id,
      req.user.userId,
      req.user.organizationId,
    );
  }

  @Patch(':id/read')
  markReadLegacy(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.markRead(
      id,
      req.user.userId,
      req.user.organizationId,
    );
  }

  @ApiOperation({ summary: 'DELETE :id' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.deleteNotification(
      id,
      req.user.userId,
      req.user.organizationId,
    );
  }

  @ApiOperation({ summary: 'GET preferences' })
  @Get('preferences')
  getPreferences(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getPreferences(
      req.user.userId,
      req.user.organizationId,
    );
  }

  @ApiOperation({ summary: 'PATCH preferences' })
  @ApiBody({ type: UpdateNotificationPreferencesDto })
  @Patch('preferences')
  updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(
      req.user.userId,
      dto,
      req.user.organizationId,
    );
  }

  @ApiOperation({
    summary:
      'GET live delta-sync — polling fallback for disabled WebSocket realtime',
  })
  @ApiResponse({ status: 200, description: 'Delta sync result since cursor.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @Get('live')
  findSince(
    @Req() req: AuthenticatedRequest,
    @Query('since') sinceISO: string,
  ) {
    const cursor =
      typeof sinceISO === 'string' && sinceISO.trim().length > 0
        ? sinceISO
        : new Date(0).toISOString();
    return this.notificationsService.findSince(
      req.user.userId,
      cursor,
      req.user.organizationId,
    );
  }

  @ApiOperation({
    summary:
      'GET counts — cheap polling endpoint returning unread count + latest cursor',
  })
  @ApiResponse({ status: 200, description: 'Notification counts snapshot.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @Get('counts')
  getCounts(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getCounts(
      req.user.userId,
      req.user.organizationId,
    );
  }
}
